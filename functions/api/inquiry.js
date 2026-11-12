// Cloudflare Pages Function: POST /api/inquiry
// Sends a slip, lift, overnight or leasing request to the marina's Google Sheet.
// The sheet runs a small Apps Script (tools/sheets-inquiry.gs) that adds the row
// and emails info@butlersmarinaannapolis.com.
// Set these in Cloudflare Pages > Settings > Variables and secrets:
//   SHEETS_URL     the Apps Script web app URL (ends in /exec)
//   SHEETS_SECRET  the same secret written in the script
// Optional, for the confirmation email sent to the person who asked (through Resend):
//   RESEND_API_KEY  API key from resend.com, with butlersmarinaannapolis.com verified there
//   EMAIL_FROM      optional; defaults to Butler's Marina <info@butlersmarinaannapolis.com>
//   TURNSTILE_SECRET  secret key for the Cloudflare Turnstile check under the form
//   NOTIFY_EMAIL    optional; where team alerts go (defaults to info@butlersmarinaannapolis.com)
//   SITE_URL        e.g. https://butlersmarinaannapolis.com (falls back to the address the form was sent from)

const TYPES = ['Annual slip', 'Boat lift', 'Overnight stay', 'Residential lease', 'Office lease'];

export async function onRequestPost({ request, env, waitUntil }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }

  // Hidden field only bots fill in. Never drop silently: a phone's AutoFill can fill it too,
  // so the request is still saved, flagged in the message, and no confirmation email goes out.
  const flagged = !!(data.bm_x || data.company_site);

  const fields = check(data);
  if (Object.keys(fields).length) return json({ error: 'Some fields need fixing', fields }, 400);

  // Cloudflare Turnstile, the check under the form
  if (env.TURNSTILE_SECRET) {
    let pass = false;
    try {
      const body = new FormData();
      body.append('secret', env.TURNSTILE_SECRET);
      body.append('response', String(data.turnstile || ''));
      const ip = request.headers.get('CF-Connecting-IP'); if (ip) body.append('remoteip', ip);
      const v = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })).json();
      pass = v.success === true;
      if (!pass) console.error('turnstile failed:', JSON.stringify(v['error-codes'] || []));
    } catch (err) { console.error('turnstile error:', err && err.message); }
    if (!pass) return json({ error: 'Security check failed', fields: { turnstile: 'The security check didn’t go through. Try sending again, or call (410) 626-0051.' } }, 400);
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
    phone: fmtPhone(data.phone),
    boat: clip(data.boat, 160),
    loa: num(data.loa),
    beam: num(data.beam),
    draft: num(data.draft),
    arrive: isDate(data.arrive) ? data.arrive : '',
    depart: isDate(data.depart) ? data.depart : '',
    message: (flagged ? '[Flagged: hidden spam field was filled. Check before replying.] ' : '') + clip(data.message, 4000),
    sms: data.sms === 'yes' ? 'Yes' : 'No',
    news: data.news === 'yes' ? 'Yes' : 'No',
    page: clip(request.headers.get('Referer') || '', 300),
    mail: !env.RESEND_API_KEY   // the sheet emails the team only when Resend isn't set up
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

  if (env.RESEND_API_KEY) {
    const site = (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    // team alert through Resend; if Resend fails, the sheet's script sends it from Google instead
    const alert = sendAlert(env, row, flagged).catch(async (err) => {
      console.error('team alert failed:', err && err.message);
      await fetch(env.SHEETS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...row, action: 'notify' }), redirect: 'follow' }).catch(() => {});
    });
    const thanks = flagged ? Promise.resolve()
      : sendConfirmation(env, site, row).catch((err) => console.error('confirmation email failed:', err && err.message));
    const jobs = Promise.all([alert, thanks]);
    if (waitUntil) waitUntil(jobs); else await jobs;
  }
  return json({ ok: true });
}

// ---------- team alert ----------

const SHEET_LINK = 'https://docs.google.com/spreadsheets/d/1o3gkNWv-KvpxRKnnjALoE7WXEeqHg6Fohj-vIKJVkbM/edit';

