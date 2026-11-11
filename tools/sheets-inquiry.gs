/**
 * Butler's Marina request form -> Google Sheets.
 * Paste into the sheet: Extensions > Apps Script. Set SECRET, save, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Put the /exec URL and the same SECRET in Cloudflare Pages as SHEETS_URL and SHEETS_SECRET.
 * After editing this script later: Deploy > Manage deployments > pencil > Version: New version > Deploy
 * (keeps the same URL).
 */
const SECRET = 'change-me-to-a-long-random-phrase';
const TAB = 'Requests';
const UNSUB_TAB = 'Unsubscribed';
const NOTIFY = 'info@butlersmarinaannapolis.com';
const HEADERS = ['Received', 'Type', 'Name', 'Email', 'Phone', 'Boat', 'Length (ft)', 'Beam (ft)', 'Draft (ft)',
  'Arriving', 'Leaving', 'Message', 'SMS consent', 'Status', 'Notes', 'From page', 'Newsletter'];

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (!d || d.secret !== SECRET) return out({ ok: false, error: 'forbidden' });
  if (d.action === 'unsubscribe') return unsubscribe(d.email);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  const when = new Date(d.received || Date.now());
  // a leading apostrophe keeps Sheets from treating typed text as a formula
  const safe = (v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v);
  sh.appendRow([when, d.type, safe(d.name), safe(d.email), safe(d.phone), safe(d.boat), d.loa, d.beam, d.draft,
    d.arrive, d.depart, safe(d.message), d.sms, 'New', '', d.page, d.news || 'No']);

  const lines = [
    d.type + ' request from ' + d.name,
    '',
    'Email: ' + d.email,
    d.phone ? 'Phone: ' + d.phone : null,
    d.boat ? 'Boat: ' + d.boat : null,
    d.loa ? 'Length: ' + d.loa + ' ft' : null,
    d.beam ? 'Beam: ' + d.beam + ' ft' : null,
    d.draft ? 'Draft: ' + d.draft + ' ft' : null,
    d.arrive ? 'Arriving: ' + d.arrive : null,
    d.depart ? 'Leaving: ' + d.depart : null,
    d.message ? '\n' + d.message : null,
    '',
    'Texts OK: ' + d.sms,
    'Newsletter: ' + (d.news || 'No'),
    'Sheet: ' + ss.getUrl()
  ].filter(function (l) { return l !== null; });
  MailApp.sendEmail({ to: NOTIFY, name: "Butler's Marina website", replyTo: d.email,
    subject: 'Website request: ' + d.type + ', ' + d.name, body: lines.join('\n') });

  return out({ ok: true });
}

// Marks every row for this email as unsubscribed from the newsletter and logs it.
function unsubscribe(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return out({ ok: false, error: 'no email' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TAB);
  if (sh && sh.getLastRow() > 1) {
    const emailCol = HEADERS.indexOf('Email') + 1, newsCol = HEADERS.indexOf('Newsletter') + 1;
    const vals = sh.getRange(2, emailCol, sh.getLastRow() - 1, 1).getValues();
    vals.forEach(function (r, i) {
      if (String(r[0]).trim().toLowerCase() === email) sh.getRange(i + 2, newsCol).setValue('Unsubscribed');
    });
  }
  let log = ss.getSheetByName(UNSUB_TAB);
  if (!log) {
    log = ss.insertSheet(UNSUB_TAB);
    log.appendRow(['Email', 'Unsubscribed']);
    log.setFrozenRows(1);
    log.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  log.appendRow([email, new Date()]);
  return out({ ok: true });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
