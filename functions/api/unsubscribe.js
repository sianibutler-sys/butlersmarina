// Cloudflare Pages Function: POST /api/unsubscribe
// Marks an email as unsubscribed from marina emails in the requests sheet.
// Links carry a token signed with SHEETS_SECRET, so only the person who got the email can use it.
// Also answers one-click unsubscribe from mail apps (List-Unsubscribe-Post).
import { unsubToken } from './inquiry.js';

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  let e = url.searchParams.get('e') || '', t = url.searchParams.get('t') || '';
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) {
    const b = await request.json().catch(() => ({}));
    e = b.e || e; t = b.t || t;
  }
  e = String(e).trim().toLowerCase();
  if (!e || !t || !env.SHEETS_SECRET || !env.SHEETS_URL) return json({ ok: false }, 400);
  if ((await unsubToken(env.SHEETS_SECRET, e)) !== t) return json({ ok: false, error: 'This link is not valid.' }, 403);
  try {
    const res = await fetch(env.SHEETS_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow',
      body: JSON.stringify({ secret: env.SHEETS_SECRET, action: 'unsubscribe', email: e })
    });
    const out = await res.json().catch(() => ({}));
    if (!out.ok) throw new Error();
  } catch {
    return json({ ok: false, error: 'Could not update just now.' }, 502);
  }
  return json({ ok: true });
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