async function sendAlert(env, r, flagged) {
  const rows = [
    ['Request', r.type], ['Name', r.name], ['Email', r.email], ['Phone', r.phone],
    ['Boat', r.boat], ['Length', r.loa && r.loa + ' ft'], ['Beam', r.beam && r.beam + ' ft'], ['Draft', r.draft && r.draft + ' ft'],
    ['Arriving', nice(r.arrive)], ['Leaving', nice(r.depart)], ['Message', r.message],
    ['Texts OK', r.sms], ['Newsletter', r.news], ['From page', r.page]
  ].filter(([, v]) => v);
  const text = [`${r.type} request from ${r.name}`, '', ...rows.map(([k, v]) => `${k}: ${v}`), '',
    'Reply to this email to answer them directly.', `Requests sheet: ${SHEET_LINK}`].join('\n');
  const navy = '#0D1A2B', muted = '#56677A', rule = '#DCE3E9', cell = 'font-family:Helvetica,Arial,sans-serif;';
  const html = `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#EEF2F5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;">
<tr><td style="${cell}padding:24px 26px 6px;color:${navy};">
${flagged ? `<p style="margin:0 0 12px;padding:10px 12px;background:#FFF3E8;border-radius:8px;font-size:14px;">Flagged: the hidden spam field was filled. It may be a bot, or a phone's AutoFill. Check before replying.</p>` : ''}
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${muted};font-weight:bold;">New website request</p>
<p style="margin:0 0 14px;font-size:20px;">${esc(r.type)}, ${esc(r.name)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${rule};">
${rows.map(([k, v]) => `<tr><td style="${cell}padding:8px 12px 8px 0;border-bottom:1px solid ${rule};color:${muted};font-size:14px;width:104px;vertical-align:top;">${esc(k)}</td><td style="${cell}padding:8px 0;border-bottom:1px solid ${rule};color:${navy};font-size:15px;white-space:pre-wrap;">${esc(v)}</td></tr>`).join('')}
</table>
<p style="margin:16px 0 22px;font-size:14px;color:${muted};">Reply to this email to answer ${esc(r.name.split(/\s+/)[0])} directly. <a href="${SHEET_LINK}" style="color:${navy};">Open the requests sheet</a></p>
</td></tr></table></body></html>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: "Butler's Marina website <website@butlersmarinaannapolis.com>",
      to: [env.NOTIFY_EMAIL || 'info@butlersmarinaannapolis.com'],
      reply_to: r.email,
      subject: `${flagged ? '[Check] ' : ''}Website request: ${r.type}, ${r.name}`,
      html, text
    })
  });
  if (!res.ok) throw new Error('resend ' + res.status + ' ' + (await res.text().catch(() => '')).slice(0, 300));
}

// ---------- confirmation email ----------

