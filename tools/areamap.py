"""Interactive area map for the Location page, drawn from OpenStreetMap data.
Walking distances come from shortest paths over the OSM street network (3 mph)."""
import json, math, heapq
from shapely.geometry import LineString, Polygon, Point, box, MultiLineString
from shapely.ops import linemerge, split, unary_union, nearest_points

SRC = '/mnt/user-data/uploads/Downloads/butlers-marina-photos/bm-osm-area.json'
D = json.load(open(SRC))
N = {int(k): v for k, v in D['nodes'].items()}
W = D['ways']
RW = {int(k): v for k, v in D['relWays'].items()}

LON0, LON1, LAT0, LAT1 = -76.5055, -76.4575, 38.9905, 38.9570
COS = math.cos(math.radians((LAT0 + LAT1) / 2))
VW = 1200.0
K = VW / ((LON1 - LON0) * COS)
VH = round((LAT0 - LAT1) * K)
def pj(lat, lon):
    return ((lon - LON0) * COS * K, (LAT0 - lat) * K)

HOME = (38.96878, -76.48027)   # 409 Chester Avenue, from the OSM building
FRAME = box(-20, -20, VW + 20, VH + 20)

def way_pts(nodes):
    return [pj(*N[n]) for n in nodes if n in N]

def path_d(coords, close=False, nd=1):
    f = (lambda v: f'{v:.{nd}f}'.rstrip('0').rstrip('.')) if nd else (lambda v: str(round(v)))
    pts = list(coords)
    if not pts: return ''
    s = 'M' + ' '.join(f'{f(x)} {f(y)}' for x, y in pts[:1]) + 'L' + ' '.join(f'{f(x)} {f(y)}' for x, y in pts[1:])
    return s + ('Z' if close else '')

def geom_d(g, tol=0.8, nd=1, close=True):
    g = g.simplify(tol, preserve_topology=True)
    out = []
    polys = getattr(g, 'geoms', [g])
    for p in polys:
        if p.is_empty: continue
        if p.geom_type == 'Polygon':
            out.append(path_d(p.exterior.coords, True, nd))
            for r in p.interiors: out.append(path_d(r.coords, True, nd))
        elif p.geom_type in ('LineString',):
            out.append(path_d(p.coords, False, nd))
        elif p.geom_type in ('MultiPolygon', 'MultiLineString', 'GeometryCollection'):
            out.append(geom_d(p, tol, nd))
    return ''.join(out)

# ---------- land from coastline (land on the left of the way direction) ----------
coast = [LineString(way_pts(w['nodes'])) for w in W.values() if w['tags'].get('natural') == 'coastline' and len(w['nodes']) > 1]
merged = linemerge(coast)
lines = list(getattr(merged, 'geoms', [merged]))
pieces = split(FRAME, MultiLineString(lines))
segs = []
for ln in lines:
    c = list(ln.coords)
    for a, b in zip(c, c[1:]): segs.append((a, b))
def is_land(poly):
    p = poly.representative_point()
    best, side = 1e18, 0
    for a, b in segs:
        ax, ay = a; bx, by = b
        dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy or 1e-9
        t = max(0, min(1, ((p.x - ax) * dx + (p.y - ay) * dy) / L2))
        qx, qy = ax + t * dx, ay + t * dy
        dd = (p.x - qx) ** 2 + (p.y - qy) ** 2
        if dd < best:
            best = dd
            # screen y points down, so "left" of travel flips sign
            side = dx * (p.y - ay) - dy * (p.x - ax)
    return side < 0
land = unary_union([g for g in pieces.geoms if is_land(g)])

# ---------- parks, academy grounds, piers, roads ----------
def closed_poly(nodes):
    pts = way_pts(nodes)
    if len(pts) >= 4 and nodes[0] == nodes[-1]:
        pg = Polygon(pts)
        return pg if pg.is_valid else pg.buffer(0)
parks = []
for w in W.values():
    t = w['tags']
    if t.get('leisure') in ('park', 'nature_reserve') and isinstance(w['id'], int):
        pg = closed_poly(w['nodes'])
        if pg is not None and pg.area > 120: parks.append(pg)
parks = unary_union(parks).intersection(land.buffer(2)) if parks else None

