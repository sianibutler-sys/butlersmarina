# Butler's Marina

Website for Butler's Marina (Butler's Waterfront & Marina), 409 Chester Avenue, Annapolis, MD 21403. Family-run on Back Creek in Eastport since 1998.

Built by Siani Creates. Static HTML/CSS/JS on Cloudflare Pages, with two Pages Functions.

## Files

- `index.html` – the whole site, one page
- `styles.css`, `script.js`
- `privacy/` and `tc/` – SMS privacy policy and messaging terms. These keep their old URLs (`/privacy/`, `/tc/`) because the text-messaging registration points to them. Wording is unchanged from the old site.
- `404.html`
- `_redirects` – old WordPress page URLs forward to the matching section
- `functions/api/inquiry.js` – the request form, writes to Airtable
- `functions/api/conditions.js` – live tide, water temperature and wind from NOAA station 8575512 (Annapolis), cached 6 minutes
- `functions/_middleware.js` – keeps `*.pages.dev` preview addresses out of Google and points share previews at whatever host serves the page
- `assets/img/` – photos, the burgee mark, share card
- `assets/fonts/` – Newsreader and Barlow Semi Condensed, self-hosted

## Deploy on Cloudflare Pages

1. Pages > Create > Connect to Git > `butlersmarina`, branch `main`
2. Framework preset: None. Build command: blank. Output directory: `/`
3. Settings > Variables and secrets (Production):
   - `AIRTABLE_TOKEN` – personal access token, scope `data.records:write`, access to the marina base
   - `AIRTABLE_BASE` – base ID (`app…`)
   - `AIRTABLE_TABLE` – `Requests`
4. Custom domain: `butlersmarinaannapolis.com` and `www`. Point DNS at Pages only when the site is approved, since this replaces the live WordPress site.

Until the Airtable variables are set, the form opens the visitor's email app with the request filled in, addressed to info@butlersmarinaannapolis.com.

## Airtable table: Requests

| Field | Type |
| --- | --- |
| Name | Single line text |
| Email | Email |
| Phone | Phone |
| Type | Single select: Annual slip, Overnight stay, Apartment, Office space |
| Boat | Single line text |
| Length (ft) | Number |
| Beam (ft) | Number |
| Draft (ft) | Number |
| Arriving | Date |
| Leaving | Date |
| Message | Long text |
| SMS consent | Checkbox |
| Status | Single select: New, Quoted, Booked, Waitlist, Passed |

Automation: when a record is created, email info@butlersmarinaannapolis.com with the request.

## Splash screen

The burgee unfurls once per visit (sessionStorage `bm-splash`), then lifts away after about two seconds. Tap or any key skips it. It never shows with reduced motion, and CSS ends it on its own if the script fails, so it can't trap a visitor. The burgee and full logo are traced vectors of the brand files: `assets/img/burgee.svg` and `assets/img/logo.svg`.

## Built for three visitors

The hero routes slip holders, overnight cruisers and renters to their sections. On phones, a bar at the bottom keeps Call, Directions and Request a slip one tap away. The header keeps the phone number visible on desktop.

## Openings

Apartment and office openings live in `OPENINGS` at the top of `script.js`. Add one line per opening; leave the list empty when nothing is open and the box asks visitors to get in touch.

## The tide clock

Tide predictions for NOAA station 8575512 through December 31, 2027 are embedded in `index.html` (`#tideData`), so the clock always works. `/api/conditions` adds live water level, water temperature and wind, and refreshes the next 48 hours of predictions. Before the end of 2027, rebuild with a fresh year of predictions.

## Signal flags

The hero hoist spells W-E-L-C-O-M-E and the footer spells B-U-T-L-E-R-S in International Code of Signals flags, defined as SVG symbols at the top of `index.html`.

## The chart

The "Coming in" section is a chart of Back Creek drawn from OpenStreetMap shoreline and pier data, projected into an SVG (1200 × 1057 units, lon −76.500 to −76.446, lat 38.945 to 38.982). Butler's sits at about (446, 379), checked against the US Census geocoder and OpenStreetMap. The orange course line is the `track` path; its waypoints are all in open water. The chart is marked "Not for navigation".

- The course line draws in from the Bay when the chart scrolls into view. It is fully drawn at rest, and reduced motion skips the animation.
- Phones get a tighter view of the creek (`viewBox` set in `script.js`).

## Changing rates or details

- Overnight rate: `RATE` in `script.js`, plus the "$3" in the Overnight section and FAQ of `index.html`
- Slip size range: `MIN` and `MAX` in `script.js`, plus the copy in `index.html`
- Check-in and check-out times: Overnight section and FAQ in `index.html`
