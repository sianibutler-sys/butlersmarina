// Cloudflare Pages Function: POST /api/inquiry
// Sends a slip, lift, overnight or leasing request to the marina's Google Sheet.
// The sheet runs a small Apps Script (tools/sheets-inquiry.gs) that adds the row
// and emails info@butlersmarinaannapolis.com.
// Set these in Cloudflare Pages > Settings > Variables and secrets:
//   SHEETS_URL     the Apps Script web app URL (ends in /exec)
//   SHEETS_SECRET  the same secret written in the script

const TYPES = ['Annual slip', 'Boat lift', 'Overnight stay', 'Residential lease', 'Office lease'];

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  if (data.company_site) return json({ ok: true }); // honeypot

  const fields = check(data);
  if (Object.keys(fields).length) return json({ error: 'Some fields need fixing', fields }, 400);
  if (!env.SHEETS_URL || !env.SHEETS_SECRET) {
    return json({ error: 'Form not configured' }, 503);
  }

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : '';
  };
  const row = {
    secret: env.SHEETS_SECRET,
    received: new Date().toISOString(),
    type: data.type,
    name: clip(data.name, 120),
    email: clip(data.email, 160),
    phone: fmtPhone(data.phone),
    boat: clip(data.boat, 160),
    loa: num(data.loa),
    beam: num(data.beam),
    draft: num(data.draft),
    arrive: isDate(data.arrive) ? data.arrive : '',
    depart: isDate(data.depart) ? data.depart : '',
    message: clip(data.message, 4000),
    sms: data.sms === 'yes' ? 'Yes' : 'No',
    page: clip(request.headers.get('Referer') || '', 300)
  };

  let ok = false;
  try {
    const res = await fetch(env.SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
      redirect: 'follow'
    });
    const out = await res.json().catch(() => ({}));
    ok = res.ok && out.ok === true;
  } catch {}
  if (!ok) return json({ error: 'Could not save request' }, 502);
  return json({ ok: true });
}

// The same rules the form checks in the browser, so nothing incomplete gets through.
const BOAT = /slip|Overnight|lift/;
function check(d) {
  const e = {};
  const t = d.type;
  const num = (k) => parseFloat(d[k]);
  const str = (k) => (typeof d[k] === 'string' ? d[k].trim() : '');
  if (!TYPES.includes(t)) e.type = 'Choose what you’re asking about.';
  if (str('name').replace(/[^A-Za-zÀ-ÿ]/g, '').length < 2) e.name = 'Add your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(str('email'))) e.email = 'Add an email we can reply to.';
  let ph = str('phone').replace(/\D/g, '');
  if (ph.length === 11 && ph[0] === '1') ph = ph.slice(1);
  if (ph.length !== 10) e.phone = 'Add a 10-digit phone number.';
  if (BOAT.test(t)) {
    const lo = t === 'Boat lift' ? 8 : 25;
    if (str('boat').length < 2) e.boat = 'Add the boat’s name or make.';
    if (!(num('loa') >= lo && num('loa') <= 75)) e.loa = t === 'Boat lift' ? 'Length in feet, up to 75.' : 'Our slips fit 25 to 75 ft.';
    if (!(num('beam') >= 3 && num('beam') <= 25)) e.beam = 'Beam in feet.';
    if (!(num('draft') >= 0.5 && num('draft') <= 12)) e.draft = 'Draft in feet.';
  }
  if (t === 'Overnight stay') {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
    if (!isDate(d.arrive) || d.arrive < today) e.arrive = 'Pick an arrival date, today or later.';
    if (!isDate(d.depart) || d.depart <= d.arrive) e.depart = 'Pick a date after you arrive.';
  }
  const msg = str('message');
  if (t === 'Boat lift' && msg.length < 4) e.message = 'Add the boat’s weight so we can match a lift.';
  if (/lease/.test(t) && msg.length < 10) e.message = 'Tell us a little about what you need.';
  return e;
}

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const fmtPhone = (v) => {
  let p = String(v || '').replace(/\D/g, '');
  if (p.length === 11 && p[0] === '1') p = p.slice(1);
  return `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`;
};
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