def relation_poly(rid):
    rel = D['rels'][str(rid)]
    outers = [RW[m['ref']]['nodes'] for m in rel['members'] if m['type'] == 'way' and m['role'] == 'outer' and m['ref'] in RW]
    ls = linemerge([LineString(way_pts(n)) for n in outers if len(n) > 1])
    rings = list(getattr(ls, 'geoms', [ls]))
    polys = [Polygon(r.coords) for r in rings if r.is_ring]
    return unary_union([p.buffer(0) for p in polys])
try:
    usna = relation_poly(20613247).intersection(land.buffer(2))
except Exception as e:
    print('usna relation failed', e); usna = None

piers = []
for w in W.values():
    if w['tags'].get('man_made') == 'pier' and isinstance(w['id'], int):
        pts = way_pts(w['nodes'])
        if len(pts) < 2: continue
        if w['nodes'][0] == w['nodes'][-1] and len(pts) >= 4: piers.append(Polygon(pts).buffer(0))
        else: piers.append(LineString(pts).buffer(1.1, cap_style=2))
piers = unary_union(piers)

MAJOR = {'primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link', 'trunk'}
MINOR = {'residential', 'unclassified', 'living_street', 'pedestrian'}
roads_major, roads_minor = [], []
for w in W.values():
    t = w['tags']; h = t.get('highway')
    if not h or not isinstance(w['id'], int): continue
    pts = way_pts(w['nodes'])
    if len(pts) < 2: continue
    ls = LineString(pts)
    if not ls.intersects(FRAME): continue
    if h in MAJOR: roads_major.append(ls)
    elif h in MINOR: roads_minor.append(ls)

# ---------- walking graph ----------
WALK_NO = {'motorway', 'motorway_link', 'proposed', 'construction', 'platform', 'bus_stop', 'elevator', 'raceway'}
G = {}
def hav(a, b):
    la1, lo1 = map(math.radians, a); la2, lo2 = map(math.radians, b)
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))
for w in W.values():
    t = w['tags']; h = t.get('highway')
    if not h or h in WALK_NO or not isinstance(w['id'], int): continue
    if t.get('foot') == 'no' or t.get('access') in ('private', 'no') and t.get('foot') not in ('yes', 'designated', 'permissive'): continue
    ns = [n for n in w['nodes'] if n in N]
    for a, b in zip(ns, ns[1:]):
        d = hav(N[a], N[b])
        G.setdefault(a, []).append((b, d)); G.setdefault(b, []).append((a, d))
# keep the largest connected street network so every place is reachable
seen, best = set(), set()
for s0 in G:
    if s0 in seen: continue
    comp, stack = {s0}, [s0]
    while stack:
        u = stack.pop()
        for v, _ in G[u]:
            if v not in comp: comp.add(v); stack.append(v)
    seen |= comp
    if len(comp) > len(best): best = comp
MAIN = best
def nearest_node(lat, lon):
    return min(MAIN, key=lambda n: (N[n][0] - lat) ** 2 + ((N[n][1] - lon) * COS) ** 2)
start = nearest_node(*HOME)
dist, prev = {start: 0.0}, {}
pq = [(0.0, start)]
while pq:
    d, u = heapq.heappop(pq)
    if d > dist[u]: continue
    for v, w_ in G[u]:
        nd_ = d + w_
        if nd_ < dist.get(v, 1e18):
            dist[v] = nd_; prev[v] = u; heapq.heappush(pq, (nd_, v))
AREAS = {'Ellen O. Moyer Nature Park': '416305780', 'Horn Point Park': '295764180', 'Truxtun Park': '200616372'}
def entry_node(name, lat, lon):
    # for a park, walk to the closest point where the street network meets it
    wid = AREAS.get(plain(name))
    if wid and wid in W:
        pg = closed_poly(W[wid]['nodes'])
        if pg is not None:
            near = [n for n in MAIN if n in dist and pg.distance(Point(pj(*N[n]))) < 1.2]
            if near: return min(near, key=lambda n: dist[n])
    return nearest_node(lat, lon)
