// Cloudflare Pages Function: POST /api/inquiry
// Writes a slip, overnight, apartment or office request to Airtable.
// Set these in Cloudflare Pages > Settings > Variables and secrets:
//   AIRTABLE_TOKEN  personal access token with data.records:write on the base
//   AIRTABLE_BASE   base ID, starts with "app"
//   AIRTABLE_TABLE  table name or ID, e.g. "Requests"
// An Airtable automation on new records emails info@butlersmarinaannapolis.com.

const TYPES = ['Annual slip', 'Overnight stay', 'Apartment', 'Office space'];

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
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE || !env.AIRTABLE_TABLE) {
    return json({ error: 'Form not configured' }, 503);
  }

  const fields = {
    Name: clip(data.name, 120),
    Email: clip(data.email, 160),
    Phone: clip(data.phone, 40),
    Type: data.type,
    Boat: clip(data.boat, 160),
    Message: clip(data.message, 4000),
    'SMS consent': data.sms === 'yes',
    Status: 'New'
  };
  for (const [key, field] of [['loa', 'Length (ft)'], ['beam', 'Beam (ft)'], ['draft', 'Draft (ft)']]) {
    const n = parseFloat(data[key]);
    if (Number.isFinite(n) && n > 0) fields[field] = n;
  }
  if (isDate(data.arrive)) fields.Arriving = data.arrive;
  if (isDate(data.depart)) fields.Leaving = data.depart;

  const res = await fetch(
    `https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(env.AIRTABLE_TABLE)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields }], typecast: true })
    }
  );
  if (!res.ok) return json({ error: 'Could not save request' }, 502);
  return json({ ok: true });
}

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
