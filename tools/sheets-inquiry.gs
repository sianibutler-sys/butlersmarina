/**
 * Butler's Marina request form -> Google Sheets.
 * Paste into the sheet: Extensions > Apps Script. Set SECRET, save, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Put the /exec URL and the same SECRET in Cloudflare Pages as SHEETS_URL and SHEETS_SECRET.
 */
const SECRET = 'change-me-to-a-long-random-phrase';
const TAB = 'Requests';
const NOTIFY = 'info@butlersmarinaannapolis.com';
const HEADERS = ['Received', 'Type', 'Name', 'Email', 'Phone', 'Boat', 'Length (ft)', 'Beam (ft)', 'Draft (ft)',
  'Arriving', 'Leaving', 'Message', 'SMS consent', 'Status', 'Notes', 'From page'];

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (!d || d.secret !== SECRET) return out({ ok: false, error: 'forbidden' });

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
    d.arrive, d.depart, safe(d.message), d.sms, 'New', '', d.page]);

  const lines = [
    d.type + ' request from ' + d.name,
    '',
    'Email: ' + d.email,
    d.phone ? 'Phone: ' + d.phone : '',
    d.boat ? 'Boat: ' + d.boat : '',
    d.loa ? 'Length: ' + d.loa + ' ft' : '',
    d.beam ? 'Beam: ' + d.beam + ' ft' : '',
    d.draft ? 'Draft: ' + d.draft + ' ft' : '',
    d.arrive ? 'Arriving: ' + d.arrive : '',
    d.depart ? 'Leaving: ' + d.depart : '',
    d.message ? '\n' + d.message : '',
    '',
    'Texts OK: ' + d.sms,
    'Sheet: ' + ss.getUrl()
  ].filter(function (l) { return l !== ''; });
  MailApp.sendEmail({ to: NOTIFY, replyTo: d.email, subject: d.type + ' request: ' + d.name, body: lines.join('\n') });

  return out({ ok: true });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