def route(lat, lon, name=''):
    n = entry_node(name, lat, lon)
    if n not in dist: return None, None
    path = [n]
    while path[-1] != start: path.append(prev[path[-1]])
    path.reverse()
    end = (lat, lon) if plain(name) not in AREAS else tuple(N[n])
    pts = [pj(*HOME)] + [pj(*N[p]) for p in path] + [pj(*end)]
    meters = dist[n] + hav(HOME, N[start]) + hav(N[n], end)
    return LineString(pts).simplify(0.6), meters

# ---------- places ----------
# cat: eat, shop, park, see
PLACES = [
    ('eat', "Davis&#8217; Pub", '400 Chester Ave', 38.96915, -76.48024),
    ('eat', 'Boatyard Bar &amp; Grill', '400 4th St', 38.97132, -76.48260),
    ('eat', "Lewnes&#8217; Steakhouse", '401 4th St', 38.97162, -76.48228),
    ('eat', "O&#8217;Leary&#8217;s Seafood", '310 3rd St', 38.97248, -76.48193),
    ('eat', 'Rumhouse', '422 6th St', 38.96922, -76.48412),
    ('eat', 'Vin 909', '909 Bay Ridge Ave', 38.96677, -76.48839),
    ('eat', "Carrol&#8217;s Creek", '410 Severn Ave', 38.97172, -76.48396),
    ('eat', 'Chart House', '300 2nd St', 38.97393, -76.48183),
    ('shop', 'Leeward Market', '601 2nd St', 38.97033, -76.47780),
    ('shop', 'Eastport Liquors', '1007 Bay Ridge Ave', 38.96524, -76.48846),
    ('shop', 'Annapolis Market House', '25 Market Space', 38.97794, -76.48718),
    ('shop', 'Main Street shops', 'Main St, downtown', 38.97790, -76.48960),
    ('park', 'Horn Point Park', 'Eastport', 38.97315, -76.47658),
    ('park', 'Susan Campbell Park', 'City Dock', 38.97646, -76.48473),
    ('park', 'Truxtun Park', 'Hilltop Ln', 38.96669, -76.50174),
    ('see', 'U.S. Naval Academy', 'Gate 1, King George and Randall Sts', 38.97933, -76.48540),
    ('see', 'Maryland State House', '100 State Circle', 38.97889, -76.49102),
    ('see', 'City Dock and Ego Alley', 'Downtown waterfront', 38.97673, -76.48573),
    ('see', 'Annapolis Maritime Museum', '723 2nd St', 38.96890, -76.47633),
    ('see', 'Spa Creek Bridge', '6th St to Compromise St', 38.97271, -76.48549),
]
CATS = {'eat': 'Eat and drink', 'shop': 'Shops', 'park': 'Parks', 'see': 'Landmarks'}

def plain(s):
    return s.replace('&#8217;', "'").replace('&amp;', '&')

