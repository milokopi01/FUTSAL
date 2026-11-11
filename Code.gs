/**
 * =========================================================
 *  LIVE FUTSAL PENDIDIKAN KHAS KBB 2026 - GOOGLE APPS SCRIPT
 *  Fail: Code.gs   (Extensions > Apps Script dalam Google Sheets)
 *
 *  doGet(e)  : Baca data perlawanan daripada tab Jadual_Perlawanan (JSON / JSONP)
 *  doPost(e) : Kemas kini skor, fasa masa, status perlawanan, status pengesahan
 *              urusetia dan nama pengadil ke dalam tab Jadual_Perlawanan.
 *
 *  Lajur dikesan melalui NAMA TAJUK (baris 1), jadi susunan lajur Bahagian 1
 *  boleh dikekalkan. Lajur yang tiada akan ditambah automatik di hujung.
 * =========================================================
 */

const SHEET_JADUAL = 'Jadual_Perlawanan';
const SHEET_CARTA = 'Carta_Liga';
const SHEET_LOG = 'Log_Pengesahan';
const TIMEZONE = 'Asia/Kuala_Lumpur';

/**
 * Pilihan keselamatan: isi API_TOKEN (cth: 'kbb2026rahsia') untuk hanya menerima
 * POST yang membawa { token: 'kbb2026rahsia' }. Biarkan kosong untuk aplikasi
 * semasa (aplikasi tidak menghantar token).
 */
const API_TOKEN = '';

/**
 * Medan data -> [Tajuk lajur lalai, ...alias tajuk yang diterima].
 * Alias dibandingkan tanpa huruf besar/kecil, ruang atau simbol.
 */
const FIELDS = {
  id:              ['ID Match', 'id', 'idmatch', 'matchid', 'idperlawanan', 'kodmatch'],
  kategori:        ['Kategori', 'kategori'],
  no:              ['No', 'no', 'bil', 'nomatch', 'noperlawanan'],
  peringkat:       ['Peringkat', 'peringkat'],
  kumpulan:        ['Kumpulan', 'kumpulan', 'kump'],
  kodP1:           ['Kod P1', 'kodp1', 'kodpasukan1'],
  namaP1:          ['Pasukan 1', 'namap1', 'pasukan1', 'pasukana', 'tuanrumah'],
  skorP1:          ['Skor P1', 'skorp1', 'skor1', 'skorpasukan1', 'golp1'],
  skorP2:          ['Skor P2', 'skorp2', 'skor2', 'skorpasukan2', 'golp2'],
  namaP2:          ['Pasukan 2', 'namap2', 'pasukan2', 'pasukanb', 'pelawat'],
  kodP2:           ['Kod P2', 'kodp2', 'kodpasukan2'],
  gelanggang:      ['Gelanggang', 'gelanggang', 'gel', 'court'],
  fasa:            ['Fasa', 'fasa', 'fasakejohanan'],
  fasaMasa:        ['Fasa Masa', 'fasamasa', 'separuh', 'masaperlawanan'],
  status:          ['Status Perlawanan', 'status', 'statusperlawanan', 'statusmatch'],
  pengesahan:      ['Status Pengesahan', 'pengesahan', 'statuspengesahan', 'pengesahanurusetia'],
  pengadil:        ['Nama Pengadil', 'pengadil', 'namapengadil'],
  pemenangPenalti: ['Menang Penalti', 'pemenangpenalti', 'menangpenalti', 'penalti'],
  masaMula:        ['Masa Mula', 'masamula'],
  masaTamat:       ['Masa Tamat', 'masatamat'],
  disahkanOleh:    ['Disahkan Oleh', 'disahkanoleh'],
  disahkanPada:    ['Disahkan Pada', 'disahkanpada'],
  catatan:         ['Catatan', 'catatan', 'nota'],
  kemaskini:       ['Kemaskini Terakhir', 'kemaskini', 'kemaskiniterakhir', 'updatedat']
};