export async function unsubToken(secret, email) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(sig)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nice = (iso) => {
  if (!isDate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

async function sendConfirmation(env, site, r) {
  const first = r.name.split(/\s+/)[0];
  const token = await unsubToken(env.SHEETS_SECRET, r.email);
  const unsub = `${site}/unsubscribe/?e=${encodeURIComponent(r.email)}&t=${token}`;
  const rows = [
    ['Request', r.type], ['Name', r.name], ['Email', r.email], ['Phone', r.phone],
    ['Boat', r.boat], ['Length', r.loa && r.loa + ' ft'], ['Beam', r.beam && r.beam + ' ft'], ['Draft', r.draft && r.draft + ' ft'],
    ['Arriving', nice(r.arrive)], ['Leaving', nice(r.depart)], ['Message', r.message]
  ].filter(([, v]) => v);

  const smsText = r.sms === 'Yes'
    ? `You agreed to receive text messages from Butler's Marina at ${r.phone} about your request and marina updates. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. Consent is not a condition of renting a slip.`
    : 'You did not sign up for text messages.';
  const newsText = r.news === 'Yes'
    ? 'You signed up for marina news by email. You can unsubscribe at any time with the link at the bottom of this email.'
    : 'You did not sign up for marina news by email.';

  const text = [
    `Hi ${first},`,
    '',
    `Thank you for reaching out to Butler's Marina. We have your request and will be in touch soon. For tonight or tomorrow, call (410) 626-0051.`,
    '',
    'WHAT YOU SENT',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'YOUR PREFERENCES',
    `Texts: ${smsText}`,
    `Email: ${newsText}`,
    '',
    `To change anything, reply to this email.`,
    '',
    "Butler's Waterfront & Marina",
    '409 Chester Avenue, Annapolis, MD 21403',
    '(410) 626-0051',
    `Privacy policy: ${site}/privacy/`,
    `Messaging terms: ${site}/tc/`,
    `Unsubscribe from marina emails: ${unsub}`,
    '',
    `You're getting this email because you sent a request at butlersmarinaannapolis.com.`
  ].join('\n');

  const navy = '#0D1A2B', orange = '#F37020', muted = '#56677A', rule = '#DCE3E9';
  const cell = 'font-family:Helvetica,Arial,sans-serif;';
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#EEF2F5;">
<div style="display:none;max-height:0;overflow:hidden;">We have your request and will be in touch soon.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF2F5;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${navy};padding:22px 28px;" align="left"><img src="${site}/assets/img/email-logo.png" width="150" alt="Butler's Marina, Annapolis Maryland" style="display:block;border:0;width:150px;height:auto;"></td></tr>
<tr><td style="${cell}padding:30px 28px 8px;color:${navy};font-size:16px;line-height:1.55;">
<p style="margin:0 0 14px;">Hi ${esc(first)},</p>
<p style="margin:0 0 14px;">Thank you for reaching out to Butler&#8217;s Marina. We have your request and will be in touch soon. For tonight or tomorrow, call <a href="tel:+14106260051" style="color:${navy};">(410) 626-0051</a>.</p>
</td></tr>
<tr><td style="${cell}padding:10px 28px 0;"><p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${muted};font-weight:bold;">What you sent</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${rule};">
${rows.map(([k, v]) => `<tr><td style="${cell}padding:9px 12px 9px 0;border-bottom:1px solid ${rule};color:${muted};font-size:14px;width:96px;vertical-align:top;">${esc(k)}</td><td style="${cell}padding:9px 0;border-bottom:1px solid ${rule};color:${navy};font-size:15px;white-space:pre-wrap;">${esc(v)}</td></tr>`).join('')}
</table></td></tr>
<tr><td style="${cell}padding:24px 28px 0;"><p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${muted};font-weight:bold;">Your preferences</p>
<p style="margin:0 0 10px;font-size:14px;line-height:1.55;color:${navy};"><strong>Texts.</strong> ${esc(smsText)}</p>
<p style="margin:0;font-size:14px;line-height:1.55;color:${navy};"><strong>Email.</strong> ${esc(newsText)}</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:${navy};">To change anything, reply to this email.</p></td></tr>
<tr><td style="${cell}padding:28px 28px 26px;"><div style="height:3px;width:40px;background:${orange};margin-bottom:16px;"></div>
<p style="margin:0;font-size:13px;line-height:1.6;color:${muted};">Butler&#8217;s Waterfront &amp; Marina<br>409 Chester Avenue, Annapolis, MD 21403<br>(410) 626-0051</p>
<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${muted};"><a href="${site}/privacy/" style="color:${muted};">Privacy policy</a> &nbsp;&#183;&nbsp; <a href="${site}/tc/" style="color:${muted};">Messaging terms</a> &nbsp;&#183;&nbsp; <a href="${esc(unsub)}" style="color:${muted};">Unsubscribe from marina emails</a></p>
<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${muted};">You&#8217;re getting this email because you sent a request at butlersmarinaannapolis.com.</p>
</td></tr></table></td></tr></table></body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "Butler's Marina <info@butlersmarinaannapolis.com>",
      to: [r.email],
      reply_to: 'info@butlersmarinaannapolis.com',
      subject: `We have your request, ${first}`,
      html,
      text,
      headers: {
        'List-Unsubscribe': `<${unsub}>, <mailto:info@butlersmarinaannapolis.com?subject=Unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    })
  });
  if (!res.ok) throw new Error('resend ' + res.status + ' ' + (await res.text().catch(() => '')).slice(0, 300));
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