def build():
    from urllib.parse import quote_plus
    hx, hy = pj(*HOME)
    places = []
    for i, (cat, name, addr, lat, lon) in enumerate(PLACES):
        ln, m = route(lat, lon, name)
        x, y = pj(lat, lon)
        miles = m / 1609.344
        mins = max(1, round(miles * 20))
        q = quote_plus(f'{plain(name)}, {plain(addr)}, Annapolis, MD') if 'downtown' not in addr and 'Gate' not in addr else quote_plus(f'{plain(name)}, Annapolis, MD')
        places.append(dict(i=i, cat=cat, name=name, addr=addr, x=round(x, 1), y=round(y, 1), mins=mins, mi=round(miles, 1),
                           route=path_d(ln.coords, False, 1), q=q))
    # svg
    parts = [f'<svg class="am__svg" viewBox="0 0 {VW:.0f} {VH}" data-full="0 0 {VW:.0f} {VH}" role="img" aria-label="Map of Eastport and downtown Annapolis with nearby places">',
             f'<rect class="am__water" x="-400" y="-400" width="{VW + 800:.0f}" height="{VH + 800}"/>',
             f'<path class="am__land" d="{geom_d(land, 0.9)}"/>']
    if usna is not None: parts.append(f'<path class="am__usna" d="{geom_d(usna, 0.9)}"/>')
    if parks is not None: parts.append(f'<path class="am__park" d="{geom_d(parks, 0.7)}"/>')
    parts.append(f'<path class="am__pier" d="{geom_d(piers.intersection(FRAME), 0.4)}"/>')
    minor = unary_union(roads_minor).intersection(FRAME).simplify(0.7)
    major = unary_union(roads_major).intersection(FRAME).simplify(0.7)
    parts.append(f'<path class="am__road" d="{geom_d(minor, 0.7, close=False)}"/>')
    parts.append(f'<path class="am__road am__road--major" d="{geom_d(major, 0.7, close=False)}"/>')
    # area labels
    def L(text, lat, lon, cls='', rot=0):
        x, y = pj(lat, lon)
        tr = f' transform="rotate({rot} {x:.0f} {y:.0f})"' if rot else ''
        return f'<text class="am__area {cls}" x="{x:.0f}" y="{y:.0f}"{tr}>{text}</text>'
    parts.append('<g class="am__areas">' + ''.join([
        L('EASTPORT', 38.9665, -76.4855, 'am__area--town'),
        L('DOWNTOWN', 38.9800, -76.4950, 'am__area--town'),
        L('U.S. NAVAL ACADEMY', 38.9855, -76.4825, 'am__area--town'),
        L('Spa Creek', 38.9735, -76.4925, 'am__area--water', -18),
        L('Back Creek', 38.9622, -76.4755, 'am__area--water', -52),
        L('Severn River', 38.9842, -76.4665, 'am__area--water', -28),
    ]) + '</g>')
    parts.append('<path class="am__route" d=""/>')
    # markers, scaled by script so they stay the same size when zoomed
    for p in places:
        parts.append(f'<g class="am__pin am__pin--{p["cat"]}" data-i="{p["i"]}" transform="translate({p["x"]} {p["y"]})">'
                     f'<circle r="7"/><text class="am__pinlabel" x="12" y="4.5">{p["name"]}</text></g>')
    parts.append(f'<g class="am__home" transform="translate({hx:.1f} {hy:.1f})"><circle r="13"/><image href="assets/img/burgee.svg" x="-9" y="-5" width="18" height="10"/>'
                 f'<text x="0" y="30">Butler&#8217;s</text></g>')
    parts.append('</svg>')
    data = [{k: p[k] for k in ('i', 'cat', 'name', 'addr', 'x', 'y', 'mins', 'mi', 'route', 'q')} for p in places]
    return ''.join(parts), data, (hx, hy)

def markup():
    svg, data, home = build()
    rows = []
    for cat, label in CATS.items():
        items = sorted([p for p in data if p['cat'] == cat], key=lambda p: p['mi'])
        rows.append(f'<li class="am__group" data-cat="{cat}"><p class="am__ghead">{label}</p><ul>' + ''.join(
            f'<li><button type="button" class="am__item am__item--{cat}" data-i="{p["i"]}"><span class="am__name">{p["name"]}</span>'
            f'<span class="am__addr">{p["addr"]}</span><span class="am__walk">{p["mins"]} min walk</span></button></li>' for p in items) + '</ul></li>')
    tabs = ''.join(f'<button type="button" role="radio" data-cat="{c}" aria-checked="{"true" if c == "all" else "false"}">{l}</button>'
                   for c, l in [('all', 'All')] + list(CATS.items()))
    js = json.dumps({'home': [round(home[0], 1), round(home[1], 1)], 'places': data}, separators=(',', ':'))
    return f'''<div class="am" data-areamap>
  <div class="am__tabs" role="radiogroup" aria-label="Show places">{tabs}</div>
  <div class="am__grid">
    <div class="am__stage">
      {svg}
      <div class="am__zoom">
        <button type="button" data-zoom="home" aria-label="Show the whole area">Whole area</button>
      </div>
      <p class="am__credit">Map data &#169; OpenStreetMap contributors. Not for navigation.</p>
    </div>
    <div class="am__side">
      <div class="am__card" aria-live="polite">
        <p class="am__hint">Pick a place to see the walk from Butler&#8217;s.</p>
      </div>
      <ul class="am__list">{''.join(rows)}</ul>
    </div>
  </div>
  <script type="application/json" id="amData">{js}</script>
</div>'''

if __name__ == '__main__':
    m = markup()
    print('bytes', len(m), 'VH', VH)
    _, data, _ = build()
    for p in data: print(p['cat'], p['name'], p['mins'], 'min', p['mi'], 'mi')