// Medan yang dibenarkan dikemas kini oleh doPost (selain medan pengenalan)
const UPDATABLE = [
  'kategori', 'no', 'peringkat', 'kumpulan', 'kodP1', 'namaP1', 'skorP1', 'skorP2', 'namaP2', 'kodP2',
  'gelanggang', 'fasa', 'fasaMasa', 'status', 'pengesahan', 'pengadil', 'pemenangPenalti',
  'masaMula', 'masaTamat', 'disahkanOleh', 'disahkanPada', 'catatan'
];
const DATE_FIELDS = ['masaMula', 'masaTamat', 'disahkanPada', 'kemaskini'];

const STATUS_MAP = {
  'BELUMBERMULA': 'MENUNGGU GILIRAN', 'MENUNGGU': 'MENUNGGU GILIRAN', 'MENUNGGUGILIRAN': 'MENUNGGU GILIRAN',
  'LIVE': 'LIVE', 'SEDANGBERLANGSUNG': 'LIVE',
  'TAMAT': 'TAMAT - TUNGGU SAH', 'TAMATTUNGGUSAH': 'TAMAT - TUNGGU SAH',
  'SELESAI': 'SELESAI', 'DISAHKAN': 'SELESAI'
};
const PENGESAHAN_MAP = { 'MENUNGGU': 'MENUNGGU', 'DISAHKAN': 'DISAHKAN', 'DITOLAK': 'DITOLAK', 'LULUS': 'DISAHKAN', 'SAH': 'DISAHKAN' };
const FASA_MASA_MAP = {
  'SEPARUH1': 'Separuh 1', 'REHAT': 'Rehat', 'SEPARUH2': 'Separuh 2',
  'TAMAT': 'Tamat', 'SEDIA': 'Belum Bermula', 'BELUMBERMULA': 'Belum Bermula'
};

/* =========================================================
   doGet(e) - BACA DATA
   ?action=read (lalai) | ?action=ping
   ?id=SR-01           -> satu perlawanan
   ?kategori=SR|SM     -> tapis kategori
   ?gelanggang=A..D    -> tapis gelanggang
   ?callback=namaFungsi -> JSONP
   ========================================================= */
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    const action = String(p.action || 'read').toLowerCase();
    if (action === 'ping') {
      return output_({ ok: true, message: 'Live Futsal PK KBB API aktif', masa: new Date().toISOString() }, p.callback);
    }
    if (action !== 'read') {
      return output_({ ok: false, error: 'Tindakan tidak dikenali: ' + action }, p.callback);
    }

    const sheet = getJadualSheet_();
    const table = readTable_(sheet);
    let rows = table.rows.map(function (r) { return r.data; });

    if (p.id) rows = rows.filter(function (r) { return String(r.id).toUpperCase() === String(p.id).toUpperCase(); });
    if (p.kategori) rows = rows.filter(function (r) { return String(r.kategori).toUpperCase() === String(p.kategori).toUpperCase(); });
    if (p.gelanggang) rows = rows.filter(function (r) { return String(r.gelanggang).toUpperCase() === String(p.gelanggang).toUpperCase(); });

    return output_({
      ok: true,
      sheet: SHEET_JADUAL,
      count: rows.length,
      dikemaskini: new Date().toISOString(),
      matches: p.id ? undefined : rows,
      match: p.id ? (rows[0] || null) : undefined
    }, p.callback);
  } catch (err) {
    return output_({ ok: false, error: String(err && err.message || err) }, p.callback);
  }
}

