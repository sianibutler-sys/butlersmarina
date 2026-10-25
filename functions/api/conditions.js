// Cloudflare Pages Function: GET /api/conditions
// Current tide, next high and low, water temperature and wind from NOAA station 8575512 (Annapolis).
// Cached at the edge for 6 minutes, which matches how often NOAA posts new readings.

const STATION = '8575512';
const BASE = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${STATION}&time_zone=lst_ldt&units=english&format=json&application=butlersmarina`;

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL('/api/conditions', request.url).toString());
  const hit = await cache.match(key);
  if (hit) return hit;

  const get = (q) => fetch(BASE + q, { cf: { cacheTtl: 300 } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [wl, hilo, wt, wd] = await Promise.all([
    get('&product=water_level&date=latest&datum=MLLW'),
    get('&product=predictions&interval=hilo&datum=MLLW&date=today&range=48'),
    get('&product=water_temperature&date=latest'),
    get('&product=wind&date=latest')
  ]);

  const level = wl?.data?.[0];
  const water = wt?.data?.[0];
  const wind = wd?.data?.[0];
  const body = {
    station: STATION,
    level: level ? parseFloat(level.v) : null,
    time: level?.t ?? null,
    hilo: (hilo?.predictions ?? []).map((p) => ({ t: p.t, type: p.type, v: parseFloat(p.v) })),
    water: water ? parseFloat(water.v) : null,
    wind: wind ? { dir: wind.dr, kt: parseFloat(wind.s), gust: parseFloat(wind.g) } : null
  };

  const res = new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=360' }
  });
  if (body.level != null) waitUntil(cache.put(key, res.clone()));
  return res;
}
