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

  if (!data.name || !data.email || !TYPES.includes(data.type)) {
    return json({ error: 'Type, name and email are required' }, 400);
  }
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
    phone: clip(data.phone, 40),
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

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
