"""Build the multi-page Butler's Marina site.

Pages are written with paths relative to the site root ("assets/...", "slips/", "./").
`rel()` rewrites them for each page's depth, so the same markup works on Cloudflare
and in the artifact preview. Run:  python3 site.py            -> /home/claude/butlersmarina
                                   python3 site.py preview DIR -> preview copy with explicit index.html links
"""
import re, sys, os, math, json
from dockmap import markup as dockmap
from compass import compass
FOOT_COMPASS = compass(0, 0, 40, label_size=16)
from areamap import markup as areamap, teaser as area_teaser
TEASE_SVG, TEASE_ROWS = area_teaser()

SRC = open('/home/claude/work/index.src.html').read()
LOGO = re.search(r'<svg class="logo".*?</svg>', SRC, re.S).group(0)
CHART = re.search(r'<svg class="chart".*?</svg>', SRC, re.S).group(0)
LAND = open('/home/claude/work/land.txt').read().strip()
PIERS = open('/home/claude/work/piers.txt').read().strip()
TIDES = open('/mnt/user-data/uploads/Downloads/butlers-marina-photos/bm-tides-8575512.txt').read().strip()
LEGAL = open('/home/claude/work/legal.py').read()
PRIVACY = re.search(r"PRIVACY = '''(.*?)'''", LEGAL, re.S).group(1)
TC = re.search(r"TC = '''(.*?)'''", LEGAL, re.S).group(1)

def catmull(points):
    d = f'M{points[0][0]} {points[0][1]}'
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]} {p2[1]}'
    return d
TRACK = catmull([(1130, 350), (900, 372), (700, 408), (602, 416), (540, 408), (500, 398), (468, 388), (446, 379)])
CHART = CHART.replace('{{LAND}}', LAND).replace('{{PIERS}}', PIERS).replace('{{TRACK}}', TRACK)

PHONE = '(410) 626-0051'
TEL = 'tel:+14106260051'
DIRECTIONS = 'https://www.google.com/maps/dir/?api=1&amp;destination=409+Chester+Avenue+Annapolis+MD+21403'
ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'

def q(t):  # contact link that preselects a request type
    return 'contact/?type=' + t.replace(' ', '+')

NAV = [('slips/', 'Slips'), ('lifts/', 'Lifts'), ('overnight/', 'Overnight'), ('amenities/', 'Amenities'),
       ('leasing/', 'Leasing'), ('location/', 'Location'), ('faq/', 'FAQ')]

