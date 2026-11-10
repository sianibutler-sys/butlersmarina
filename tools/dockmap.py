"""Interactive dock map, traced from the 2011 condominium plat (Charles P. Johnson & Associates).
Slip rectangles come from the scanned plat (plat/rects.json, 200 dpi, 1" = 20'), rotated so the
main pier runs left to right. Two orientations are emitted: wide for desktop, tall for phones."""
import json, math

R = {int(k): v for k, v in json.load(open('/home/claude/work/plat/rects.json')).items()}
LIFTS = {1, 3, 4, 5, 20, 24, 25, 26, 27, 28, 29}

TH = math.atan2(623, -396)
C, S = math.cos(-TH), math.sin(-TH)
def rot(p):
    x, y = p
    return (x * C - y * S, x * S + y * C)

# tidy slip 7 (its scan edge is skewed): rebuild as a rectangle on the row's axis
def bbox(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

SL = {}
for k, pts in R.items():
    x0, y0, x1, y1 = bbox([rot(p) for p in pts])
    SL[k] = [x0, y0, x1, y1]
# square up the rows so edges line up the way the docks do
for k in range(5, 15):
    SL[k][1], SL[k][3] = -1784, -1508
for k in range(2, 5):
    SL[k][1], SL[k][3] = -1783, -1637
for k in range(22, 30):
    SL[k][1], SL[k][3] = -1481, -1315
# shared walls: snap neighbours so there are no hairline gaps
def snap(row):
    for a, b in zip(row, row[1:]):
        m = (SL[a][2] + SL[b][0]) / 2
        SL[a][2] = SL[b][0] = m
snap([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]); snap([2, 3, 4]); snap([29, 28, 27, 26, 25, 24, 23, 22])
for k in (16, 17, 18, 19):
    SL[k][0] = 1158
SL[16][3] = SL[17][1] = (SL[16][3] + SL[17][1]) / 2
SL[17][3] = SL[18][1] = (SL[17][3] + SL[18][1]) / 2
SL[18][3] = SL[19][1] = (SL[18][3] + SL[19][1]) / 2

LOT = [(1310, 95), (1450, 188), (1190, 560), (1335, 650), (1400, 760), (1450, 815), (1440, 878), (1365, 885), (1310, 915),
       (1255, 965), (1230, 950), (1170, 875), (1110, 820), (1070, 828), (945, 900), (950, 1000), (905, 1050), (860, 1062),
       (800, 1075), (700, 1085), (615, 1095), (880, 730), (990, 680)]
BUILDING = [(1368, 138), (1452, 190), (1232, 470), (1160, 432)]
lot = [rot(p) for p in LOT]
bld = [rot(p) for p in BUILDING]
SHORE = lot[6:21]  # O ... A, the water side of the lot
FIRE = rot((812, 988))
# Chester Avenue: a band along the lot's street frontage
_a, _b = (1310, 95), (1450, 188)
_dx, _dy = _b[0] - _a[0], _b[1] - _a[1]; _L = math.hypot(_dx, _dy); _ux, _uy = _dx / _L, _dy / _L
_nx, _ny = _uy, -_ux   # outward, toward the street
_e0 = (_a[0] - _ux * 420, _a[1] - _uy * 420); _e1 = (_b[0] + _ux * 420, _b[1] + _uy * 420)
STREET = [rot(p) for p in (_e0, _e1, (_e1[0] + _nx * 70, _e1[1] + _ny * 70), (_e0[0] + _nx * 70, _e0[1] + _ny * 70))]
STREET_MID = rot(((_a[0] + _b[0]) / 2 + _nx * 35, (_a[1] + _b[1]) / 2 + _ny * 35))
PARK = rot((1180, 700))

PIERS = [
    (176, -1508, 1158, -1481),    # main pier
    (1036, -1578, 1158, -1481),   # landing at the end
    (1133, -1812, 1158, -1481),   # walk along slips 16 to 19
    (-13, -1637, 204, -1612),     # walk to slips 1 to 4
    (180, -1637, 204, -1481),     # link to the main pier
]

def P(pts, f):
    return ' '.join(f'{x:.0f},{y:.0f}' for x, y in (f(p) for p in pts))

def build(orient):
    """orient 'h' (pier left to right) or 'v' (pier top to bottom)."""
    if orient == 'h':
        f = lambda p: (p[0], p[1])
        vb = (-700, -1900, 2140, 940)
    else:
        f = lambda p: (-p[1], p[0])           # quarter turn clockwise
        vb = (1060, -660, 920, 2080)
    def rect(x0, y0, x1, y1):
        a, b = f((x0, y0)), f((x1, y1))
        return min(a[0], b[0]), min(a[1], b[1]), abs(a[0] - b[0]), abs(a[1] - b[1])
    x, y, w, h = vb
    land = SHORE + [(SHORE[-1][0] + 40, -900), (-900, -900), (-900, -2000), (-160, -2000)]
    out = [f'<svg class="dm__svg dm__svg--{orient}" viewBox="{x} {y} {w} {h}" role="group" aria-label="Map of the docks. {len(LIFTS)} of 29 slips have lifts.">',
           f'<rect class="dm__water" x="{x}" y="{y}" width="{w}" height="{h}"/>',
           f'<polygon class="dm__land" points="{P(land, f)}"/>',
           f'<polygon class="dm__lot" points="{P(lot, f)}"/>',
           f'<polygon class="dm__street" points="{P(STREET, f)}"/>',
           f'<polygon class="dm__bld" points="{P(bld, f)}"/>']
    for r in PIERS:
        rx, ry, rw, rh = rect(*r)
        out.append(f'<rect class="dm__pier" x="{rx:.0f}" y="{ry:.0f}" width="{rw:.0f}" height="{rh:.0f}"/>')
    fx, fy = f(FIRE)
    out.append(f'<circle class="dm__fire" cx="{fx:.0f}" cy="{fy:.0f}" r="14"/>')
    for k in sorted(SL):
        x0, y0, x1, y1 = SL[k]
        rx, ry, rw, rh = rect(x0 + 3, y0 + 3, x1 - 3, y1 - 3)
        lift = k in LIFTS
        cls = 'dm__slip' + (' is-lift' if lift else '')
        cx, cy = rx + rw / 2, ry + rh / 2
        label = f'Slip {k}' + (', lift slip' if lift else '')
        out.append(f'<g class="{cls}" data-slip="{k}" tabindex="0" role="button" aria-label="{label}">'
                   f'<rect x="{rx:.0f}" y="{ry:.0f}" width="{rw:.0f}" height="{rh:.0f}" rx="6"/>'
                   + (f'<path class="dm__lift" d="M{cx - 16:.0f} {cy + 22:.0f}h32M{cx - 16:.0f} {cy + 30:.0f}h32"/>' if lift else '')
                   + f'<text x="{cx:.0f}" y="{cy + 8:.0f}">{k}</text></g>')
    # context labels, always upright
    def lab(text, p, cls='dm__label', anchor='middle', turn=0):
        lx, ly = f(p)
        tr = f' transform="rotate({turn:.1f} {lx:.0f} {ly:.0f})"' if turn else ''
        return f'<text class="{cls}" x="{lx:.0f}" y="{ly:.0f}" text-anchor="{anchor}" dominant-baseline="middle"{tr}>{text}</text>'
    s0, s1 = f(STREET[0]), f(STREET[1])
    sang = math.degrees(math.atan2(s1[1] - s0[1], s1[0] - s0[0]))
    if sang > 90: sang -= 180
    if sang < -90: sang += 180
    bx = sum(p[0] for p in bld) / 4; by = sum(p[1] for p in bld) / 4
    if orient == 'h':
        out += [lab('Back Creek', (640, -1840), 'dm__label dm__label--water'),
                lab('Mixed-use building', (bx + 40, by - 112)), lab('Bathroom, laundry, offices', (bx + 40, by - 80), 'dm__label dm__label--sub'),
                lab('Parking', PARK), lab('Fire pit', (FIRE[0], FIRE[1] + 50)),
                lab('Chester Ave', STREET_MID, 'dm__label dm__label--street', turn=sang),
                lab('Main pier', (690, -1488), 'dm__label dm__label--pier')]
    else:
        out += [lab('Back Creek', (-1250, 640), 'dm__label dm__label--water'),
                lab('Parking', (PARK[0], PARK[1] + 120)), lab('Fire pit', (FIRE[0] - 50, FIRE[1])),
                lab('Mixed-use building', (-530, by - 80), anchor='start')]
    out.append('</svg>')
    return ''.join(out)

def markup(page):
    lifts_first = page == 'lifts'
    intro = ('Eleven slips have lifts. Tap one to see where it sits.' if lifts_first
             else 'Twenty-nine slips off one main pier. Lift slips are marked. Tap any slip for details.')
    return f'''<div class="dm{' dm--lifts' if lifts_first else ''}" data-dockmap>
  <div class="dm__bar">
    <div class="dm__view" role="radiogroup" aria-label="Show">
      <button type="button" role="radio" data-view="all" aria-checked="{'false' if lifts_first else 'true'}">All slips</button>
      <button type="button" role="radio" data-view="lifts" aria-checked="{'true' if lifts_first else 'false'}">Lift slips</button>
    </div>
  </div>
  <div class="dm__stage">
    {build('h')}
    {build('v')}
  </div>
  <div class="dm__foot">
    <ul class="dm__key" aria-hidden="true">
      <li><i class="k-lift"></i>Lift slip</li>
      <li><i class="k-slip"></i>Slip</li>
      <li><i class="k-pier"></i>Pier</li>
      <li><i class="k-land"></i>Butler&#8217;s property</li>
    </ul>
    <div class="dm__info" aria-live="polite">
      <p class="dm__pick">Pick a slip on the map.</p>
    </div>
  </div>
  <p class="dm__note">Drawn from the marina&#8217;s condominium plat. Slip outlines are approximate and not to scale for navigation.</p>
</div>'''

if __name__ == '__main__':
    open('/home/claude/work/plat/dm-test.html', 'w').write(markup('slips'))
    print(len(markup('slips')))