/* =========================================================
   doPost(e) - KEMAS KINI DATA
   Format diterima (Content-Type text/plain atau application/json):
   1) Sync penuh daripada aplikasi (butang "Sync ke Google Sheets"):
      { action: 'syncAll', matches: [ {...}, ... ], standings: [...], approvalLog: [...] }
   2) Kemas kini satu perlawanan:
      { action: 'updateMatch', id: 'SR-01', skorP1: 2, skorP2: 1, fasaMasa: 'Separuh 2',
        status: 'LIVE', pengesahan: 'MENUNGGU', pengadil: 'Cikgu Ahmad' }
   3) Kemas kini beberapa perlawanan: { action: 'updateMatches', matches: [ ... ] }
   ========================================================= */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return output_({ ok: false, error: 'Pelayan sibuk. Cuba lagi.' });
  }

  try {
    const body = parseBody_(e);
    if (API_TOKEN && body.token !== API_TOKEN) {
      return output_({ ok: false, error: 'Token tidak sah.' });
    }

    let list = [];
    const action = String(body.action || '').toLowerCase();
    if (Array.isArray(body.matches)) list = body.matches;
    else if (action === 'updatematch' || body.id) list = [body.match || body];
    if (!list.length) return output_({ ok: false, error: 'Tiada data perlawanan diterima.' });

    const result = upsertMatches_(list);

    if (Array.isArray(body.standings) && body.standings.length) writeStandings_(body.standings);
    if (Array.isArray(body.approvalLog) && body.approvalLog.length) writeApprovalLog_(body.approvalLog);

    return output_({
      ok: true,
      sheet: SHEET_JADUAL,
      dikemaskini: result.updated,
      ditambah: result.inserted,
      ditolak: result.skipped,
      masa: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    return output_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
   LOGIK UTAMA: UPSERT BARIS PERLAWANAN
   ========================================================= */
function upsertMatches_(list) {
  const sheet = getJadualSheet_();
  const table = readTable_(sheet);
  const values = table.values;            // termasuk baris tajuk
  const colOf = table.colOf;              // medan -> indeks lajur (0-based)
  const width = values[0].length;
  const index = {};
  table.rows.forEach(function (r) { index[String(r.data.id).toUpperCase()] = r.rowIndex; });

  const now = new Date();
  let updated = 0, inserted = 0, skipped = 0;

  list.forEach(function (m) {
    const id = String(m && m.id || '').trim().toUpperCase();
    if (!/^(SR|SM)-\d{1,2}$/.test(id)) { skipped++; return; }

    let rowIdx = index[id];
    if (rowIdx === undefined) {
      const blank = new Array(width).fill('');
      blank[colOf.id] = id;
      blank[colOf.kategori] = id.slice(0, 2);   // SR / SM daripada ID
      values.push(blank);
      rowIdx = values.length - 1;
      index[id] = rowIdx;
      inserted++;
    } else {
      updated++;
    }
    const row = values[rowIdx];

    UPDATABLE.forEach(function (field) {
      if (!(field in m) || m[field] === undefined) return;
      row[colOf[field]] = cleanValue_(field, m[field]);
    });
    row[colOf.kemaskini] = now;
  });

  // Tulis semula sekaligus (lebih pantas daripada setValue satu persatu)
  sheet.getRange(1, 1, values.length, width).setValues(values);
  formatDateColumns_(sheet, colOf, values.length);
  return { updated: updated, inserted: inserted, skipped: skipped };
}

function cleanValue_(field, v) {
  if (v === null) return '';
  const key = String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  switch (field) {
    case 'skorP1':
    case 'skorP2': {
      if (v === '') return '';
      const n = Math.round(Number(v));
      return isNaN(n) ? '' : Math.max(0, Math.min(99, n));
    }
    case 'no': {
      const n = Number(v);
      return isNaN(n) ? v : n;
    }
    case 'status': return STATUS_MAP[key] || String(v);
    case 'pengesahan': return PENGESAHAN_MAP[key] || String(v);
    case 'fasaMasa': return FASA_MASA_MAP[key] || String(v);
    case 'gelanggang': return String(v).toUpperCase();
    default:
      if (DATE_FIELDS.indexOf(field) >= 0) {
        const d = new Date(v);
        return isNaN(d.getTime()) ? '' : d;
      }
      return String(v).slice(0, 500);
  }
}

/* =========================================================
   TAB TAMBAHAN: CARTA LIGA & LOG PENGESAHAN
   ========================================================= */
function writeStandings_(standings) {
  const sheet = getOrCreateSheet_(SHEET_CARTA);
  const header = ['Kategori', 'Kumpulan', 'Kedudukan', 'Kod', 'Pasukan', 'P', 'M', 'S', 'K', 'J', 'B', 'PG', 'Mata', 'Kemaskini'];
  const now = new Date();
  const rows = standings.map(function (r) {
    return [r.kategori, r.kumpulan, r.pos, r.kod, r.nama, r.P, r.M, r.S, r.K, r.J, r.B, r.PG, r.Mata, now];
  });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function writeApprovalLog_(log) {
  const sheet = getOrCreateSheet_(SHEET_LOG);
  const header = ['Masa', 'Match', 'Keputusan', 'Tindakan', 'Oleh'];
  const rows = log.map(function (l) {
    const d = new Date(l.masa);
    return [isNaN(d.getTime()) ? '' : d, l.matchId || '', l.keputusan || '', l.tindakan || '', l.oleh || ''];
  });
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
    sheet.getRange(2, 1, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }
  sheet.setFrozenRows(1);
}

/* =========================================================
   PEMBANTU SHEET
   ========================================================= */
function getOrCreateSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// Pastikan tab Jadual_Perlawanan wujud & semua lajur yang diperlukan ada
function getJadualSheet_() {
  const sheet = getOrCreateSheet_(SHEET_JADUAL);
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const isEmpty = header.every(function (h) { return h === '' || h === null; });

  if (isEmpty) {
    const defaults = Object.keys(FIELDS).map(function (f) { return FIELDS[f][0]; });
    sheet.getRange(1, 1, 1, defaults.length).setValues([defaults]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }

  const found = mapHeader_(header);
  const missing = Object.keys(FIELDS).filter(function (f) { return found[f] === undefined; });
  if (missing.length) {
    const titles = missing.map(function (f) { return FIELDS[f][0]; });
    sheet.getRange(1, header.length + 1, 1, titles.length).setValues([titles]).setFontWeight('bold');
  }
  return sheet;
}

function normalizeKey_(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapHeader_(header) {
  const colOf = {};
  header.forEach(function (h, i) {
    const k = normalizeKey_(h);
    if (!k) return;
    Object.keys(FIELDS).forEach(function (field) {
      if (colOf[field] !== undefined) return;
      const aliases = FIELDS[field].map(normalizeKey_);
      if (aliases.indexOf(k) >= 0) colOf[field] = i;
    });
  });
  return colOf;
}

function readTable_(sheet) {
  const values = sheet.getDataRange().getValues();
  const colOf = mapHeader_(values[0]);
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const idVal = values[r][colOf.id];
    if (idVal === '' || idVal === null || idVal === undefined) continue;
    const data = {};
    Object.keys(colOf).forEach(function (field) {
      let v = values[r][colOf[field]];
      if (v instanceof Date) v = v.toISOString();
      if ((field === 'skorP1' || field === 'skorP2') && v === '') v = null;
      data[field] = v;
    });
    rows.push({ rowIndex: r, data: data });
  }
  return { values: values, colOf: colOf, rows: rows };
}

function formatDateColumns_(sheet, colOf, totalRows) {
  if (totalRows < 2) return;
  DATE_FIELDS.forEach(function (f) {
    if (colOf[f] === undefined) return;
    sheet.getRange(2, colOf[f] + 1, totalRows - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  });
}

function parseBody_(e) {
  if (!e) throw new Error('Tiada permintaan.');
  if (e.postData && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      // Sokongan borang: payload=<json>
      if (e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload);
      throw new Error('Format JSON tidak sah.');
    }
  }
  if (e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload);
  if (e.parameter && e.parameter.id) return e.parameter;
  throw new Error('Badan permintaan kosong.');
}

function output_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][\w$.]{0,63}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================
   FUNGSI MANUAL (jalankan dari editor Apps Script)
   ========================================================= */
// 1) Jalankan sekali untuk memberi kebenaran & menyediakan lajur.
function setupSheet() {
  SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone(TIMEZONE);
  const sheet = getJadualSheet_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Tab ' + SHEET_JADUAL + ' sedia digunakan.', 'Live Futsal PK KBB', 5);
  return sheet.getName();
}

// 2) Ujian ringkas tanpa aplikasi: kemas kini SR-01.
function testDoPost() {
  const res = doPost({
    postData: {
      contents: JSON.stringify({
        action: 'updateMatch', id: 'SR-01', skorP1: 2, skorP2: 1,
        fasaMasa: 'Separuh 2', status: 'LIVE', pengesahan: 'MENUNGGU', pengadil: 'Pengadil Gelanggang C'
      })
    }
  });
  console.log(res.getContent());
}

// 3) Ujian bacaan.
function testDoGet() {
  console.log(doGet({ parameter: { id: 'SR-01' } }).getContent());
}