def img(name, sizes_list, sizes, w, h, alt, cls='', lazy=True, prio=False):
    srcset = ', '.join(f'assets/photo/{name}-{s}.webp {s}w' for s in sizes_list)
    mid = sizes_list[len(sizes_list) // 2]
    a = f' class="{cls}"' if cls else ''
    extra = (' loading="lazy"' if lazy else '') + (' fetchpriority="high"' if prio else '')
    return f'<img{a} src="assets/photo/{name}-{mid}.webp" srcset="{srcset}" sizes="{sizes}" width="{w}" height="{h}" alt="{alt}"{extra}>'

PHOTOS = {
    'aerial-1': ([800, 1400, 2400], 2400, 1348),
    'aerial-2': ([900, 1800, 2400], 2400, 1348),
    'docks': ([800, 1600, 2000], 2000, 1333),
    'lift': ([800, 1400, 2000], 2000, 1333),
    'apt-living': ([800, 1000, 1600], 1600, 1067),
}

def phero(h1, sub, photo=None, alt='', pos='50% 50%', extra=''):
    if photo:
        sl, w, h = PHOTOS[photo]
        pic = img(photo, sl, '100vw', w, h, alt, cls='phero__photo', lazy=False, prio=True).replace('<img', f'<img style="object-position:{pos}"')
        cls = 'phero'
    else:
        pic = '<img class="phero__mark" src="assets/img/burgee.svg" width="304" height="166" alt="">'
        cls = 'phero phero--navy'
    return f'''<section class="{cls}" aria-labelledby="page-title">
  {pic}
  <div class="wrap phero__inner">
    <h1 id="page-title">{h1}</h1>
    <p class="phero__sub">{sub}</p>{extra}
  </div>
</section>
'''

CLOSE = f'''<section class="contact close" aria-labelledby="close-title">
  {img('docks', [800, 1600, 2000], '100vw', 2000, 1333, '', cls='contact__photo')}
  <div class="wrap close__inner">
    <h2 id="close-title">Come dock at Butler&#8217;s.</h2>
    <p>Tell us about your boat and what you need. For tonight or tomorrow, calling is fastest.</p>
    <div class="contact__ctas">
      <a class="btn btn--signal" href="contact/">Request a slip</a>
      <a class="btn btn--ghost" href="{TEL}">Call {PHONE}</a>
    </div>
  </div>
</section>
'''

RULE = '<span class="rule" aria-hidden="true"></span>'

# ---------- pages ----------

HOME = f'''<section class="hero" aria-labelledby="hero-title">
  {img('aerial-1', [800, 1400, 2400], '100vw', 2400, 1348, "Aerial view of Butler's Marina on Back Creek, with sailboats and powerboats in their slips", cls='hero__photo', lazy=False, prio=True)}
  <div class="hero__inner">
    <div class="hero__copy">
      <h1 id="hero-title">The best place to dock in Annapolis.</h1>
      <p class="hero__sub">A boutique marina on Back Creek, on the Eastport peninsula. Here since 1998.</p>
    </div>
    <nav class="hero__offer" aria-label="What we offer">
      <p>We offer</p>
      <a href="slips/">Annual slips</a>
      <a href="lifts/">Boat lifts</a>
      <a href="overnight/">Overnight dockage</a>
      <a href="leasing/">Residential and office leasing</a>
    </nav>

    <form class="finder" id="finder" action="contact/" method="get" novalidate aria-label="Check availability">
      <div class="finder__field">
        <label for="q-type">Looking for</label>
        <select id="q-type" name="type">
          <option value="Annual slip">Annual slip</option>
          <option value="Boat lift">Boat lift</option>
          <option value="Overnight stay" selected>Overnight dockage</option>
          <option value="Residential lease">Residential lease</option>
          <option value="Office lease">Office lease</option>
        </select>
      </div>
      <div class="finder__field" data-show="slip">
        <label for="q-loa">Boat length</label>
        <span class="finder__unit"><input id="q-loa" name="loa" type="number" inputmode="numeric" min="10" max="120" value="38"> ft</span>
      </div>
      <div class="finder__field" data-show="dates">
        <label for="q-arrive">Arriving</label>
        <input id="q-arrive" name="arrive" type="date">
      </div>
      <div class="finder__field" data-show="night">
        <label for="q-nights">Nights</label>
        <span class="finder__step">
          <button type="button" data-step="-1" aria-label="One fewer night">&#8722;</button>
          <input id="q-nights" name="nights" type="number" inputmode="numeric" min="1" max="30" value="2">
          <button type="button" data-step="1" aria-label="One more night">+</button>
        </span>
      </div>
      <div class="finder__est" data-show="night" aria-live="polite">
        <span id="q-est">$304</span>
        <small id="q-math">at $4 per foot per night, electricity included</small>
      </div>
      <button class="finder__go" type="submit"><span>Check availability</span>
        {ARROW}
      </button>
      <p class="finder__note" id="q-note" role="status"></p>
    </form>
  </div>
</section>

<section class="intro" aria-labelledby="intro-title">
  <div class="wrap">
    <div class="intro__head">
      <h2 id="intro-title">{RULE}Enjoy your stay to the fullest.</h2>
      <p>Butler&#8217;s Marina is a premier boutique marina, on the Eastport peninsula, for boat docking in Annapolis, Maryland featuring long term residential and office space leasing. Come dock at Butler&#8217;s Marina in Annapolis!</p>
    </div>
  </div>

  <div class="rail">
    <div class="rail__track" id="railTrack" tabindex="0" aria-label="Ways to dock at Butler's. Scroll sideways for more.">
      <article class="card">
        <div class="card__media">
          {img('aerial-2', [900, 1800], '(max-width: 700px) 86vw, 420px', 1800, 1011, 'Aerial view of the marina docks and Back Creek')}
          <p class="card__tag"><span>Quote on request</span>Boats 25 to 75 ft</p>
        </div>
        <h3>Annual slips</h3>
        <p>Make Butler&#8217;s your home port, on fixed docks close to the mouth of Back Creek.</p>
        <a class="card__link" href="slips/">See annual slips</a>
      </article>
      <article class="card">
        <div class="card__media">
          {img('lift', [800, 1400], '(max-width: 700px) 86vw, 420px', 1400, 933, 'A center-console boat raised on a lift beside the fixed dock')}
          <p class="card__tag"><span>7,000&#8211;30,000 lbs</span>Jet ski and tender lifts too</p>
        </div>
        <h3>Boat lifts</h3>
        <p>Keep the hull dry between trips. Lifts for boats, jet skis and small tenders.</p>
        <a class="card__link" href="lifts/">See the lifts</a>
      </article>
      <article class="card">
        <div class="card__media">
          {img('docks', [800, 1600], '(max-width: 700px) 86vw, 420px', 1600, 1067, 'A sailboat tied up at the docks with the marina buildings behind')}
          <p class="card__tag"><span>$4 <small>/ ft / night</small></span>Electricity included</p>
        </div>
        <h3>Overnight dockage</h3>
        <p>Stay a night or a week, upon availability, with electricity and every amenity included. Reserve ahead, or join the waiting list if your plans are flexible.</p>
        <a class="card__link" href="overnight/">How overnight stays work</a>
      </article>
      <article class="card">
        <div class="card__media">
          {img('apt-living', [800, 1600], '(max-width: 700px) 86vw, 420px', 1600, 1067, "The apartment's living room, with a wall of windows over the marina")}
          <p class="card__tag"><span>When available</span>Steps from the docks</p>
        </div>
        <h3>Residential and office leasing</h3>
        <p>Long term residential and office space leasing in the mixed-use building, with the marina out the windows.</p>
        <a class="card__link" href="leasing/">See the space</a>
      </article>
      <article class="card card--winter">
        <div class="card__media card__media--plain">
          <svg viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M60 14v92M20 37l80 46M20 83l80-46"/><path d="M50 20l10 10 10-10M50 100l10-10 10 10M14 48l14-4-4-14M106 72l-14 4 4 14M14 72l14 4-4 14M106 48l-14-4 4-14"/></g></svg>
          <p class="card__tag"><span>Open water</span>All winter</p>
        </div>
        <h3>Winter in the water</h3>
        <p>A de-icing system keeps the basin open through the cold months, so your boat stays in all year.</p>
        <a class="card__link" href="amenities/">See the amenities</a>
      </article>
    </div>
    <div class="rail__controls wrap">
      <button class="rail__btn" type="button" data-dir="-1" aria-label="Previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H6M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <button class="rail__btn" type="button" data-dir="1" aria-label="Next">{ARROW}</button>
    </div>
  </div>
</section>

<section class="split split--navy" aria-labelledby="story-title">
  <div class="split__media">
    {img('aerial-2', [900, 1800, 2400], '(max-width: 1020px) 100vw, 50vw', 2400, 1348, 'The marina grounds and docks from above, with Eastport behind')}
  </div>
  <div class="split__body">
    <h2 id="story-title">{RULE}Boutique by design</h2>
    <p class="split__lede">Twenty-nine slips, one main pier, and Eastport a short walk from the dock. Marcellous and Pier Butler opened Butler&#8217;s on Back Creek in 1998.</p>
    <nav class="go" aria-label="Plan your visit">
      <a href="amenities/"><span>Amenities</span><small>Bathroom, laundry, de-icing, parking</small>{ARROW}</a>
      <a href="location/"><span>Location</span><small>Getting here, and where to eat in Eastport</small>{ARROW}</a>
      <a href="faq/"><span>Questions</span><small>The ones we hear on the dock</small>{ARROW}</a>
    </nav>
  </div>
</section>

<section class="near" aria-labelledby="near-title">
  <div class="wrap near__grid">
    <div class="near__body">
      <h2 id="near-title">{RULE}A short walk from the dock</h2>
      <p class="split__lede">Dinner is minutes away in Eastport. Downtown and the Naval Academy are across the Spa Creek bridge.</p>
      <ul class="near__list">''' + TEASE_ROWS + f'''</ul>
      <a class="btn btn--navy" href="location/">Explore the area map</a>
    </div>
    <a class="near__map" href="location/" aria-label="Open the area map">
      ''' + TEASE_SVG + f'''
      <svg class="near__compass" viewBox="-60 -60 120 120" aria-hidden="true">''' + compass(0, 0, 36, label_size=15) + f'''</svg>
      <span class="near__tag">Walk times from Butler&#8217;s</span>
    </a>
  </div>
</section>
''' + CLOSE

SLIPS = phero('Annual slips', 'Make Butler&#8217;s your home port. Fixed docks for boats 25 to 75 feet, close to the mouth of Back Creek.', 'aerial-2', 'Aerial view of the marina docks and Back Creek', '50% 60%') + f'''
<section class="split split--light" aria-labelledby="slip-title">
  <div class="split__body">
    <h2 id="slip-title">{RULE}What comes with a slip</h2>
    <p class="split__lede">Send your boat&#8217;s length, beam and draft. We&#8217;ll find the slip that fits and send you a price.</p>
    <dl class="facts">
      <div><dt>Boats</dt><dd>25 to 75 ft</dd></div>
      <div><dt>Docks</dt><dd>29 fixed slips, thirteen with lifts</dd></div>
      <div><dt>Winter</dt><dd>In the water all year, with de-icing</dd></div>
      <div><dt>Lifts</dt><dd>7,000&#8211;30,000 lbs, plus jet ski and tender lifts</dd></div>
      <div><dt>Power</dt><dd>Electric metered at each slip</dd></div>
      <div><dt>Ashore</dt><dd>Bathroom, laundry, Wi-Fi, parking</dd></div>
    </dl>
    <p class="note">If we&#8217;re full, we&#8217;ll add you to the waiting list and call when a slip opens.</p>
    <div class="split__cta">
      <a class="btn btn--navy" href="{q('Annual slip')}">Request a quote</a>
      <a class="btn btn--line" href="lifts/">See the lifts</a>
    </div>
  </div>
  <div class="split__media split__media--frame">
    {img('docks', [800, 1600, 2000], '(max-width: 1020px) 100vw, 50vw', 2000, 1333, 'A sailboat tied up at the fixed docks with the marina buildings behind')}
  </div>
</section>

<section class="dmsec" id="dock-map" aria-labelledby="map-title">
  <div class="wrap">
    <div class="steps__head">
      <h2 id="map-title">{RULE}The dock map</h2>
      <p>Twenty-nine slips off one main pier, with the lift slips marked. Tap any slip for details.</p>
    </div>
    ''' + dockmap('slips') + '''
  </div>
</section>
''' + CLOSE

LIFTS = phero('Boat lifts', 'Lifts for boats from 7,000 to 30,000 lbs, plus jet ski lifts and small tender lifts.', 'lift', 'A center-console boat raised on a lift beside the fixed dock', '50% 45%') + f'''
<section class="steps" aria-labelledby="lift-title">
  <div class="wrap">
    <div class="steps__head">
      <h2 id="lift-title">{RULE}Three kinds of lift</h2>
      <p>Lifts are one of the first things boaters ask about, so we keep a range. Availability changes through the year.</p>
    </div>
    <ul class="steps__list kinds">
      <li>
        <p class="kinds__k">7,000&#8211;30,000 lbs</p>
        <h3>Boat lifts</h3>
        <p>For powerboats. Tell us your boat&#8217;s weight and we&#8217;ll match the lift.</p>
      </li>
      <li>
        <p class="kinds__k">Personal watercraft</p>
        <h3>Jet ski lifts</h3>
        <p>Keep a jet ski out of the water and ready to ride.</p>
      </li>
      <li>
        <p class="kinds__k">Dinghies</p>
        <h3>Tender lifts</h3>
        <p>Small tender lifts, so the dinghy stays dry and off your deck.</p>
      </li>
    </ul>
    <div class="split__cta">
      <a class="btn btn--navy" href="{q('Boat lift')}">Ask about a lift</a>
      <a class="btn btn--line" href="slips/">See annual slips</a>
    </div>
  </div>
</section>

<section class="dmsec" id="dock-map" aria-labelledby="map-title">
  <div class="wrap">
    <div class="steps__head">
      <h2 id="map-title">{RULE}Where the lifts are</h2>
      <p>Thirteen slips have lifts, along the main pier and the shore walk. Tap one to see where it sits.</p>
    </div>
    ''' + dockmap('lifts') + '''
  </div>
</section>
''' + CLOSE

OVERNIGHT = phero('Overnight dockage', '$4 per foot, per night, with electricity and every amenity included. Upon availability.', 'docks', 'A sailboat tied up at the docks with the marina buildings behind', '50% 55%') + f'''
<section class="steps" aria-labelledby="steps-title">
  <div class="wrap">
    <div class="steps__head">
      <h2 id="steps-title">{RULE}Overnight dockage in three steps</h2>
      <p>Overnight dockage is upon availability, so reserve ahead if you can. Flexible? Ask to join the waiting list.</p>
    </div>
    <ol class="steps__list">
      <li>
        <p class="steps__n">1</p>
        <h3>Request your dates</h3>
        <p>Send your boat&#8217;s length and dates, or call {PHONE}.</p>
      </li>
      <li>
        <p class="steps__n">2</p>
        <h3>We confirm your slip</h3>
        <p>We check availability and hold a slip that fits your boat.</p>
      </li>
      <li>
        <p class="steps__n">3</p>
        <h3>Tie up and settle in</h3>
        <p>Check in from 1:00 PM. Check out by 11:00 AM.</p>
      </li>
    </ol>
    <a class="btn btn--navy" href="{q('Overnight stay')}">Request overnight dates</a>
  </div>
</section>
''' + CLOSE

AMEN_ITEMS = [
    ('Full bathroom and laundry', 'Slip holders have a full bathroom and a washer and dryer in the mixed-use building, a short walk from the docks.'),
    ('Fixed docks and lifts', 'Fixed docks throughout. Boat lifts from 7,000 to 30,000 lbs, plus jet ski and small tender lifts. <a href="lifts/">See the lifts</a>'),
    ('Winter de-icing', 'The water stays open around the docks all winter, so your boat can stay in all year.'),
    ('Fire pit and grills', 'A fire pit with sitting areas, and grills on the grounds, for slip holders, overnight guests and residential tenants.'),
    ('Electric at every slip', 'Each slip has its own electric meter. Overnight stays include electricity in the nightly rate.'),
    ('Wi-Fi and cable', 'Connected at the slips.'),
    ('Off-street parking', 'Free off-street parking, plus parking on the property for slip holders with a Butler&#8217;s Marina sticker.'),
]
AMENITIES = phero('Amenities', 'Everything you need between trips is on the property. We&#8217;re here to help you enjoy your stay.', 'aerial-1', 'The marina from above, with boats in their slips', '50% 70%') + f'''
<section class="split split--navy" aria-labelledby="amen-title">
  <div class="split__media">
    {img('aerial-2', [900, 1800, 2400], '(max-width: 1020px) 100vw, 50vw', 2400, 1348, 'The marina grounds and docks from above, with Eastport behind')}
  </div>
  <div class="split__body">
    <h2 id="amen-title">{RULE}Rest and relaxation</h2>
    <ul class="amen-list">
      {''.join(f'<li><h3>{t}</h3><p>{d}</p></li>' for t, d in AMEN_ITEMS)}
    </ul>
  </div>
</section>
''' + CLOSE

LEASING = phero('Long term residential and office space leasing', 'In the mixed-use building on the property, with views over the marina.', 'apt-living', "The apartment's open living room and kitchen, facing the marina", '50% 50%') + f'''
<section class="split split--light" aria-labelledby="apt-title">
  <div class="split__body">
    <h2 id="apt-title">{RULE}Live and work by the water</h2>
    <p class="split__lede">The building has residential and office space available for long term lease. When a space opens up, we post it here first.</p>
    <div class="openings" id="openings">
      <p class="openings__label">Current openings</p>
      <ul class="openings__list" id="openingsList"></ul>
      <p class="openings__empty">None right now. Ask to hear about the next one first.</p>
    </div>
    <div class="split__cta">
      <a class="btn btn--navy" href="{q('Residential lease')}">Ask about residential</a>
      <a class="btn btn--line" href="{q('Office lease')}">Ask about office space</a>
    </div>
  </div>
  <div class="split__media split__media--grid">
    {img('apt-living', [800, 1600], '(max-width: 1020px) 100vw, 34vw', 1600, 1067, "The apartment's open living room and kitchen, facing the marina", cls='g1')}
    <img class="g2" src="assets/photo/apt-bed-1000.webp" width="1000" height="667" alt="Bedroom with a framed map above the bed" loading="lazy">
    <img class="g3" src="assets/photo/apt-kitchen-1000.webp" width="1000" height="667" alt="Room with built-in white storage and a framed schooner print" loading="lazy">
  </div>
</section>
''' + CLOSE

def maps(name, addr):
    from urllib.parse import quote_plus
    return 'https://www.google.com/maps/search/?api=1&amp;query=' + quote_plus(f'{name}, {addr}, Annapolis, MD 21403').replace('%26%238217%3B', '%27').replace('%26amp%3B', '%26')

EAT = [("Davis&#8217; Pub", 'Chester Ave at 4th St', 'Chester Ave and 4th St'),
       ('Boatyard Bar &amp; Grill', '400 4th St', '400 4th St'),
       ("Lewnes&#8217; Steakhouse", '401 4th St', '401 4th St'),
       ('Rumhouse', '422 6th St', '422 6th St'),
       ('Vin 909', '909 Bay Ridge Ave', '909 Bay Ridge Ave'),
       ("Carrol&#8217;s Creek", '410 Severn Ave', '410 Severn Ave'),
       ('Chart House', '300 2nd St', '300 2nd St')]
SHOP = [('Leeward Market', '601 2nd St', '601 2nd St'), ('Eastport Liquors', '1007 Bay Ridge Ave', '1007 Bay Ridge Ave')]

def places(rows):
    out = []
    for name, shown, qaddr in rows:
        qname = name.replace('&#8217;', "'").replace('&amp;', '&')
        out.append(f'<li><span>{name}</span><a href="{maps(qname, qaddr)}" target="_blank" rel="noopener">{shown}<span class="sr"> on Google Maps</span></a></li>')
    return '\n          '.join(out)

LOCATION = phero('On the Eastport peninsula', 'Boatyards, sail lofts and good food, all within walking distance. Downtown Annapolis and the Naval Academy are across the Spa Creek bridge.') + f'''
<section class="place" aria-labelledby="place-title">
  <div class="wrap">
    <div class="steps__head">
      <h2 id="place-title">{RULE}What&#8217;s nearby</h2>
      <p>Walk times start at our dock on Chester Avenue and follow the streets. Pick a place to see the way there.</p>
    </div>
    ''' + areamap() + f'''
    <p class="tide" id="tide"><span class="tide__now" id="tide-now">Annapolis tide</span> <span class="tide__next" id="tideNext"></span></p>
  </div>
  <div class="wrap place__here">
    <h2>{RULE}Getting here</h2>
    <div class="place__cols">
      <div>
        <h3>By water</h3>
        <p>Back Creek opens off the Severn River just inside the Bay. Call ahead and we&#8217;ll have your slip ready.</p>
        <p class="coords">38&#176; 58.1&#8242; N, 76&#176; 28.8&#8242; W</p>
      </div>
      <div>
        <h3>By land</h3>
        <p>409 Chester Avenue, Annapolis, MD 21403. Free off-street parking. Parking on the property is for slip holders, with a sticker from the marina.</p>
        <a class="link" href="{DIRECTIONS}" target="_blank" rel="noopener">Driving directions</a>
      </div>
    </div>
  </div>
</section>
''' + CLOSE

FAQS = [
    ('What size boats fit?', 'Boats from 25 to 75 feet. Send us your length, beam and draft and we&#8217;ll match you to a slip.'),
    ('What does an annual slip cost?', f'It depends on the slip. <a href="{q("Annual slip")}">Request a quote</a> or call {PHONE}.'),
    ('How many slips are there?', 'Twenty-nine, and thirteen of them have lifts. See them on the <a href="slips/#dock-map">dock map</a>.'),
    ('Are the docks floating or fixed?', 'Fixed. Every dock at Butler&#8217;s is a fixed dock.'),
    ('Do you have boat lifts?', f'Yes. Boat lifts for 7,000 to 30,000 lbs, plus jet ski lifts and small tender lifts. <a href="{q("Boat lift")}">Ask what&#8217;s open</a>.'),
    ('Can my boat stay in the water over the winter?', 'Yes. De-icers keep the water open around the docks all winter.'),
    ('How does overnight dockage work?', '$4 per foot per night, with electricity and every amenity included. Overnight dockage is upon availability, so reserve ahead if you can. Check in from 1:00 PM. Check out by 11:00 AM.'),
    ('Is there a waiting list?', 'Yes, for annual slips and overnight dockage. Ask to join it on the <a href="contact/">request form</a> and we&#8217;ll call when a slip opens.'),
    ('How is electric billed?', 'Each slip is metered individually, so annual slip holders pay for what their slip uses. Overnight stays include electricity in the $4 per foot rate.'),
    ('Is there a bathroom and laundry for slip holders?', 'Yes. A full bathroom and a washer and dryer in the mixed-use building on the property.'),
    ('Do you lease residential or office space?', 'Yes. The mixed-use building on the property has residential and office space available for long term lease. Openings are posted on the <a href="leasing/">leasing page</a>.'),
    ('Is there parking?', 'Yes. There&#8217;s free off-street parking. Parking on the property is for slip holders only, with a parking sticker provided by Butler&#8217;s Marina.'),
    ('Can the public use the fire pit?', 'No. The fire pit and grills are for slip holders, overnight guests and residential tenants.'),
    ('Are pets welcome?', 'Yes. Keep your pet on a leash and clean up after them.'),
    ('When did Butler&#8217;s open?', 'In 1998, founded by Marcellous and Pier Butler.'),
    ('Do you send texts?', 'Only if you opt in. Read our <a href="privacy/">SMS privacy policy</a> and <a href="tc/">messaging terms</a>.'),
]
def slug(t):
    t = re.sub(r'&#\d+;|&\w+;', '', t)
    return 'q-' + re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')[:48]

FAQ = phero('Questions we hear on the dock', f'Don&#8217;t see yours? Call {PHONE} or <a href="contact/">send us a note</a>.') + f'''
<section class="faq" aria-label="Questions and answers">
  <div class="wrap faq__one">
    <div class="faq__search" role="search">
      <label class="sr" for="faqQ">Search questions</label>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <input id="faqQ" type="search" placeholder="Search questions, like electric or winter" autocomplete="off">
    </div>
    <p class="faq__count" id="faqCount" role="status"></p>
    <div class="faq__list">
      {''.join(f'<details id="{slug(a)}"><summary>{a}</summary><p>{b}</p></details>' for a, b in FAQS)}
    </div>
    <p class="faq__none" id="faqNone" hidden>No question matches that yet. Call {PHONE} or <a href="contact/">send us a note</a>, and we&#8217;ll answer it.</p>
  </div>
</section>
''' + CLOSE

CONTACT = f'''<section class="contact contact--page" aria-labelledby="page-title">
  {img('docks', [800, 1600, 2000], '100vw', 2000, 1333, '', cls='contact__photo', lazy=False)}
  <div class="wrap contact__grid">
    <div class="contact__head">
      <h1 id="page-title">Come dock at Butler&#8217;s.</h1>
      <p>Tell us about your boat and what you need, and we&#8217;ll get back to you. For tonight or tomorrow, calling is fastest.</p>
      <div class="contact__ctas">
        <a class="btn btn--signal" href="{TEL}">Call {PHONE}</a>
        <a class="btn btn--ghost" href="mailto:info@butlersmarinaannapolis.com">Email us</a>
      </div>
      <p class="contact__addr">409 Chester Avenue, Annapolis, MD 21403<br><a href="{DIRECTIONS}" target="_blank" rel="noopener">Driving directions</a></p>
    </div>

    <form class="inq" id="inquiry" novalidate>
      <fieldset class="inq__types">
        <legend>I&#8217;m asking about</legend>
        <label><input type="radio" name="type" value="Annual slip" checked><span>Annual slip</span></label>
        <label><input type="radio" name="type" value="Boat lift"><span>Boat lift</span></label>
        <label><input type="radio" name="type" value="Overnight stay"><span>Overnight</span></label>
        <label><input type="radio" name="type" value="Residential lease"><span>Residential</span></label>
        <label><input type="radio" name="type" value="Office lease"><span>Office</span></label>
      </fieldset>
      <div class="inq__grid">
        <label class="f"><span>Name</span><input id="f-name" name="name" autocomplete="name" required></label>
        <label class="f"><span>Email</span><input id="f-email" name="email" type="email" autocomplete="email" required></label>
        <label class="f"><span>Phone</span><input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="(410) 555-0123"></label>
        <label class="f" data-for="boat"><span>Boat name and make</span><input id="f-boat" name="boat" placeholder="e.g. Blue Heron, Sea Ray 380"></label>
        <label class="f f--s" data-for="boat"><span>Length (ft)</span><input id="f-loa" name="loa" type="number" inputmode="decimal" min="0"></label>
        <label class="f f--s" data-for="boat"><span>Beam (ft)</span><input id="f-beam" name="beam" type="number" inputmode="decimal" min="0"></label>
        <label class="f f--s" data-for="boat"><span>Draft (ft)</span><input id="f-draft" name="draft" type="number" inputmode="decimal" min="0" step="0.1"></label>
        <label class="f" data-for="dates"><span>Arriving</span><input id="f-arrive" name="arrive" type="date"></label>
        <label class="f" data-for="dates"><span>Leaving</span><input id="f-depart" name="depart" type="date"></label>
        <label class="f f--w"><span id="f-msg-label">Anything else (optional)</span><textarea id="f-message" name="message" rows="3"></textarea></label>
        <div class="hp" aria-hidden="true"><label for="f-bm-x">Leave this blank</label><input id="f-bm-x" name="bm_x" type="text" tabindex="-1" autocomplete="off" data-1p-ignore data-lpignore="true" data-form-type="other"></div>
      </div>
      <label class="inq__sms">
        <input id="f-sms" type="checkbox" name="sms" value="yes">
        <span>Text me about my request and marina updates. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. Consent is not a condition of renting a slip. See our <a href="privacy/">privacy policy</a> and <a href="tc/">messaging terms</a>.</span>
      </label>
      <label class="inq__sms">
        <input id="f-news" type="checkbox" name="news" value="yes">
        <span>Email me marina news, like slip openings and events. Unsubscribe anytime. See our <a href="privacy/">privacy policy</a>.</span>
      </label>
      <p class="inq__fine">We&#8217;ll email you a copy of your request. Neither box is required to send it.</p>
      <div class="inq__check" id="inqCheck" data-sitekey="0x4AAAAAAF9hj-YQ0fUqg2QO"></div>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&amp;onload=bmCheck" async defer></script>
      <button class="btn btn--signal inq__send" type="submit">Send request</button>
      <p class="inq__status" id="inqStatus" role="status"></p>
    </form>
  </div>
</section>
'''

LD = '''<script type="application/ld+json">
  {"@context": "https://schema.org", "@type": "Marina", "name": "Butler's Marina", "alternateName": "Butler's Waterfront & Marina", "foundingDate": "1998",
   "founder": [{"@type": "Person", "name": "Marcellous Butler"}, {"@type": "Person", "name": "Pier Butler"}],
   "url": "https://butlersmarinaannapolis.com/", "telephone": "+1-410-626-0051", "email": "info@butlersmarinaannapolis.com",
   "address": {"@type": "PostalAddress", "streetAddress": "409 Chester Avenue", "addressLocality": "Annapolis", "addressRegion": "MD", "postalCode": "21403", "addressCountry": "US"},
   "geo": {"@type": "GeoCoordinates", "latitude": 38.9689, "longitude": -76.4802},
   "sameAs": ["https://www.facebook.com/butlersmarina", "https://www.instagram.com/butlers_marina", "https://twitter.com/butlersmarina"]}
  </script>'''

# slug, nav key, title, description, body, extra head, extra body end, body class
PAGES = [
    ('', None, "Butler's Marina | Boutique marina on Back Creek, Eastport, Annapolis",
     'Butler&#8217;s Marina is a premier boutique marina, on the Eastport peninsula, for boat docking in Annapolis, Maryland featuring long term residential and office space leasing. Come dock at Butler&#8217;s Marina in Annapolis!', HOME, LD, '', ''),
    ('slips', 'slips/', "Annual slips | Butler's Marina, Annapolis",
     'Annual boat slips on fixed docks in Eastport, Annapolis, for boats 25 to 75 feet. In the water all winter with de-icing.', SLIPS, '', '', ''),
    ('lifts', 'lifts/', "Boat lifts | Butler's Marina, Annapolis",
     'Boat lifts for 7,000 to 30,000 lbs, jet ski lifts and small tender lifts at Butler&#8217;s Marina in Eastport, Annapolis.', LIFTS, '', '', ''),
    ('overnight', 'overnight/', "Overnight dockage | Butler's Marina, Annapolis",
     'Overnight and transient dockage in Annapolis at $4 per foot per night, electricity included, upon availability.', OVERNIGHT, '', '', ''),
    ('amenities', 'amenities/', "Amenities | Butler's Marina, Annapolis",
     'Full bathroom and laundry, fixed docks and lifts, electric metered at each slip, winter de-icing, fire pit and grills, Wi-Fi and free off-street parking.', AMENITIES, '', '', ''),
    ('leasing', 'leasing/', "Residential and office leasing | Butler's Marina, Annapolis",
     'Long term residential and office space leasing in the mixed-use building at Butler&#8217;s Marina, Eastport, Annapolis.', LEASING, '', '', ''),
    ('location', 'location/', "Location | Butler's Marina, Eastport, Annapolis",
     '409 Chester Avenue on Back Creek, Eastport. Directions by water and land, and where to eat nearby.', LOCATION, '',
     f'<script type="text/plain" id="tideData">{TIDES}</script>\n', ''),
    ('faq', 'faq/', "Questions | Butler's Marina, Annapolis",
     'Answers on slip sizes, fixed docks, lifts, winter storage, overnight rates, the waiting list and leasing.', FAQ, '', '', ''),
    ('contact', 'contact/', "Request a slip | Butler's Marina, Annapolis",
     'Request an annual slip, a boat lift, overnight dates or a lease at Butler&#8217;s Marina. Or call (410) 626-0051.', CONTACT, '', '', ''),
    ('privacy', None, "SMS privacy policy | Butler's Marina", 'SMS privacy policy for Butler&#8217;s Waterfront &amp; Marina.',
     f'<div class="legal"><div class="wrap">{PRIVACY}</div></div>', '', '', 'legal-page'),
    ('unsubscribe', None, "Unsubscribe | Butler's Marina", '',
     '<div class="legal"><div class="wrap"><h1>Unsubscribe</h1><div id="unsub"><p>Stop marina news emails to <strong id="unsubEmail">your address</strong>?</p>'
     '<p><button class="btn btn--navy" type="button" id="unsubGo">Unsubscribe</button></p>'
     '<p class="unsub__msg" id="unsubMsg" role="status"></p>'
     '<p>To stop texts, reply STOP to any text from us. Questions: <a href="mailto:info@butlersmarinaannapolis.com">info@butlersmarinaannapolis.com</a> or (410) 626-0051.</p></div></div></div>',
     '<meta name="robots" content="noindex">',
     '''<script>
(function () {
  var q = new URLSearchParams(location.search), e = q.get("e") || "", t = q.get("t") || "";
  var em = document.getElementById("unsubEmail"), go = document.getElementById("unsubGo"), msg = document.getElementById("unsubMsg");
  if (!e || !t) { go.hidden = true; msg.textContent = "This link is missing details. Email info@butlersmarinaannapolis.com and we\u2019ll take you off the list."; return; }
  em.textContent = e;
  go.addEventListener("click", function () {
    go.disabled = true; msg.textContent = "Updating\u2026";
    fetch("/api/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ e: e, t: t }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw j; }); })
      .then(function () { go.hidden = true; msg.textContent = "Done. You won\u2019t get marina news emails at " + e + " anymore."; })
      .catch(function (j) { go.disabled = false; msg.textContent = (j && j.error) || "That didn\u2019t go through. Try again, or email info@butlersmarinaannapolis.com."; });
  });
})();
</script>
''', 'legal-page'),
    ('tc', None, "Messaging terms | Butler's Marina", 'Messaging terms for Butler&#8217;s Waterfront &amp; Marina.',
     f'<div class="legal"><div class="wrap">{TC}</div></div>', '', '', 'legal-page'),
]
NOTFOUND = ('404', None, "Page not found | Butler's Marina", '', '<div class="legal"><div class="wrap"><h1>That slip is empty.</h1>\n<p>The site was rebuilt, so older links may not point anywhere now. Head <a href="./">back to the marina</a> or call (410) 626-0051.</p></div></div>', '', '', 'legal-page')

def page(slug, key, title, desc, body, head_extra, end_extra, body_cls):
    nav = '\n    '.join(
        f'<a href="{h}" aria-current="page" class="is-here">{t}</a>' if h == key else f'<a href="{h}">{t}</a>' for h, t in NAV)
    canon = f'https://butlersmarinaannapolis.com/{slug + "/" if slug else ""}'
    canon_tag = '' if slug == '404' else f'<link rel="canonical" href="{canon}">\n  '
    descr = f'<meta name="description" content="{desc}">\n  ' if desc else ''
    splash = '' if body_cls else '''<div class="splash" id="splash" aria-hidden="true">
  <div class="splash__inner">
    <div class="splash__flag"><img src="assets/img/burgee.svg" width="304" height="166" alt=""></div>
    <img class="splash__word" src="assets/img/wordmark.svg" width="348" height="62" alt="">
  </div>
</div>
'''
    splash_js = '' if body_cls else '''<script>
    (function () {
      // once per visit: marked as seen the moment it shows, in a cookie and in storage, so any page after it skips it
      var d = document.documentElement, seen = /(^|; )bm_splash=1/.test(document.cookie);
      try { seen = seen || sessionStorage.getItem("bm-splash") === "1" || Date.now() - (+localStorage.getItem("bm-splash-at") || 0) < 432e5; } catch (e) {}
      if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      document.cookie = "bm_splash=1; path=/; max-age=43200; SameSite=Lax";
      try { sessionStorage.setItem("bm-splash", "1"); localStorage.setItem("bm-splash-at", String(Date.now())); } catch (e) {}
      d.classList.add("splash-on");
    })();
  </script>
  '''
    bcls = f' class="{body_cls}"' if body_cls else ''
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{title}</title>
  {descr}{canon_tag}<meta property="og:type" content="website">
  <meta property="og:site_name" content="Butler's Marina">
  <meta property="og:title" content="{title.split(' | ')[0] if slug else "Butler's Marina"}">
  <meta property="og:description" content="The best place to dock in Annapolis. A boutique marina on Back Creek in Eastport, since 1998.">
  <meta property="og:url" content="{canon}">
  <meta property="og:image" content="https://butlersmarinaannapolis.com/assets/img/share-logo.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://butlersmarinaannapolis.com/assets/img/share-logo.png">
  <meta name="theme-color" content="#0D1A2B">
  <link rel="icon" href="assets/img/burgee.svg" type="image/svg+xml">
  <link rel="icon" href="assets/img/favicon-64.png" type="image/png" sizes="64x64">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  <link rel="preload" href="assets/fonts/hanken.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/source-serif.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="styles.css">
  {splash_js}{head_extra}
</head>
<body{bcls}>
<a class="skip" href="#main">Skip to content</a>

{splash}
<header class="bar" id="top">
  <a class="brand" href="./" aria-label="Butler's Marina, home">
    {LOGO}
  </a>
  <nav id="nav" class="bar__nav" aria-label="Main">
    {nav}
    <a class="bar__navphone" href="{TEL}">Call {PHONE}</a>
  </nav>
  <button class="bar__search" type="button" aria-label="Search the site" aria-controls="srch" aria-expanded="false" data-search-open><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Search</span></button>
  <a class="bar__call" href="{TEL}">{PHONE}</a>
  <a class="btn btn--signal bar__cta" href="contact/">Request a slip</a>
  <button class="bar__menu" type="button" aria-expanded="false" aria-controls="nav"><span class="sr">Menu</span><span class="bar__lines" aria-hidden="true"></span></button>
</header>

<div class="srch" id="srch" hidden>
  <div class="srch__scrim" data-search-close></div>
  <div class="srch__panel" role="dialog" aria-modal="true" aria-label="Search the site">
    <div class="srch__inner">
      <form class="srch__form" role="search" onsubmit="return false">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <label class="sr" for="srchQ">Search the site</label>
        <input id="srchQ" type="search" placeholder="Search slips, lifts, rates, places" autocomplete="off" spellcheck="false" aria-controls="srchList" aria-autocomplete="list">
        <button class="srch__close" type="button" data-search-close aria-label="Close search">Close</button>
      </form>
      <ul class="srch__list" id="srchList" role="listbox" aria-label="Results"></ul>
      <p class="srch__empty" id="srchEmpty" hidden>Nothing matches that. Call {PHONE} and we&#8217;ll help.</p>
      <p class="srch__hint" id="srchHint">Try <button type="button" data-q="electric">electric</button>, <button type="button" data-q="lift">lift</button>, <button type="button" data-q="winter">winter</button>, <button type="button" data-q="parking">parking</button> or <button type="button" data-q="State House">State House</button>.</p>
      <a id="siteRoot" href="./" hidden></a>
    </div>
  </div>
</div>

<main id="main">
{body}
</main>

<nav class="dock-bar" aria-label="Quick actions">
  <a href="{TEL}">Call</a>
  <a href="{DIRECTIONS}" target="_blank" rel="noopener">Directions</a>
  <a class="dock-bar__main" href="contact/">Request a slip</a>
</nav>

<footer class="foot">
  <div class="wrap foot__grid">
    <div class="foot__brand">
      <img class="foot__logo" src="assets/img/logo-light.svg" width="352" height="248" alt="Butler's Marina, Annapolis Maryland">
      <p class="foot__fix"><svg class="foot__compass" viewBox="-60 -60 120 120" aria-hidden="true">{FOOT_COMPASS}</svg><span>38&#176; 58.1&#8242; N<br>76&#176; 28.8&#8242; W</span></p>
    </div>
    <div>
      <p class="foot__h">Dock</p>
      <p><a href="slips/">Annual slips</a><br><a href="lifts/">Boat lifts</a><br><a href="overnight/">Overnight dockage</a><br><a href="leasing/">Leasing</a></p>
    </div>
    <div>
      <p class="foot__h">Visit</p>
      <p>409 Chester Avenue<br>Annapolis, MD 21403<br><a href="{DIRECTIONS}" target="_blank" rel="noopener">Directions</a></p>
    </div>
    <div>
      <p class="foot__h">Contact</p>
      <p><a href="{TEL}">{PHONE}</a><br><a href="mailto:info@butlersmarinaannapolis.com">info@butlersmarinaannapolis.com</a><br><a href="https://www.instagram.com/butlers_marina" target="_blank" rel="noopener">Instagram</a> &#183; <a href="https://www.facebook.com/butlersmarina" target="_blank" rel="noopener">Facebook</a></p>
    </div>
  </div>
  <div class="wrap foot__base">
    <span>&#169; <span id="yr">2026</span> Butler&#8217;s Waterfront &amp; Marina. A boutique marina on Back Creek since 1998.</span>
    <span class="foot__legal"><a href="privacy/">Privacy</a><a href="tc/">Messaging terms</a></span>
    <span class="by-sc">Site by <img src="assets/img/siani-creates.png" alt="Siani Creates" width="35" height="13"></span>
  </div>
</footer>

{end_extra}<script src="script.js" defer></script>
</body>
</html>
'''

ATTR = re.compile(r'\b(href|src|action|srcset|imagesrcset)="([^"]*)"')
def rel(html, depth, mode):
    """mode: 'site' (relative, directory links), 'abs' (root-absolute, for 404), 'preview' (relative, explicit index.html)"""
    pre = '/' if mode == 'abs' else '../' * depth
    def fix(u):
        if re.match(r'^(https?:|mailto:|tel:|data:|#|/)', u) or not u:
            return u
        path, _, qs = u.partition('?')
        if path == './':
            path = ''
        if mode == 'preview' and (path == '' or path.endswith('/')):
            path += 'index.html'
        out = pre + path
        if out == '':
            out = './'
        return out + ('?' + qs if qs else '')
    def sub(m):
        k, v = m.group(1), m.group(2)
        if k in ('srcset', 'imagesrcset'):
            v = ', '.join(' '.join([fix(p.split(' ')[0])] + p.split(' ')[1:]) for p in v.split(', '))
        else:
            v = fix(v)
        return f'{k}="{v}"'
    return ATTR.sub(sub, html)

def strip(h):
    h = re.sub(r'<(script|style|svg)\b.*?</\1>', ' ', h, flags=re.S)
    h = re.sub(r'<[^>]+>', ' ', h)
    import html as _h
    return re.sub(r'\s+([.,;:])', r'\1', re.sub(r'\s+', ' ', _h.unescape(h))).strip()

def search_index():
    from areamap import PLACES, CATS
    idx = []
    skip = {'unsubscribe'}
    for slug_, key, title, desc, body, *_ in PAGES:
        if slug_ in skip: continue
        url = (slug_ + '/') if slug_ else ''
        name = title.split(' | ')[0] if slug_ else "Butler's Marina"
        if slug_ in ('privacy', 'tc'):
            idx.append({'t': name, 'u': url, 's': 'Page', 'x': strip(desc)}); continue
        h1 = re.search(r'<h1[^>]*>(.*?)</h1>', body, re.S)
        sub = re.search(r'class="phero__sub">(.*?)</p>', body, re.S)
        idx.append({'t': name if slug_ else "Butler's Marina, home", 'u': url, 's': 'Page', 'x': (strip(h1.group(1)) + ' ' if h1 else '') + strip(desc) + (' ' + strip(sub.group(1)) if sub else '')})
        if slug_ == 'faq':
            for q, a in FAQS:
                idx.append({'t': strip(q), 'u': 'faq/#' + slug(q), 's': 'Question', 'x': strip(a)})
            continue
        if slug_ == 'location':
            for i, (cat, n, addr, *_r) in enumerate(PLACES):
                idx.append({'t': strip(n), 'u': f'location/?place={i}', 's': CATS[cat], 'x': strip(addr)})
        # one entry per section heading on the page
        parts = re.split(r'(<h2\b[^>]*>.*?</h2>)', body, flags=re.S)
        for j in range(1, len(parts), 2):
            h = parts[j]; nxt = parts[j + 1] if j + 1 < len(parts) else ''
            hid = re.search(r'id="([^"]+)"', h)
            t = strip(h)
            if not t or t.startswith('Come dock'): continue
            idx.append({'t': t, 'u': url + ('#' + hid.group(1) if hid else ''), 's': name if slug_ else 'Home', 'x': strip(nxt)[:700]})
    return idx

def build(out, mode='site'):
    os.makedirs(os.path.join(out, 'assets'), exist_ok=True)
    import hashlib
    sj = json.dumps(search_index(), ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(out, 'assets', 'search.json'), 'w').write(sj)
    # version stamps so browsers fetch fresh CSS, JS and search index after every change
    REPO = '/home/claude/butlersmarina'
    ver = lambda b: hashlib.sha1(b).hexdigest()[:8]
    vcss = ver(open(f'{REPO}/styles.css', 'rb').read()); vjs = ver(open(f'{REPO}/script.js', 'rb').read()); vidx = ver(sj.encode())
    def stamp(h):
        return (h.replace('styles.css"', f'styles.css?v={vcss}"', 1).replace('script.js"', f'script.js?v={vjs}"', 1)
                 .replace('<html lang="en">', f'<html lang="en" data-sv="{vidx}">', 1))
    for p in PAGES:
        slug = p[0]
        depth = 1 if slug else 0
        html = stamp(rel(page(*p), depth, mode))
        assert '{{' not in html, slug
        d = os.path.join(out, slug) if slug else out
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'index.html'), 'w').write(html)
    if mode == 'site':
        open(os.path.join(out, '404.html'), 'w').write(stamp(rel(page(*NOTFOUND), 0, 'abs')))
    print('built', out, mode)

if __name__ == '__main__':
    if len(sys.argv) > 2 and sys.argv[1] == 'preview':
        build(sys.argv[2], 'preview')
    else:
        build('/home/claude/butlersmarina')
