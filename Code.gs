/**
 * =========================================================
 *  LIVE FUTSAL PENDIDIKAN KHAS KBB 2026 - GOOGLE APPS SCRIPT
 *  Fail: Code.gs   (Extensions > Apps Script dalam Google Sheets)
 *
 *  doGet(e)  : Baca data perlawanan daripada tab Jadual_Perlawanan (JSON / JSONP)
 *  doPost(e) : Kemas kini skor, fasa masa, status perlawanan, status pengesahan
 *              urusetia dan nama pengadil ke dalam tab Jadual_Perlawanan.
 *              + PANGKALAN DATA PENGADIL (tab Senarai_Pengadil):
 *                Master Admin cipta / ubah / gantung / padam akaun pengadil
 *                (nama ringkas + kata laluan). Pengadil log masuk dengan nama
 *                ringkas & kata laluan sendiri.
 *              * Sistem kata laluan khas setiap gelanggang (PENGADIL-A..D) telah DIBUANG.
 *              + FASA 2 - KUNCI GELANGGANG (tab Kunci_Gelanggang):
 *                Pengadil log masuk -> pilih gelanggang -> tekan "Sepak Mula".
 *                Gelanggang DIKUNCI kepada pengadil tersebut; pengadil lain tidak
 *                boleh memberi markah (skor) di gelanggang itu sehingga kunci dilepaskan.
 *
 *              + FASA 3 - KAWALAN PERLAWANAN & PAPARAN AWAM:
 *                "Tangguh Perlawanan" (salah tekan Sepak Mula) -> perlawanan kembali
 *                MENUNGGU GILIRAN, boleh tukar pengadil. Setiap tangguhan dicatat di
 *                tab Log_Tangguh. GET ?action=live -> papan live awam (gelanggang,
 *                pasukan, skor, fasa, masa mula & NAMA PENGADIL).
 *
 *              + FASA 4 - PEMBETULAN MARKAH (MASTER ADMIN SAHAJA) & ROMBAKAN AUTOMATIK:
 *                { action: 'pembetulanSkor', adminKey, matchId, skorP1, skorP2,
 *                  pemenangPenalti, sebab, mod, susulan:[...] }
 *                - Hanya kunci Master Admin diterima. Token pengadil / Urusetia DITOLAK.
 *                - Keputusan DISAHKAN (SELESAI) dikunci: syncAll / updateMatch / skorLive
 *                  TIDAK boleh mengubah skor, pemenang, status atau pasukan baris tersebut.
 *                - Setiap pembetulan diberi "Versi Pembetulan" -> peranti lama (data basi)
 *                  tidak boleh menulis ganti markah yang telah dibaiki.
 *                - Selepas simpan: Carta_Liga dikira semula DI PELAYAN, slot Johan / Naib
 *                  Johan / Menang / Kalah perlawanan susulan dirombak automatik, dan
 *                  setiap pembetulan dicatat dalam tab Log_Pembetulan.
 *
 *              + FASA 4.1 - PAUTAN PENGADIL <-> GOOGLE SHEETS:
 *                - ?action=ping kini memulangkan 'versi' & 'ciri' supaya aplikasi boleh
 *                  mengesan jika Code.gs yang di-deploy masih versi LAMA.
 *                - Tindakan yang tidak dikenali dipulangkan dengan jelas (kod TINDAKAN_TIDAK_DIKENALI).
 *                - simpanPengadil / syncPengadil memaksa tulisan (flush) & mengesahkan
 *                  rekod benar-benar wujud dalam tab Senarai_Pengadil sebelum memulangkan ok.
 *
 *              + FASA 5 - REHAT KECEMASAN (PENANGGUHAN SEMENTARA) & AMBIL ALIH PENGADIL:
 *                { action: 'rehatKecemasan', token, gelanggang, matchId, skorP1, skorP2,
 *                  fasaSebelum, elapsedMs, sebab }      -> pengadil pemegang kunci sahaja
 *                { action: 'ambilAlihGelanggang', token, gelanggang } -> pengadil baharu
 *                { action: 'sambungPerlawanan', token, gelanggang, matchId } -> pemegang kunci
 *                - Perlawanan kekal LIVE; Fasa Masa = "Rehat Kecemasan". Skor DIBEKUKAN:
 *                  skorLive / syncAll / updateMatch tidak boleh mengubah markah semasa rehat.
 *                - Semasa rehat, kunci boleh dilepaskan / diambil alih oleh pengadil lain
 *                  (tanpa menunggu 15 minit). Status rehat KEKAL walaupun kunci dilepaskan.
 *                - Sambung Perlawanan: skor diambil daripada Jadual_Perlawanan (sumber sah),
 *                  fasa & masa fasa disambung. Semua tindakan dicatat dalam Log_Tangguh.
 *
 *              + FASA 6 - PENGESAHAN PENGADIL (MOD TELEFON):
 *                - Pengadil WAJIB mengesahkan keputusan sebelum dihantar ke Urusetia.
 *                  { action: 'skorLive', ..., status: 'TAMAT - TUNGGU SAH', lepas: true, sahkan: true }
 *                - Nama pengadil diambil daripada TOKEN SESI (bukan daripada peranti) dan
 *                  ditulis ke lajur "Disahkan Pengadil" & "Masa Sah Pengadil" dalam
 *                  Jadual_Perlawanan, serta dicatat dalam tab Log_Sah_Pengadil.
 *                - Lajur ini hanya boleh ditulis melalui skorLive (pengadil) atau Master Admin.
 *                  Tangguh perlawanan mengosongkan pengesahan.
 *
 *              + FASA 7 - PETI KELULUSAN URUSETIA / MASTER ADMIN:
 *                - Peranti Urusetia / Master Admin membaca GET ?action=read setiap 15 saat
 *                  supaya keputusan "TAMAT - TUNGGU SAH" daripada telefon pengadil muncul
 *                  dalam Peti Kelulusan.
 *                - Sahkan / Tolak dihantar terus: { action: 'updateMatches', matches:[...],
 *                  logBaharu:[...] }. 'logBaharu' DITAMBAH ke tab Log_Pengesahan (tidak
 *                  memadam log sedia ada).
 *                - Keputusan DITOLAK mengosongkan "Disahkan Pengadil" supaya pengadil
 *                  perlu mengesahkan semula.
 *
 *              + v1.9.0 - PAPAN LIVE PANTAS:
 *                - GET ?action=live kini dibaca daripada CacheService (beberapa ratus ms)
 *                  dan cache dibuang automatik selepas setiap doPost (sepak mula, gol, tamat).
 *                - { action: 'kunciGelanggang', ..., mula: true } terus menanda perlawanan
 *                  LIVE dalam panggilan yang sama -> dashboard memaparkan LIVE serta-merta.
 *                - PENTING: selepas menampal fail ini, Deploy > Manage deployments >
 *                  Edit > Version: New version > Deploy (URL kekal sama).
 *
 *  Lajur dikesan melalui NAMA TAJUK (baris 1), jadi susunan lajur Bahagian 1
 *  boleh dikekalkan. Lajur yang tiada akan ditambah automatik di hujung.
 * =========================================================
 */

const SHEET_JADUAL = 'Jadual_Perlawanan';
const SHEET_CARTA = 'Carta_Liga';
const SHEET_LOG = 'Log_Pengesahan';
const SHEET_PENGADIL = 'Senarai_Pengadil';
const SHEET_KUNCI = 'Kunci_Gelanggang';
const SHEET_TANGGUH = 'Log_Tangguh';
const TANGGUH_HEADER = ['Masa', 'Gelanggang', 'ID Match', 'Pasukan', 'Pengadil', 'Sebab', 'Tindakan', 'Oleh'];
const SHEET_PEMBETULAN = 'Log_Pembetulan';
const PEMBETULAN_HEADER = ['Masa', 'Versi', 'ID Match', 'Kategori', 'Peringkat', 'Perlawanan', 'Skor Lama', 'Skor Baharu',
  'Penalti Lama', 'Penalti Baharu', 'Sebab', 'Mod Rombakan', 'Perlawanan Terkesan', 'Oleh'];
const TIMEZONE = 'Asia/Kuala_Lumpur';
// FASA 4.1: versi API (aplikasi menyemak nilai ini untuk mengesan Code.gs lama)
const API_VERSI = '1.9.0';
const GILIRAN_MAX = 6;                     // bil. perlawanan seterusnya dipaparkan per gelanggang
const API_CIRI = ['pengadil', 'kunciGelanggang', 'tangguh', 'pembetulan', 'rehatKecemasan', 'sahPengadil', 'petiKelulusan', 'giliranStandby', 'papanCache', 'sepakMulaTerus'];
// v1.9.0: Papan live disimpan dalam CacheService supaya ?action=live sangat pantas
// (paparan dashboard boleh disegerak setiap beberapa saat). Cache dibuang serta-merta
// setiap kali ada penulisan (doPost), jadi data tidak pernah ketinggalan lebih ~1 tinjauan.
const PAPAN_CACHE_KEY = 'PAPAN_LIVE_V19';
const PAPAN_CACHE_VER = 'PAPAN_LIVE_VER';
const PAPAN_CACHE_SAAT = 10;               // had maksimum umur cache (suntingan manual di Sheets)
// FASA 6: log pengesahan keputusan oleh pengadil (tambah sahaja, tidak ditulis ganti)
const SHEET_SAH_PENGADIL = 'Log_Sah_Pengadil';
const SAH_PENGADIL_HEADER = ['Masa', 'ID Match', 'Gelanggang', 'Pasukan 1', 'Skor', 'Pasukan 2', 'Menang Penalti', 'Pengadil', 'ID Pengadil'];
// Medan yang HANYA boleh ditulis oleh pengadil (skorLive) atau Master Admin
const PENGADIL_ONLY_FIELDS = ['sahPengadil', 'sahPengadilPada'];
// Tindakan perlawanan yang sah (selain PENGADIL_ACTIONS)
const MATCH_ACTIONS = ['', 'syncall', 'updatematch', 'updatematches'];

/**
 * Pilihan keselamatan: isi API_TOKEN (cth: 'kbb2026rahsia') untuk hanya menerima
 * POST yang membawa { token: 'kbb2026rahsia' }. Biarkan kosong untuk aplikasi
 * semasa (aplikasi tidak menghantar token).
 */
const API_TOKEN = '';

/**
 * KUNCI MASTER ADMIN (untuk urus akaun pengadil melalui aplikasi).
 * Mesti sama dengan PIN Master Admin dalam aplikasi (lalai: 101010).
 * Untuk menukar tanpa ubah kod: Project Settings > Script Properties >
 * tambah MASTER_ADMIN_PIN = <PIN baharu>. Script Property mengatasi nilai lalai ini.
 */
const MASTER_ADMIN_PIN_DEFAULT = '101010';

/** Lajur tab Senarai_Pengadil (ikut susunan ini). */
const PENGADIL_HEADER = ['ID Pengadil', 'Nama Ringkas', 'Kata Laluan', 'Status', 'Dicipta Pada', 'Dikemaskini Pada', 'Log Masuk Terakhir'];
const PENGADIL_ACTIONS = [
  'loginpengadil', 'senaraipengadil', 'simpanpengadil', 'padampengadil', 'syncpengadil',
  // Fasa 2: kunci gelanggang
  'logkeluarpengadil', 'statusgelanggang', 'kuncigelanggang', 'lepasgelanggang', 'skorlive',
  // Fasa 3: tangguh oleh Master Admin / Urusetia
  'tangguhadmin',
  // Fasa 4: pembetulan markah (Master Admin sahaja)
  'pembetulanskor', 'logpembetulan',
  // Fasa 5: rehat kecemasan & ambil alih pengadil
  'rehatkecemasan', 'ambilalihgelanggang', 'sambungperlawanan'
];
const PENGADIL_LOGIN_MAX_GAGAL = 5;        // cubaan gagal sebelum dikunci
const PENGADIL_LOGIN_KUNCI_SAAT = 300;     // tempoh kunci (5 minit)

/* ---------- FASA 2: SESI PENGADIL & KUNCI GELANGGANG ---------- */
const GELANGGANG_SAH = ['A', 'B', 'C', 'D'];
const KUNCI_HEADER = ['Gelanggang', 'ID Pengadil', 'Nama Pengadil', 'ID Match', 'Dikunci Pada', 'Aktiviti Terakhir',
  'Status Kunci', 'Data Rehat'];   // FASA 5: lajur 7 & 8 (Rehat Kecemasan)
const KUNCI_STATUS_REHAT = 'REHAT KECEMASAN';
const FASA_REHAT_LABEL = 'Rehat Kecemasan';
// Fasa yang boleh disambung selepas rehat kecemasan (kod aplikasi -> label Sheets)
const FASA_SAMBUNG = { 'SEPARUH 1': 'Separuh 1', 'REHAT': 'Rehat', 'SEPARUH 2': 'Separuh 2' };
const REHAT_MAX_MS = 3 * 3600 * 1000;   // had masa fasa yang direkod (3 jam)
// Kunci dianggap "tidak aktif" jika tiada aktiviti / isyarat daripada peranti pengadil
// selama tempoh ini. Hanya kunci tidak aktif boleh diambil alih oleh pengadil lain.
const KUNCI_BASI_SAAT = 900;               // 15 minit
const SESI_PREFIX = 'SESI_';               // Script Properties: SESI_<token>
const SESI_TEMPOH_JAM = 24;                // sesi log masuk pengadil sah selama 24 jam
// Medan markah yang HANYA boleh diubah oleh pengadil pemegang kunci gelanggang
const LOCK_PROTECTED_FIELDS = ['skorP1', 'skorP2', 'fasaMasa', 'status', 'pengesahan', 'pengadil', 'pemenangPenalti', 'masaTamat',
  'sahPengadil', 'sahPengadilPada'];

/* ---------- FASA 4: PEMBETULAN MARKAH ---------- */
// Medan keputusan yang DIKUNCI selepas perlawanan DISAHKAN (SELESAI).
// Hanya Master Admin (adminKey sah) boleh mengubahnya.
const FINAL_PROTECTED_FIELDS = ['skorP1', 'skorP2', 'pemenangPenalti', 'status', 'pengesahan', 'namaP1', 'namaP2', 'kodP1', 'kodP2'];
const GROUP_STAGES = ['PERINGKAT KUMPULAN', 'PUSINGAN KEDUA'];
const KNOCKOUT_STAGES = ['SUKU AKHIR', 'SEPARUH AKHIR', 'TEMPAT 3/4', 'AKHIR'];
// Medan perlawanan susulan yang boleh dihantar bersama pembetulan (hasil rombakan aplikasi)
const SUSULAN_FIELDS = ['namaP1', 'namaP2', 'skorP1', 'skorP2', 'status', 'pengesahan', 'pemenangPenalti',
  'fasaMasa', 'masaMula', 'masaTamat', 'disahkanOleh', 'disahkanPada', 'pengadil', 'catatan', 'sahPengadil', 'sahPengadilPada'];
const ADMIN_MAX_GAGAL = 8;                 // cubaan kunci Master Admin salah sebelum disekat
const ADMIN_KUNCI_SAAT = 600;              // tempoh sekatan (10 minit)

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
  // FASA 6: pengadil yang mengesahkan keputusan (nama daripada token sesi)
  sahPengadil:     ['Disahkan Pengadil', 'disahkanpengadil', 'sahpengadil', 'pengesahanpengadil'],
  sahPengadilPada: ['Masa Sah Pengadil', 'masasahpengadil', 'sahpengadilpada'],
  pemenangPenalti: ['Menang Penalti', 'pemenangpenalti', 'menangpenalti', 'penalti'],
  masaMula:        ['Masa Mula', 'masamula'],
  masaTamat:       ['Masa Tamat', 'masatamat'],
  disahkanOleh:    ['Disahkan Oleh', 'disahkanoleh'],
  disahkanPada:    ['Disahkan Pada', 'disahkanpada'],
  catatan:         ['Catatan', 'catatan', 'nota'],
  kemaskini:       ['Kemaskini Terakhir', 'kemaskini', 'kemaskiniterakhir', 'updatedat'],
  // FASA 4: cop versi pembetulan (teks). Hanya ditulis oleh pembetulanSkor_ (Master Admin).
  versiPembetulan: ['Versi Pembetulan', 'versipembetulan', 'versi']
};

// Medan yang dibenarkan dikemas kini oleh doPost (selain medan pengenalan)
const UPDATABLE = [
  'kategori', 'no', 'peringkat', 'kumpulan', 'kodP1', 'namaP1', 'skorP1', 'skorP2', 'namaP2', 'kodP2',
  'gelanggang', 'fasa', 'fasaMasa', 'status', 'pengesahan', 'pengadil', 'pemenangPenalti',
  'masaMula', 'masaTamat', 'disahkanOleh', 'disahkanPada', 'catatan', 'sahPengadil', 'sahPengadilPada'
];
const DATE_FIELDS = ['masaMula', 'masaTamat', 'disahkanPada', 'kemaskini', 'sahPengadilPada'];

const STATUS_MAP = {
  'BELUMBERMULA': 'MENUNGGU GILIRAN', 'MENUNGGU': 'MENUNGGU GILIRAN', 'MENUNGGUGILIRAN': 'MENUNGGU GILIRAN',
  'LIVE': 'LIVE', 'SEDANGBERLANGSUNG': 'LIVE',
  'TAMAT': 'TAMAT - TUNGGU SAH', 'TAMATTUNGGUSAH': 'TAMAT - TUNGGU SAH',
  'SELESAI': 'SELESAI', 'DISAHKAN': 'SELESAI'
};
const PENGESAHAN_MAP = { 'MENUNGGU': 'MENUNGGU', 'DISAHKAN': 'DISAHKAN', 'DITOLAK': 'DITOLAK', 'LULUS': 'DISAHKAN', 'SAH': 'DISAHKAN' };
const FASA_MASA_MAP = {
  'SEPARUH1': 'Separuh 1', 'REHAT': 'Rehat', 'SEPARUH2': 'Separuh 2',
  'TAMAT': 'Tamat', 'SEDIA': 'Belum Bermula', 'BELUMBERMULA': 'Belum Bermula',
  'DITANGGUHKAN': 'Ditangguhkan', 'TANGGUH': 'Ditangguhkan',
  'REHATKECEMASAN': 'Rehat Kecemasan'
};

/* =========================================================
   doGet(e) - BACA DATA
   ?action=read (lalai) | ?action=ping
   ?action=kunci       -> status kunci gelanggang A..D (tanpa token / kata laluan)
   ?action=live        -> papan live awam: perlawanan semasa setiap gelanggang + pengadil
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
      return output_({ ok: true, message: 'Live Futsal PK KBB API aktif', versi: API_VERSI, ciri: API_CIRI,
        sheetPengadil: SHEET_PENGADIL, masa: new Date().toISOString() }, p.callback);
    }
    if (action === 'live' || action === 'papanlive') {
      return output_(papanLiveCached_(), p.callback);
    }
    if (action === 'kunci' || action === 'statusgelanggang') {
      return output_({ ok: true, masa: new Date().toISOString(), basiSaat: KUNCI_BASI_SAAT, kunci: statusKunci_() }, p.callback);
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
   4) Pangkalan data pengadil (lihat bahagian PANGKALAN DATA PENGADIL di bawah):
      { action: 'loginPengadil',   nama, password }                 -> semua
      { action: 'senaraiPengadil', adminKey }                       -> Master Admin
      { action: 'simpanPengadil',  adminKey, pengadil: {...} }      -> Master Admin
      { action: 'padamPengadil',   adminKey, id }                   -> Master Admin
      { action: 'syncPengadil',    adminKey, pengadil: [ ... ] }    -> Master Admin
   5) Kunci gelanggang (Fasa 2) - token diperoleh daripada loginPengadil:
      { action: 'statusGelanggang' }                                -> semua
      { action: 'kunciGelanggang', token, gelanggang, matchId }     -> Sepak Mula (kunci)
      { action: 'kunciGelanggang', token, gelanggang, perbaharui: true } -> isyarat aktif
      { action: 'skorLive', token, gelanggang, matchId, skorP1, skorP2, fasaMasa, status, ..., lepas }
      { action: 'lepasGelanggang', token, gelanggang }              -> pengadil lepaskan
      { action: 'lepasGelanggang', adminKey, gelanggang }           -> Master Admin paksa lepas
      { action: 'logKeluarPengadil', token }                        -> tamat sesi & lepas kunci
   * Perlawanan di gelanggang yang DIKUNCI: medan markah (skor, fasa, status...) tidak
     boleh ditulis ganti oleh syncAll / updateMatch. Hanya skorLive daripada pengadil
     pemegang kunci diterima.
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

    const action = String(body.action || '').toLowerCase();

    // Pangkalan data pengadil
    if (PENGADIL_ACTIONS.indexOf(action) >= 0) {
      return output_(handlePengadil_(action, body));
    }
    if (action === 'ping') {
      return output_({ ok: true, message: 'Live Futsal PK KBB API aktif', versi: API_VERSI, ciri: API_CIRI, masa: new Date().toISOString() });
    }
    if (MATCH_ACTIONS.indexOf(action) < 0) {
      return output_({ ok: false, kod: 'TINDAKAN_TIDAK_DIKENALI', versi: API_VERSI, error: 'Tindakan tidak dikenali: ' + action });
    }

    let list = [];
    if (Array.isArray(body.matches)) list = body.matches;
    else if (action === 'updatematch' || body.id) list = [body.match || body];
    if (!list.length) return output_({ ok: false, error: 'Tiada data perlawanan diterima.' });

    // FASA 4: hanya kunci Master Admin yang sah boleh mengubah keputusan DISAHKAN
    const admin = isMasterAdmin_(body);
    const result = upsertMatches_(list, { admin: admin });

    // Carta Liga dikira semula DI PELAYAN daripada Jadual_Perlawanan (bukan dipercayai
    // bulat-bulat daripada peranti) supaya peranti dengan data lama tidak merosakkan carta.
    const carta = kiraCartaPelayan_(readTable_(getJadualSheet_()));
    if (carta.length) writeStandings_(carta);
    else if (Array.isArray(body.standings) && body.standings.length) writeStandings_(body.standings);
    if (Array.isArray(body.approvalLog) && body.approvalLog.length) writeApprovalLog_(body.approvalLog);
    // FASA 7: log Sahkan / Tolak daripada Peti Kelulusan -> ditambah, bukan ditulis ganti
    if (Array.isArray(body.logBaharu) && body.logBaharu.length) tambahApprovalLog_(body.logBaharu);

    return output_({
      ok: true,
      sheet: SHEET_JADUAL,
      dikemaskini: result.updated,
      ditambah: result.inserted,
      ditolak: result.skipped,
      dilindungi: result.protectedRows,   // perlawanan dikunci pengadil (markah tidak ditulis ganti)
      dimuktamad: result.finalRows,       // keputusan DISAHKAN yang cuba diubah tanpa kunci Master Admin
      lapuk: result.staleRows,            // data peranti lama (versi pembetulan tidak sepadan)
      masa: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    return output_({ ok: false, error: String(err && err.message || err) });
  } finally {
    bustPapanCache_();   // v1.9.0: dashboard terus nampak perubahan (sepak mula / gol / tamat)
    lock.releaseLock();
  }
}

/* =========================================================
   LOGIK UTAMA: UPSERT BARIS PERLAWANAN
   ========================================================= */
// opts.abaikanKunci = true -> hanya untuk skorLive (pengadil pemegang kunci yang telah disahkan)
// opts.admin = true        -> Master Admin disahkan (adminKey). Satu-satunya cara mengubah
//                             keputusan yang telah DISAHKAN (FASA 4).
function upsertMatches_(list, opts) {
  opts = opts || {};
  const admin = opts.admin === true;
  const lockedMatches = opts.abaikanKunci ? {} : lockedMatchIds_();
  const sheet = getJadualSheet_();
  const table = readTable_(sheet);
  const values = table.values;            // termasuk baris tajuk
  const colOf = table.colOf;              // medan -> indeks lajur (0-based)
  const width = values[0].length;
  const index = {};
  table.rows.forEach(function (r) { index[String(r.data.id).toUpperCase()] = r.rowIndex; });

  const now = new Date();
  let updated = 0, inserted = 0, skipped = 0, protectedRows = 0, finalRows = 0, staleRows = 0;

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
    const dikunci = !!lockedMatches[id];
    let dilindungi = false;
    // FASA 4: keputusan DISAHKAN dikunci; versi pembetulan menghalang data peranti lama
    const muktamad = isRowFinal_(row, colOf);
    const versiBaris = colOf.versiPembetulan !== undefined ? String(row[colOf.versiPembetulan] || '') : '';
    const versiSepadan = !versiBaris || String(m.versiPembetulan || '') === versiBaris;
    let ditolakMuktamad = false, ditolakLapuk = false;

    UPDATABLE.forEach(function (field) {
      if (!(field in m) || m[field] === undefined) return;
      // FASA 6: pengesahan pengadil hanya melalui skorLive (token pengadil) atau Master Admin
      if (PENGADIL_ONLY_FIELDS.indexOf(field) >= 0 && !admin && !opts.abaikanKunci) return;
      // Gelanggang dikunci pengadil: markah hanya boleh diubah oleh pengadil tersebut
      if (dikunci && LOCK_PROTECTED_FIELDS.indexOf(field) >= 0) { dilindungi = true; return; }
      const nilai = cleanValue_(field, m[field]);
      if (!admin && FINAL_PROTECTED_FIELDS.indexOf(field) >= 0 && !samaNilai_(row[colOf[field]], nilai)) {
        // Pengadil / Urusetia / peranti lain tidak boleh mengubah keputusan muktamad
        if (muktamad) { ditolakMuktamad = true; return; }
        // Baris yang telah dibetulkan: hanya peranti yang memegang versi terkini diterima
        // (skorLive pengadil pemegang kunci dikecualikan untuk perlawanan main semula)
        if (!versiSepadan && !opts.abaikanKunci) { ditolakLapuk = true; return; }
      }
      row[colOf[field]] = nilai;
    });
    // FASA 7: keputusan DITOLAK -> pengesahan pengadil dikosongkan (perlu disahkan semula)
    if (!ditolakMuktamad && !dilindungi && String(row[colOf.pengesahan] || '').toUpperCase() === 'DITOLAK' &&
        cleanValue_('pengesahan', m.pengesahan || '') === 'DITOLAK') {
      if (colOf.sahPengadil !== undefined) row[colOf.sahPengadil] = '';
      if (colOf.sahPengadilPada !== undefined) row[colOf.sahPengadilPada] = '';
    }
    if (admin && m.versiPembetulan !== undefined && colOf.versiPembetulan !== undefined) {
      row[colOf.versiPembetulan] = String(m.versiPembetulan || '').slice(0, 60);
    }
    if (dilindungi) protectedRows++;
    if (ditolakMuktamad) finalRows++;
    if (ditolakLapuk) staleRows++;
    row[colOf.kemaskini] = now;
  });

  // Tulis semula sekaligus (lebih pantas daripada setValue satu persatu)
  if (colOf.versiPembetulan !== undefined) {
    sheet.getRange(1, colOf.versiPembetulan + 1, values.length, 1).setNumberFormat('@');
  }
  sheet.getRange(1, 1, values.length, width).setValues(values);
  formatDateColumns_(sheet, colOf, values.length);
  return { updated: updated, inserted: inserted, skipped: skipped, protectedRows: protectedRows, finalRows: finalRows, staleRows: staleRows };
}

// Baris perlawanan telah DISAHKAN (SELESAI) -> keputusan muktamad
function isRowFinal_(row, colOf) {
  const st = String(row[colOf.status] || '').toUpperCase();
  const sah = String(row[colOf.pengesahan] || '').toUpperCase();
  return st === 'SELESAI' && sah === 'DISAHKAN';
}

function samaNilai_(a, b) {
  const x = (a === null || a === undefined) ? '' : a;
  const y = (b === null || b === undefined) ? '' : b;
  if (x instanceof Date || y instanceof Date) return toIso_(x) === toIso_(y);
  return String(x) === String(y);
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

// FASA 7: tambah baris log pengesahan (Sahkan / Tolak) tanpa memadam log sedia ada
function tambahApprovalLog_(log) {
  const sheet = getOrCreateSheet_(SHEET_LOG);
  const header = ['Masa', 'Match', 'Keputusan', 'Tindakan', 'Oleh'];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  const rows = log.slice(0, 50).map(function (l) {
    const d = new Date(l && l.masa);
    return [isNaN(d.getTime()) ? new Date() : d, String(l && l.matchId || '').slice(0, 20),
      String(l && l.keputusan || '').slice(0, 300), String(l && l.tindakan || '').slice(0, 300), String(l && l.oleh || '').slice(0, 100)];
  });
  if (!rows.length) return;
  const start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, rows.length, header.length).setValues(rows);
  sheet.getRange(start, 1, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

/* =========================================================
   PANGKALAN DATA PENGADIL (tab Senarai_Pengadil)
   - Master Admin sahaja boleh cipta / ubah / gantung / padam akaun.
   - Kata laluan disimpan supaya Master Admin boleh melihat & mengurusnya.
     Jangan kongsi Google Sheet ini kepada orang lain.
   ========================================================= */
function handlePengadil_(action, body) {
  // Tindakan pengadil (disahkan dengan token sesi masing-masing)
  switch (action) {
    case 'loginpengadil':     return loginPengadil_(body);
    case 'logkeluarpengadil': return logKeluarPengadil_(body);
    case 'statusgelanggang':  return { ok: true, masa: new Date().toISOString(), basiSaat: KUNCI_BASI_SAAT, kunci: statusKunci_() };
    case 'kuncigelanggang':   return kunciGelanggang_(body);
    case 'lepasgelanggang':   return lepasGelanggang_(body);
    case 'skorlive':          return skorLive_(body);
    case 'tangguhadmin':      return tangguhAdmin_(body);
    // FASA 5
    case 'rehatkecemasan':      return rehatKecemasan_(body);
    case 'ambilalihgelanggang': return ambilAlihGelanggang_(body);
    case 'sambungperlawanan':   return sambungPerlawanan_(body);
  }

  // FASA 4: sekat cubaan meneka PIN Master Admin
  const cache = CacheService.getScriptCache();
  const gagalAdmin = Number(cache.get('admingagal') || 0);
  if (gagalAdmin >= ADMIN_MAX_GAGAL) {
    return { ok: false, kod: 'DISEKAT', error: 'Terlalu banyak cubaan kunci Master Admin yang salah. Cuba lagi selepas 10 minit.' };
  }
  if (!isMasterAdmin_(body)) {
    if (body && body.adminKey) cache.put('admingagal', String(gagalAdmin + 1), ADMIN_KUNCI_SAAT);
    return { ok: false, kod: 'BUKAN_ADMIN', error: 'Akses ditolak: hanya Master Admin dibenarkan. Kunci Master Admin tidak sah.' };
  }
  if (gagalAdmin) cache.remove('admingagal');
  switch (action) {
    case 'pembetulanskor':  return pembetulanSkor_(body);
    case 'logpembetulan':   return { ok: true, log: bacaLogPembetulan_(100) };
    case 'senaraipengadil': return { ok: true, pengadil: readPengadil_().list.map(publicPengadilAdmin_) };
    case 'simpanpengadil':  return simpanPengadil_(body.pengadil || {});
    case 'padampengadil':   return padamPengadil_(body.id || (body.pengadil && body.pengadil.id));
    case 'syncpengadil':    return syncPengadil_(body.pengadil);
    default:                return { ok: false, error: 'Tindakan pengadil tidak dikenali.' };
  }
}

function getMasterAdminKey_() {
  const v = PropertiesService.getScriptProperties().getProperty('MASTER_ADMIN_PIN');
  return String(v || MASTER_ADMIN_PIN_DEFAULT);
}

function isMasterAdmin_(body) {
  const key = String((body && body.adminKey) || '');
  return key !== '' && key === getMasterAdminKey_();
}

function refNameKey_(nama) {
  return String(nama || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function getPengadilSheet_() {
  const sheet = getOrCreateSheet_(SHEET_PENGADIL);
  const first = sheet.getRange(1, 1, 1, PENGADIL_HEADER.length).getValues()[0];
  if (first.join('') === '') {
    sheet.getRange(1, 1, 1, PENGADIL_HEADER.length).setValues([PENGADIL_HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  // Lajur Kata Laluan sebagai teks biasa (kekalkan sifar di hadapan, cth: 0123)
  sheet.getRange(1, 3, sheet.getMaxRows(), 1).setNumberFormat('@');
  return sheet;
}

function readPengadil_() {
  const sheet = getPengadilSheet_();
  const last = sheet.getLastRow();
  const list = [];
  if (last >= 2) {
    const values = sheet.getRange(2, 1, last - 1, PENGADIL_HEADER.length).getValues();
    values.forEach(function (r, i) {
      if (!r[0] && !r[1]) return;
      list.push({
        row: i + 2,
        id: String(r[0]).trim(),
        nama: String(r[1]).trim(),
        password: String(r[2]),
        status: String(r[3] || 'AKTIF').toUpperCase() === 'DIGANTUNG' ? 'DIGANTUNG' : 'AKTIF',
        dicipta: toIso_(r[4]),
        dikemaskini: toIso_(r[5]),
        loginTerakhir: toIso_(r[6])
      });
    });
  }
  return { sheet: sheet, list: list };
}

function writePengadil_(sheet, list) {
  const last = sheet.getLastRow();
  if (last >= 2) sheet.getRange(2, 1, last - 1, PENGADIL_HEADER.length).clearContent();
  if (!list.length) return;
  const rows = list.map(function (p) {
    return [p.id, p.nama, String(p.password), p.status, toDate_(p.dicipta), toDate_(p.dikemaskini), toDate_(p.loginTerakhir)];
  });
  sheet.getRange(2, 3, rows.length, 1).setNumberFormat('@');
  sheet.getRange(2, 1, rows.length, PENGADIL_HEADER.length).setValues(rows);
  sheet.getRange(2, 5, rows.length, 3).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

// Semak & bersihkan satu rekod pengadil. Pulangkan { error } atau { data }.
function validatePengadil_(p, existing) {
  const nama = String(p.nama || '').replace(/\s+/g, ' ').trim();
  const password = String(p.password === undefined || p.password === null ? '' : p.password);
  if (nama.length < 2 || nama.length > 30) return { error: 'Nama ringkas mesti 2 hingga 30 aksara.' };
  if (!/^\S{4,20}$/.test(password)) return { error: 'Kata laluan mesti 4 hingga 20 aksara tanpa ruang (' + nama + ').' };
  const dup = existing.some(function (e) { return e.id !== p.id && refNameKey_(e.nama) === refNameKey_(nama); });
  if (dup) return { error: 'Nama "' + nama + '" telah digunakan oleh pengadil lain.' };
  return {
    data: {
      id: String(p.id || '').trim().toUpperCase(),
      nama: nama,
      password: password,
      status: String(p.status || 'AKTIF').toUpperCase() === 'DIGANTUNG' ? 'DIGANTUNG' : 'AKTIF',
      dicipta: p.dicipta || null,
      dikemaskini: p.dikemaskini || null,
      loginTerakhir: p.loginTerakhir || null
    }
  };
}

function nextPengadilId_(list) {
  let max = 0;
  list.forEach(function (p) {
    const m = /^REF-(\d+)$/.exec(p.id);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return 'REF-' + String(max + 1).padStart(3, '0');
}

function simpanPengadil_(p) {
  const db = readPengadil_();
  const v = validatePengadil_(p, db.list);
  if (v.error) return { ok: false, error: v.error };
  const now = new Date().toISOString();
  const data = v.data;
  const idx = data.id ? db.list.findIndex(function (e) { return e.id === data.id; }) : -1;
  if (idx >= 0) {
    const old = db.list[idx];
    data.dicipta = old.dicipta || data.dicipta || now;
    data.loginTerakhir = old.loginTerakhir || data.loginTerakhir;
    data.dikemaskini = now;
    db.list[idx] = data;
  } else {
    if (!/^REF-\d+$/.test(data.id) || db.list.some(function (e) { return e.id === data.id; })) data.id = nextPengadilId_(db.list);
    data.dicipta = data.dicipta || now;
    data.dikemaskini = now;
    db.list.push(data);
  }
  writePengadil_(db.sheet, db.list);
  SpreadsheetApp.flush();
  // Sahkan rekod benar-benar wujud dalam tab Senarai_Pengadil
  const semak = readPengadil_().list.find(function (e) { return e.id === data.id; });
  if (!semak || refNameKey_(semak.nama) !== refNameKey_(data.nama) || semak.password !== String(data.password)) {
    return { ok: false, kod: 'GAGAL_TULIS', error: 'Akaun ' + data.nama + ' gagal ditulis ke tab ' + SHEET_PENGADIL + '. Cuba lagi.' };
  }
  kemasKunciPengadil_(data);
  return { ok: true, disahkan: true, sheet: SHEET_PENGADIL, jumlah: db.list.length, pengadil: publicPengadilAdmin_(data) };
}

function padamPengadil_(id) {
  const key = String(id || '').trim().toUpperCase();
  if (!key) return { ok: false, error: 'ID pengadil diperlukan.' };
  const db = readPengadil_();
  const next = db.list.filter(function (e) { return e.id !== key; });
  if (next.length === db.list.length) return { ok: false, error: 'Pengadil ' + key + ' tidak dijumpai.' };
  writePengadil_(db.sheet, next);
  SpreadsheetApp.flush();
  lepasKunciPengadil_(key);
  return { ok: true, dipadam: key };
}

// Gantikan keseluruhan senarai (butang "Hantar ke Sheets" dalam aplikasi)
function syncPengadil_(list) {
  if (!Array.isArray(list)) return { ok: false, error: 'Senarai pengadil tidak sah.' };
  const db = readPengadil_();
  const clean = [];
  const ids = {};
  for (let i = 0; i < list.length; i++) {
    const v = validatePengadil_(list[i] || {}, clean);
    if (v.error) return { ok: false, error: v.error };
    if (!/^REF-\d+$/.test(v.data.id) || ids[v.data.id]) v.data.id = nextPengadilId_(clean.concat(db.list));
    ids[v.data.id] = true;
    v.data.dicipta = v.data.dicipta || new Date().toISOString();
    v.data.dikemaskini = v.data.dikemaskini || new Date().toISOString();
    clean.push(v.data);
  }
  writePengadil_(db.sheet, clean);
  SpreadsheetApp.flush();
  if (readPengadil_().list.length !== clean.length) {
    return { ok: false, kod: 'GAGAL_TULIS', error: 'Senarai pengadil gagal ditulis sepenuhnya ke tab ' + SHEET_PENGADIL + '. Cuba lagi.' };
  }
  // Lepaskan kunci milik pengadil yang dipadam / digantung
  const aktif = {};
  clean.forEach(function (p) { if (p.status === 'AKTIF') aktif[p.id] = p.nama; });
  const kdb = readKunci_();
  GELANGGANG_SAH.forEach(function (g) {
    const k = kdb.map[g];
    if (k && k.pengadilId && !aktif[k.pengadilId]) kosongKunci_(kdb.sheet, k);
  });
  return { ok: true, jumlah: clean.length, pengadil: clean.map(publicPengadilAdmin_) };
}

function loginPengadil_(body) {
  const nama = String(body.nama || '').replace(/\s+/g, ' ').trim();
  const password = String(body.password === undefined || body.password === null ? '' : body.password);
  if (!nama || !password) return { ok: false, error: 'Sila masukkan nama ringkas dan kata laluan.' };

  const cache = CacheService.getScriptCache();
  const lockKey = 'refgagal_' + refNameKey_(nama).replace(/[^a-z0-9]/g, '_').slice(0, 200);
  const gagal = Number(cache.get(lockKey) || 0);
  if (gagal >= PENGADIL_LOGIN_MAX_GAGAL) {
    return { ok: false, error: 'Terlalu banyak cubaan gagal. Cuba lagi selepas 5 minit.' };
  }

  const db = readPengadil_();
  const ref = db.list.find(function (e) { return refNameKey_(e.nama) === refNameKey_(nama); });
  if (!ref || ref.password !== password) {
    cache.put(lockKey, String(gagal + 1), PENGADIL_LOGIN_KUNCI_SAAT);
    return { ok: false, error: 'Nama ringkas atau kata laluan pengadil tidak sah.' };
  }
  if (ref.status !== 'AKTIF') {
    return { ok: false, error: 'Akaun pengadil ini telah digantung. Hubungi Master Admin.' };
  }
  cache.remove(lockKey);
  const now = new Date();
  db.sheet.getRange(ref.row, 7).setValue(now).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  // Kata laluan TIDAK dipulangkan kepada peranti pengadil.
  // Token sesi digunakan untuk mengunci gelanggang & menghantar markah (Fasa 2).
  return {
    ok: true,
    token: ciptaSesi_(ref),
    sesiTamat: new Date(now.getTime() + SESI_TEMPOH_JAM * 3600 * 1000).toISOString(),
    pengadil: { id: ref.id, nama: ref.nama, status: ref.status, loginTerakhir: now.toISOString() },
    kunci: statusKunci_()
  };
}

// Data penuh untuk Master Admin (termasuk kata laluan)
function publicPengadilAdmin_(p) {
  return {
    id: p.id, nama: p.nama, password: p.password, status: p.status,
    dicipta: p.dicipta || null, dikemaskini: p.dikemaskini || null, loginTerakhir: p.loginTerakhir || null
  };
}

/* =========================================================
   FASA 2: SESI PENGADIL & KUNCI GELANGGANG (tab Kunci_Gelanggang)
   Aliran: loginPengadil (dapat token) -> pilih gelanggang -> "Sepak Mula"
           (kunciGelanggang) -> skorLive (markah) -> Tamat & Hantar (skorLive lepas:true)
   - Satu gelanggang hanya boleh dikunci oleh SATU pengadil pada satu masa.
   - Satu pengadil hanya memegang SATU gelanggang pada satu masa.
   - Semua tindakan berjalan di bawah LockService (doPost) -> tiada perlumbaan.
   ========================================================= */
function ciptaSesi_(ref) {
  const props = PropertiesService.getScriptProperties();
  bersihSesi_(props);
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
  props.setProperty(SESI_PREFIX + token, JSON.stringify({ refId: ref.id, masa: Date.now() }));
  return token;
}

function bersihSesi_(props) {
  const all = props.getProperties();
  const had = Date.now() - SESI_TEMPOH_JAM * 3600 * 1000;
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(SESI_PREFIX) !== 0) return;
    let v = null;
    try { v = JSON.parse(all[k]); } catch (err) { v = null; }
    if (!v || !v.masa || v.masa < had) props.deleteProperty(k);
  });
}

function sesiTamat_(msg) {
  return { ok: false, kod: 'SESI_TAMAT', error: msg || 'Sesi pengadil tidak sah atau telah tamat. Sila log masuk semula.' };
}

// Sahkan token sesi -> { ok, ref, token } atau ralat
function sahkanSesi_(token) {
  const t = String(token || '').toLowerCase().replace(/[^a-f0-9]/g, '');
  if (t.length < 32) return sesiTamat_();
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(SESI_PREFIX + t);
  if (!raw) return sesiTamat_();
  let v = null;
  try { v = JSON.parse(raw); } catch (err) { v = null; }
  if (!v || !v.refId || Date.now() - Number(v.masa || 0) > SESI_TEMPOH_JAM * 3600 * 1000) {
    props.deleteProperty(SESI_PREFIX + t);
    return sesiTamat_('Sesi pengadil telah tamat tempoh. Sila log masuk semula.');
  }
  const ref = readPengadil_().list.find(function (e) { return e.id === v.refId; });
  if (!ref) return sesiTamat_('Akaun pengadil ini tidak lagi wujud. Hubungi Master Admin.');
  if (ref.status !== 'AKTIF') return { ok: false, kod: 'DIGANTUNG', error: 'Akaun pengadil ini telah digantung. Hubungi Master Admin.' };
  return { ok: true, ref: ref, token: t };
}

function normGelanggang_(g) {
  const v = String(g || '').trim().toUpperCase();
  return GELANGGANG_SAH.indexOf(v) >= 0 ? v : '';
}

function normMatchId_(id) {
  const v = String(id || '').trim().toUpperCase();
  return /^(SR|SM)-\d{1,2}$/.test(v) ? v : '';
}

function getKunciSheet_() {
  const sheet = getOrCreateSheet_(SHEET_KUNCI);
  const first = sheet.getRange(1, 1, 1, KUNCI_HEADER.length).getValues()[0];
  if (first.join('') === '') {
    sheet.getRange(1, 1, 1, KUNCI_HEADER.length).setValues([KUNCI_HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else if (first.slice(6).join('') === '') {
    // FASA 5: tab lama (6 lajur) -> tambah tajuk Status Kunci & Data Rehat
    sheet.getRange(1, 7, 1, KUNCI_HEADER.length - 6).setValues([KUNCI_HEADER.slice(6)]).setFontWeight('bold');
  }
  // Data Rehat (JSON) sebagai teks biasa
  sheet.getRange(1, 8, sheet.getMaxRows(), 1).setNumberFormat('@');
  const last = sheet.getLastRow();
  const ada = last >= 2
    ? sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]).trim().toUpperCase(); })
    : [];
  const tambah = GELANGGANG_SAH
    .filter(function (g) { return ada.indexOf(g) < 0; })
    .map(function (g) { return [g, '', '', '', '', '', '', '']; });
  if (tambah.length) {
    sheet.getRange(Math.max(last, 1) + 1, 1, tambah.length, KUNCI_HEADER.length).setValues(tambah);
  }
  return sheet;
}

function readKunci_() {
  const sheet = getKunciSheet_();
  const last = sheet.getLastRow();
  const map = {};
  if (last >= 2) {
    sheet.getRange(2, 1, last - 1, KUNCI_HEADER.length).getValues().forEach(function (r, i) {
      const g = String(r[0]).trim().toUpperCase();
      if (GELANGGANG_SAH.indexOf(g) < 0 || map[g]) return;
      map[g] = {
        row: i + 2,
        gelanggang: g,
        pengadilId: String(r[1] || '').trim(),
        nama: String(r[2] || '').trim(),
        matchId: String(r[3] || '').trim().toUpperCase(),
        dikunciPada: toIso_(r[4]),
        aktiviti: toIso_(r[5]),
        rehat: bacaRehat_(r[6], r[7], String(r[3] || '').trim().toUpperCase())   // FASA 5
      };
    });
  }
  return { sheet: sheet, map: map };
}

function tulisKunci_(sheet, k) {
  sheet.getRange(k.row, 8, 1, 1).setNumberFormat('@');
  sheet.getRange(k.row, 1, 1, KUNCI_HEADER.length).setValues([[
    k.gelanggang, k.pengadilId || '', k.nama || '', k.matchId || '', toDate_(k.dikunciPada), toDate_(k.aktiviti),
    k.rehat ? KUNCI_STATUS_REHAT : (k.pengadilId ? 'AKTIF' : ''),
    k.rehat ? JSON.stringify(k.rehat) : ''
  ]]);
  sheet.getRange(k.row, 5, 1, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

// Lepaskan kunci pengadil.
// FASA 5: jika gelanggang dalam REHAT KECEMASAN, status rehat & ID Match DIKEKALKAN
// (markah kekal dibekukan & pengadil lain boleh mengambil alih). penuh = true -> kosongkan semua.
function kosongKunci_(sheet, k, penuh) {
  const kekalRehat = !penuh && !!k.rehat;
  k.pengadilId = ''; k.nama = ''; k.dikunciPada = null; k.aktiviti = null;
  if (!kekalRehat) { k.matchId = ''; k.rehat = null; }
  tulisKunci_(sheet, k);
}

// FASA 5: baca lajur Status Kunci + Data Rehat -> objek rehat atau null
function bacaRehat_(status, json, matchId) {
  if (String(status || '').trim().toUpperCase() !== KUNCI_STATUS_REHAT) return null;
  let v = null;
  try { v = JSON.parse(String(json || '')); } catch (err) { v = null; }
  if (!v || typeof v !== 'object') v = {};
  return {
    pada: v.pada || null,
    sebab: String(v.sebab || ''),
    olehId: String(v.olehId || ''),
    oleh: String(v.oleh || ''),
    fasaSebelum: FASA_SAMBUNG[v.fasaSebelum] ? v.fasaSebelum : 'SEPARUH 1',
    elapsedMs: Math.max(0, Math.min(REHAT_MAX_MS, Number(v.elapsedMs) || 0)),
    skorP1: skorInt_(v.skorP1) === null ? 0 : skorInt_(v.skorP1),
    skorP2: skorInt_(v.skorP2) === null ? 0 : skorInt_(v.skorP2),
    matchId: normMatchId_(v.matchId) || matchId || '',
    diambilAlihOleh: String(v.diambilAlihOleh || '')
  };
}

function isKunciBasi_(k, nowMs) {
  if (!k || !k.pengadilId) return false;
  const t = k.aktiviti ? new Date(k.aktiviti).getTime() : 0;
  return !t || (nowMs - t) > KUNCI_BASI_SAAT * 1000;
}

// Maklumat kunci untuk dipaparkan kepada semua peranti (tiada token / kata laluan)
function kunciAwam_(k, nowMs) {
  if (!k || (!k.pengadilId && !k.rehat)) return null;
  return {
    pengadilId: k.pengadilId || null, nama: k.nama || null, matchId: k.matchId || null,
    dikunciPada: k.dikunciPada, aktivitiTerakhir: k.aktiviti, basi: isKunciBasi_(k, nowMs),
    rehat: k.rehat || null   // FASA 5 (tiada data sulit)
  };
}

function statusKunci_(db) {
  db = db || readKunci_();
  const now = Date.now();
  const out = {};
  GELANGGANG_SAH.forEach(function (g) { out[g] = kunciAwam_(db.map[g], now); });
  return out;
}

// matchId -> nama pengadil bagi perlawanan yang sedang dikunci
function lockedMatchIds_() {
  const out = {};
  try {
    const db = readKunci_();
    GELANGGANG_SAH.forEach(function (g) {
      const k = db.map[g];
      if (k && k.pengadilId && k.matchId) out[k.matchId] = k.nama;
      // FASA 5: perlawanan dalam Rehat Kecemasan kekal dilindungi walaupun tiada pengadil
      else if (k && k.rehat && k.matchId) out[k.matchId] = 'Rehat Kecemasan (menunggu pengadil)';
    });
  } catch (err) {
    console.warn('lockedMatchIds_', err);
  }
  return out;
}

function lepasKunciPengadil_(refId) {
  if (!refId) return 0;
  const db = readKunci_();
  let n = 0;
  GELANGGANG_SAH.forEach(function (g) {
    const k = db.map[g];
    if (k && k.pengadilId === refId) { kosongKunci_(db.sheet, k); n++; }
  });
  return n;
}

// Selepas Master Admin ubah / gantung pengadil: kemas kini nama atau lepaskan kunci
function kemasKunciPengadil_(p) {
  if (!p || !p.id) return;
  if (p.status !== 'AKTIF') { lepasKunciPengadil_(p.id); return; }
  const db = readKunci_();
  GELANGGANG_SAH.forEach(function (g) {
    const k = db.map[g];
    if (k && k.pengadilId === p.id && k.nama !== p.nama) { k.nama = p.nama; tulisKunci_(db.sheet, k); }
  });
}

// "Sepak Mula": kunci gelanggang untuk pengadil (atau perbaharui isyarat aktif)
function kunciGelanggang_(body) {
  const g = normGelanggang_(body.gelanggang);
  if (!g) return { ok: false, error: 'Gelanggang tidak sah.' };
  const sesi = sahkanSesi_(body.token);
  if (!sesi.ok) return sesi;
  const ref = sesi.ref;
  const db = readKunci_();
  const k = db.map[g];
  const now = new Date();
  const nowMs = now.getTime();
  const perbaharui = body.perbaharui === true || body.perbaharui === 'true';

  // FASA 5: gelanggang dalam Rehat Kecemasan hanya boleh diambil alih melalui ambilAlihGelanggang
  if (!perbaharui && k.rehat && k.pengadilId !== ref.id) {
    return {
      ok: false, kod: 'REHAT',
      error: 'Gelanggang ' + g + ' sedang Rehat Kecemasan. Gunakan butang "Ambil Alih Gelanggang" untuk meneruskan perlawanan ini.',
      kunci: statusKunci_(db)
    };
  }

  if (k.pengadilId && k.pengadilId !== ref.id) {
    if (perbaharui) {
      return { ok: false, kod: 'HILANG', error: 'Kawalan Gelanggang ' + g + ' kini dipegang oleh ' + k.nama + '.', kunci: statusKunci_(db) };
    }
    if (!isKunciBasi_(k, nowMs)) {
      return {
        ok: false, kod: 'DIKUNCI',
        error: 'Gelanggang ' + g + ' sedang dikunci oleh ' + k.nama + '. Pengadil lain tidak boleh masuk campur.',
        kunci: statusKunci_(db)
      };
    }
  }
  if (perbaharui && k.pengadilId !== ref.id) {
    return { ok: false, kod: 'HILANG', error: 'Kunci Gelanggang ' + g + ' telah dilepaskan.', kunci: statusKunci_(db) };
  }

  const diambilAlihDaripada = k.pengadilId && k.pengadilId !== ref.id ? k.nama : null;
  const sediaAda = k.pengadilId === ref.id;

  // Seorang pengadil hanya memegang satu gelanggang
  GELANGGANG_SAH.forEach(function (o) {
    const x = db.map[o];
    if (o !== g && x && x.pengadilId === ref.id) kosongKunci_(db.sheet, x);
  });

  const matchId = normMatchId_(body.matchId);
  k.pengadilId = ref.id;
  k.nama = ref.nama;
  if (matchId && !k.rehat) k.matchId = matchId;   // FASA 5: perlawanan dibekukan tidak boleh ditukar
  if (!sediaAda) k.dikunciPada = now.toISOString();
  k.aktiviti = now.toISOString();
  tulisKunci_(db.sheet, k);

  // v1.9.0: { mula: true } -> perlawanan terus ditanda LIVE dalam panggilan yang sama
  // (dashboard nampak "LIVE" lebih cepat; tidak perlu menunggu panggilan skorLive kedua).
  let dimulakan = false;
  const mula = !perbaharui && (body.mula === true || body.mula === 'true');
  if (mula && matchId && !k.rehat) {
    const m = cariPerlawanan_(matchId);
    if (m && String(m.status || '').toUpperCase() === 'MENUNGGU GILIRAN' &&
        normGelanggang_(m.gelanggang) === g && !isNamaPlaceholder_(m.namaP1) && !isNamaPlaceholder_(m.namaP2)) {
      upsertMatches_([{
        id: matchId, gelanggang: g, status: 'LIVE', skorP1: 0, skorP2: 0, fasaMasa: 'Separuh 1',
        masaMula: now.toISOString(), masaTamat: '', pengesahan: 'MENUNGGU', pemenangPenalti: '',
        pengadil: ref.nama, catatan: ''
      }], { abaikanKunci: true });
      dimulakan = true;
    }
  }

  return {
    ok: true,
    gelanggang: g,
    dimulakan: dimulakan,
    diperbaharui: sediaAda,
    diambilAlihDaripada: diambilAlihDaripada,
    kunci: statusKunci_(db)
  };
}

// Lepaskan kunci: pengadil pemegang (token) atau Master Admin (adminKey)
function lepasGelanggang_(body) {
  const g = normGelanggang_(body.gelanggang);
  const db = readKunci_();
  if (isMasterAdmin_(body)) {
    (g ? [g] : GELANGGANG_SAH).forEach(function (x) {
      const k = db.map[x];
      if (k && k.pengadilId) kosongKunci_(db.sheet, k);
    });
    return { ok: true, olehAdmin: true, kunci: statusKunci_(db) };
  }
  const sesi = sahkanSesi_(body.token);
  if (!sesi.ok) return sesi;
  const targets = g ? [g] : GELANGGANG_SAH;
  for (let i = 0; i < targets.length; i++) {
    const k = db.map[targets[i]];
    if (!k || !k.pengadilId) continue;
    if (k.pengadilId !== sesi.ref.id) {
      if (g) return { ok: false, kod: 'DIKUNCI', error: 'Anda bukan pemegang kunci Gelanggang ' + g + '.', kunci: statusKunci_(db) };
      continue;
    }
    kosongKunci_(db.sheet, k);
  }
  return { ok: true, kunci: statusKunci_(db) };
}

// Markah live daripada pengadil pemegang kunci
function skorLive_(body) {
  const g = normGelanggang_(body.gelanggang);
  if (!g) return { ok: false, error: 'Gelanggang tidak sah.' };
  const sesi = sahkanSesi_(body.token);
  if (!sesi.ok) return sesi;
  const ref = sesi.ref;
  const db = readKunci_();
  const k = db.map[g];
  if (!k.pengadilId) {
    return { ok: false, kod: 'TIADA_KUNCI', error: 'Gelanggang ' + g + ' belum dikunci. Tekan "Sepak Mula" dahulu.', kunci: statusKunci_(db) };
  }
  if (k.pengadilId !== ref.id) {
    return { ok: false, kod: 'HILANG', error: 'Gelanggang ' + g + ' dikunci oleh ' + k.nama + '. Markah anda tidak diterima.', kunci: statusKunci_(db) };
  }
  const id = normMatchId_(body.matchId);
  if (!id) return { ok: false, error: 'ID perlawanan tidak sah.' };
  if (k.matchId && k.matchId !== id) {
    return { ok: false, error: 'Perlawanan ' + id + ' tidak sepadan dengan kunci Gelanggang ' + g + ' (' + k.matchId + ').' };
  }
  // FASA 5: markah DIBEKUKAN semasa Rehat Kecemasan
  if (k.rehat) {
    return {
      ok: false, kod: 'REHAT',
      error: 'Perlawanan ' + id + ' sedang Rehat Kecemasan. Markah dibekukan - tekan "Sambung Perlawanan" dahulu.',
      kunci: statusKunci_(db)
    };
  }

  const tangguh = body.tangguh === true || body.tangguh === 'true';
  const data = { id: id, pengadil: ref.nama, gelanggang: g };
  ['skorP1', 'skorP2', 'fasaMasa', 'status', 'pengesahan', 'pemenangPenalti', 'masaMula', 'masaTamat', 'catatan'].forEach(function (f) {
    if (f in body && body[f] !== undefined) data[f] = body[f];
  });
  if (tangguh) {
    // Tangguh: perlawanan kembali menunggu giliran, skor & masa mula dikosongkan
    data.status = 'MENUNGGU GILIRAN';
    data.fasaMasa = 'Ditangguhkan';
    data.skorP1 = ''; data.skorP2 = ''; data.masaMula = ''; data.masaTamat = '';
    data.pengesahan = 'MENUNGGU'; data.pemenangPenalti = '';
    data.catatan = 'Ditangguhkan: ' + String(body.sebab || 'Sepak mula terlalu awal').slice(0, 200);
    data.sahPengadil = ''; data.sahPengadilPada = '';
  }
  // FASA 6: pengadil mengesahkan keputusan -> nama diambil daripada token sesi
  const sahkan = !tangguh && (body.sahkan === true || body.sahkan === 'true') &&
    cleanValue_('status', data.status || '') === 'TAMAT - TUNGGU SAH';
  const sahPada = new Date();
  if (sahkan) {
    data.sahPengadil = ref.nama;
    data.sahPengadilPada = sahPada.toISOString();
  }
  upsertMatches_([data], { abaikanKunci: true });
  if (sahkan) {
    logSahPengadil_({ masa: sahPada, matchId: id, gelanggang: g, ref: ref, skorP1: data.skorP1, skorP2: data.skorP2,
      pemenangPenalti: data.pemenangPenalti || '' });
  }

  const lepas = body.lepas === true || body.lepas === 'true';
  if (tangguh) {
    logTangguh_({ gelanggang: g, matchId: id, pasukan: body.pasukan || '', pengadil: ref.nama,
      sebab: body.sebab || '', tindakan: lepas ? 'TANGGUH + TUKAR PENGADIL' : 'TANGGUH (pengadil kekal)', oleh: ref.nama });
  }
  if (lepas) {
    kosongKunci_(db.sheet, k, true);
  } else {
    k.matchId = id;
    k.aktiviti = new Date().toISOString();
    tulisKunci_(db.sheet, k);
  }
  return { ok: true, dilepaskan: lepas, disahkanPengadil: sahkan ? ref.nama : null, masa: new Date().toISOString() };
}

// FASA 6: catat setiap pengesahan keputusan oleh pengadil (tab Log_Sah_Pengadil)
function logSahPengadil_(x) {
  const sheet = getOrCreateSheet_(SHEET_SAH_PENGADIL);
  if (sheet.getRange(1, 1, 1, SAH_PENGADIL_HEADER.length).getValues()[0].join('') === '') {
    sheet.getRange(1, 1, 1, SAH_PENGADIL_HEADER.length).setValues([SAH_PENGADIL_HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  const m = cariPerlawanan_(x.matchId) || {};
  sheet.appendRow([x.masa, x.matchId, x.gelanggang, m.namaP1 || '', (skorInt_(x.skorP1) || 0) + ' - ' + (skorInt_(x.skorP2) || 0),
    m.namaP2 || '', x.pemenangPenalti || '', x.ref.nama, x.ref.id]);
  sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
}

/* =========================================================
   FASA 3: TANGGUH PERLAWANAN & PAPAN LIVE AWAM
   ========================================================= */
function getTangguhSheet_() {
  const sheet = getOrCreateSheet_(SHEET_TANGGUH);
  if (sheet.getRange(1, 1, 1, TANGGUH_HEADER.length).getValues()[0].join('') === '') {
    sheet.getRange(1, 1, 1, TANGGUH_HEADER.length).setValues([TANGGUH_HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function logTangguh_(t) {
  try {
    const sheet = getTangguhSheet_();
    sheet.appendRow([new Date(), t.gelanggang, t.matchId, t.pasukan, t.pengadil, String(t.sebab || '').slice(0, 200), t.tindakan, t.oleh]);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  } catch (err) {
    console.warn('logTangguh_', err);
  }
}

// Master Admin (adminKey) tangguh perlawanan di mana-mana gelanggang & lepaskan kunci pengadil
function tangguhAdmin_(body) {
  if (!isMasterAdmin_(body)) return { ok: false, error: 'Hanya Master Admin boleh menangguhkan perlawanan gelanggang lain.' };
  const g = normGelanggang_(body.gelanggang);
  const id = normMatchId_(body.matchId);
  if (!g || !id) return { ok: false, error: 'Gelanggang / ID perlawanan tidak sah.' };
  const db = readKunci_();
  const k = db.map[g];
  const pengadilLama = k && k.nama ? k.nama : '';
  if (k && (k.pengadilId || k.rehat)) kosongKunci_(db.sheet, k, true);   // FASA 5: batal rehat juga
  upsertMatches_([{
    id: id, gelanggang: g, status: 'MENUNGGU GILIRAN', fasaMasa: 'Ditangguhkan', skorP1: '', skorP2: '',
    masaMula: '', masaTamat: '', pengesahan: 'MENUNGGU', pemenangPenalti: '', pengadil: '',
    catatan: 'Ditangguhkan (Master Admin): ' + String(body.sebab || '-').slice(0, 200)
  }], { abaikanKunci: true, admin: true });
  logTangguh_({ gelanggang: g, matchId: id, pasukan: body.pasukan || '', pengadil: pengadilLama,
    sebab: body.sebab || '', tindakan: 'TANGGUH + LEPAS KUNCI', oleh: 'Master Admin' });
  return { ok: true, kunci: statusKunci_(db) };
}

// v1.9.0: papan live melalui CacheService. Versi cache dinaikkan setiap penulisan;
// hasil binaan yang bermula sebelum penulisan tidak disimpan (elak data lama).
function papanLiveCached_() {
  let cache = null;
  try { cache = CacheService.getScriptCache(); } catch (err) { cache = null; }
  if (cache) {
    try {
      const hit = cache.get(PAPAN_CACHE_KEY);
      if (hit) {
        const data = JSON.parse(hit);
        data.masa = new Date().toISOString();
        data.cache = true;
        return data;
      }
    } catch (err) { /* bina semula */ }
  }
  const verSebelum = cache ? (cache.get(PAPAN_CACHE_VER) || '') : '';
  const data = papanLive_();
  if (cache) {
    try {
      if ((cache.get(PAPAN_CACHE_VER) || '') === verSebelum) {
        cache.put(PAPAN_CACHE_KEY, JSON.stringify(data), PAPAN_CACHE_SAAT);
      }
    } catch (err) { /* abaikan */ }
  }
  return data;
}

function bustPapanCache_() {
  try {
    const cache = CacheService.getScriptCache();
    cache.put(PAPAN_CACHE_VER, String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8), 21600);
    cache.remove(PAPAN_CACHE_KEY);
  } catch (err) { /* abaikan */ }
}

// Papan live awam: perlawanan semasa setiap gelanggang + nama pengadil (tiada data sulit)
function papanLive_() {
  const kunci = readKunci_();
  const table = readTable_(getJadualSheet_());
  const nowMs = Date.now();
  const byId = {};
  table.rows.forEach(function (r) { byId[String(r.data.id).toUpperCase()] = r.data; });
  const out = {};
  GELANGGANG_SAH.forEach(function (g) {
    const k = kunci.map[g];
    let m = k && k.matchId ? byId[k.matchId] : null;
    const stM = m ? String(m.status).toUpperCase() : '';
    if (!m || stM === 'SELESAI' || stM === 'TAMAT - TUNGGU SAH') {
      // Keputusan dihantar pengadil -> gelanggang bebas untuk perlawanan seterusnya
      if (m && stM !== 'LIVE') m = null;
      // Perlawanan LIVE / ditangguh terkini di gelanggang ini
      const calon = table.rows.map(function (r) { return r.data; }).filter(function (d) {
        if (String(d.gelanggang || '').toUpperCase() !== g) return false;
        const st = String(d.status || '').toUpperCase();
        return st === 'LIVE' || String(d.fasaMasa) === 'Ditangguhkan';
      }).sort(function (a, b) { return String(b.kemaskini || '').localeCompare(String(a.kemaskini || '')); });
      m = calon[0] || m;
    }
    const pegang = k && k.pengadilId ? k : null;
    const rehat = k && k.rehat && m && String(m.id).toUpperCase() === String(k.matchId).toUpperCase() ? k.rehat : null;
    // FASA 7: Giliran seterusnya (untuk makluman standby pengurus pasukan)
    const curId = m ? String(m.id).toUpperCase() : '';
    const giliran = table.rows.map(function (r) { return r.data; }).filter(function (d) {
      if (String(d.gelanggang || '').toUpperCase() !== g) return false;
      if (String(d.status || '').toUpperCase() !== 'MENUNGGU GILIRAN') return false;
      return String(d.id).toUpperCase() !== curId;
    }).sort(function (a, b) {
      const ka = String(a.kategori || ''), kb = String(b.kategori || '');
      if (ka !== kb) return ka.localeCompare(kb);
      const na = Number(a.no) || 0, nb = Number(b.no) || 0;
      if (na !== nb) return na - nb;
      return String(a.id).localeCompare(String(b.id));
    }).slice(0, GILIRAN_MAX).map(function (d) {
      return {
        id: String(d.id || ''), kategori: String(d.kategori || ''), peringkat: String(d.peringkat || ''),
        kumpulan: String(d.kumpulan || ''), kodP1: String(d.kodP1 || ''), kodP2: String(d.kodP2 || ''),
        namaP1: String(d.namaP1 || ''), namaP2: String(d.namaP2 || ''),
        ditangguh: String(d.fasaMasa || '') === 'Ditangguhkan'
      };
    });
    out[g] = {
      gelanggang: g,
      giliran: giliran,
      matchId: m ? m.id : null,
      namaP1: m ? m.namaP1 : '', namaP2: m ? m.namaP2 : '',
      skorP1: m ? m.skorP1 : null, skorP2: m ? m.skorP2 : null,
      status: m ? m.status : '', fasaMasa: m ? m.fasaMasa : '',
      masaMula: m ? m.masaMula : null,
      ditangguh: !!(m && String(m.fasaMasa) === 'Ditangguhkan' && String(m.status).toUpperCase() !== 'LIVE'),
      catatan: m && String(m.fasaMasa) === 'Ditangguhkan' ? String(m.catatan || '') : '',
      pengadil: pegang ? pegang.nama : (rehat ? '' : (m && String(m.status).toUpperCase() === 'LIVE' ? String(m.pengadil || '') : '')),
      pengadilAktif: pegang ? !isKunciBasi_(pegang, nowMs) : false,
      // FASA 5: penangguhan sementara (rehat kecemasan)
      rehat: !!rehat,
      rehatSebab: rehat ? rehat.sebab : '',
      rehatPada: rehat ? rehat.pada : null,
      sahPengadil: m ? String(m.sahPengadil || '') : '',   // FASA 6
      kemaskini: m ? m.kemaskini : null
    };
  });
  return { ok: true, masa: new Date().toISOString(), gelanggang: out };
}

/* =========================================================
   FASA 5: REHAT KECEMASAN (PENANGGUHAN SEMENTARA) & AMBIL ALIH PENGADIL
   Aliran: Pengadil A (pemegang kunci) tekan "Rehat Kecemasan" -> skor semasa
           disimpan & DIBEKUKAN, Fasa Masa = "Rehat Kecemasan" (status kekal LIVE).
           -> Pengadil B log masuk -> "Ambil Alih Gelanggang" (kunci bertukar kepada B,
              status rehat kekal) -> "Sambung Perlawanan" -> fasa & masa disambung,
              skor diambil daripada Jadual_Perlawanan (tiada markah hilang / ditulis ganti).
           -> Pengadil A juga boleh menekan "Sambung Perlawanan" sendiri.
   - Semua tindakan berjalan di bawah LockService (doPost).
   ========================================================= */
function cariPerlawanan_(id) {
  const table = readTable_(getJadualSheet_());
  const rec = table.rows.find(function (r) { return String(r.data.id).toUpperCase() === id; });
  return rec ? rec.data : null;
}

// Data perlawanan untuk peranti pengadil (tiada data sulit)
function perlawananAwam_(d) {
  if (!d) return null;
  return {
    id: String(d.id || ''), kategori: String(d.kategori || ''), peringkat: String(d.peringkat || ''),
    namaP1: String(d.namaP1 || ''), namaP2: String(d.namaP2 || ''), kodP1: String(d.kodP1 || ''), kodP2: String(d.kodP2 || ''),
    skorP1: skorInt_(d.skorP1), skorP2: skorInt_(d.skorP2),
    status: String(d.status || ''), pengesahan: String(d.pengesahan || ''), fasaMasa: String(d.fasaMasa || ''),
    masaMula: d.masaMula || null, pengadil: String(d.pengadil || ''), gelanggang: String(d.gelanggang || ''),
    sahPengadil: String(d.sahPengadil || ''), sahPengadilPada: d.sahPengadilPada || null
  };
}

function normFasaKod_(v) {
  const k = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (k === 'SEPARUH1') return 'SEPARUH 1';
  if (k === 'SEPARUH2') return 'SEPARUH 2';
  if (k === 'REHAT') return 'REHAT';
  return 'SEPARUH 1';
}

function sesiDanKunci_(body) {
  const g = normGelanggang_(body.gelanggang);
  if (!g) return { ralat: { ok: false, error: 'Gelanggang tidak sah.' } };
  const sesi = sahkanSesi_(body.token);
  if (!sesi.ok) return { ralat: sesi };
  const db = readKunci_();
  return { g: g, ref: sesi.ref, db: db, k: db.map[g] };
}

// 1) REHAT KECEMASAN: pengadil pemegang kunci membekukan perlawanan LIVE
function rehatKecemasan_(body) {
  const c = sesiDanKunci_(body);
  if (c.ralat) return c.ralat;
  const g = c.g, ref = c.ref, db = c.db, k = c.k;
  if (!k.pengadilId) {
    return { ok: false, kod: 'TIADA_KUNCI', error: 'Gelanggang ' + g + ' belum dikunci. Tekan "Sepak Mula" dahulu.', kunci: statusKunci_(db) };
  }
  if (k.pengadilId !== ref.id) {
    return { ok: false, kod: 'HILANG', error: 'Gelanggang ' + g + ' dikunci oleh ' + k.nama + '. Anda tidak boleh menangguhkannya.', kunci: statusKunci_(db) };
  }
  const id = normMatchId_(body.matchId);
  if (!id) return { ok: false, error: 'ID perlawanan tidak sah.' };
  if (k.matchId && k.matchId !== id) {
    return { ok: false, error: 'Perlawanan ' + id + ' tidak sepadan dengan kunci Gelanggang ' + g + ' (' + k.matchId + ').' };
  }
  if (k.rehat) {
    // Idempotent: permintaan berulang (cth: internet lambat) tidak mengubah apa-apa
    return { ok: true, sudahRehat: true, rehat: k.rehat, kunci: statusKunci_(db) };
  }
  const d = cariPerlawanan_(id);
  if (!d) return { ok: false, error: 'Perlawanan ' + id + ' tidak dijumpai dalam ' + SHEET_JADUAL + '.' };
  if (String(d.status || '').toUpperCase() !== 'LIVE') {
    return { ok: false, kod: 'BUKAN_LIVE', error: 'Rehat Kecemasan hanya dibenarkan semasa perlawanan LIVE (status semasa: ' + d.status + ').' };
  }
  const s1 = skorInt_(body.skorP1), s2 = skorInt_(body.skorP2);
  if (s1 === null || s2 === null) return { ok: false, error: 'Skor semasa tidak sah (mesti 0 hingga 99).' };
  const sebab = String(body.sebab || 'Kecemasan pengadil').replace(/\s+/g, ' ').trim().slice(0, 200);
  const now = new Date();

  // Simpan skor terakhir pengadil (sumber sah) & bekukan fasa. Status kekal LIVE.
  upsertMatches_([{ id: id, gelanggang: g, pengadil: ref.nama, skorP1: s1, skorP2: s2, fasaMasa: FASA_REHAT_LABEL }], { abaikanKunci: true });

  k.matchId = id;
  k.aktiviti = now.toISOString();
  k.rehat = {
    pada: now.toISOString(), sebab: sebab, olehId: ref.id, oleh: ref.nama,
    fasaSebelum: normFasaKod_(body.fasaSebelum),
    elapsedMs: Math.max(0, Math.min(REHAT_MAX_MS, Math.round(Number(body.elapsedMs) || 0))),
    skorP1: s1, skorP2: s2, matchId: id, diambilAlihOleh: ''
  };
  tulisKunci_(db.sheet, k);
  logTangguh_({ gelanggang: g, matchId: id, pasukan: String(d.namaP1) + ' lwn ' + String(d.namaP2), pengadil: ref.nama,
    sebab: sebab + ' (skor ' + s1 + ' - ' + s2 + ')', tindakan: 'REHAT KECEMASAN (DIGANTUNG SEMENTARA)', oleh: ref.nama });
  return { ok: true, rehat: k.rehat, kunci: statusKunci_(db), masa: now.toISOString() };
}

// 2) AMBIL ALIH: pengadil baharu mengambil alih gelanggang yang sedang Rehat Kecemasan
function ambilAlihGelanggang_(body) {
  const c = sesiDanKunci_(body);
  if (c.ralat) return c.ralat;
  const g = c.g, ref = c.ref, db = c.db, k = c.k;
  if (!k.rehat) {
    return {
      ok: false, kod: 'BUKAN_REHAT',
      error: 'Gelanggang ' + g + ' tidak dalam status Rehat Kecemasan. Ambil alih hanya dibenarkan semasa perlawanan ditangguhkan sementara.',
      kunci: statusKunci_(db)
    };
  }
  // Pengadil ini tidak boleh sedang memegang perlawanan di gelanggang lain
  for (let i = 0; i < GELANGGANG_SAH.length; i++) {
    const o = GELANGGANG_SAH[i];
    const x = db.map[o];
    if (o === g || !x || x.pengadilId !== ref.id) continue;
    if (x.matchId || x.rehat) {
      return { ok: false, kod: 'PEGANG_LAIN', error: 'Anda masih memegang Gelanggang ' + o + '. Lepaskan gelanggang tersebut dahulu.', kunci: statusKunci_(db) };
    }
    kosongKunci_(db.sheet, x);
  }
  const id = k.rehat.matchId || k.matchId;
  const d = cariPerlawanan_(id);
  if (!d || String(d.status || '').toUpperCase() !== 'LIVE') {
    return { ok: false, kod: 'BUKAN_LIVE', error: 'Perlawanan ' + id + ' tidak lagi LIVE. Hubungi Urusetia / Master Admin.', kunci: statusKunci_(db) };
  }
  const now = new Date();
  const sama = k.pengadilId === ref.id;
  const lama = sama ? '' : (k.nama || k.rehat.oleh || '');
  k.pengadilId = ref.id;
  k.nama = ref.nama;
  k.matchId = id;
  if (!sama) k.dikunciPada = now.toISOString();
  k.aktiviti = now.toISOString();
  if (!sama) k.rehat.diambilAlihOleh = ref.nama;
  tulisKunci_(db.sheet, k);
  // Hanya nama pengadil dikemas kini. Skor, status & fasa TIDAK disentuh.
  upsertMatches_([{ id: id, pengadil: ref.nama }], { abaikanKunci: true });
  if (!sama) {
    logTangguh_({ gelanggang: g, matchId: id, pasukan: String(d.namaP1) + ' lwn ' + String(d.namaP2), pengadil: lama || '-',
      sebab: 'Ambil alih semasa Rehat Kecemasan (skor ' + d.skorP1 + ' - ' + d.skorP2 + ')', tindakan: 'AMBIL ALIH (TUKAR PENGADIL)', oleh: ref.nama });
  }
  return {
    ok: true, gelanggang: g, diambilAlihDaripada: lama || null, rehat: k.rehat,
    perlawanan: perlawananAwam_(cariPerlawanan_(id)), kunci: statusKunci_(db), masa: now.toISOString()
  };
}

// 3) SAMBUNG PERLAWANAN: pemegang kunci (pengadil asal / baharu) meneruskan perlawanan
function sambungPerlawanan_(body) {
  const c = sesiDanKunci_(body);
  if (c.ralat) return c.ralat;
  const g = c.g, ref = c.ref, db = c.db, k = c.k;
  if (!k.pengadilId) {
    return { ok: false, kod: 'TIADA_KUNCI', error: 'Gelanggang ' + g + ' tiada pengadil. Tekan "Ambil Alih Gelanggang" dahulu.', kunci: statusKunci_(db) };
  }
  if (k.pengadilId !== ref.id) {
    return { ok: false, kod: 'HILANG', error: 'Gelanggang ' + g + ' kini dipegang oleh ' + k.nama + '.', kunci: statusKunci_(db) };
  }
  const reqId = normMatchId_(body.matchId);
  if (!k.rehat) {
    // Idempotent: sudah disambung
    return { ok: true, sudahSambung: true, perlawanan: perlawananAwam_(k.matchId ? cariPerlawanan_(k.matchId) : null), kunci: statusKunci_(db) };
  }
  const id = k.rehat.matchId || k.matchId;
  if (reqId && reqId !== id) {
    return { ok: false, error: 'Perlawanan ' + reqId + ' tidak sepadan dengan perlawanan yang ditangguhkan di Gelanggang ' + g + ' (' + id + ').', kunci: statusKunci_(db) };
  }
  const d = cariPerlawanan_(id);
  if (!d || String(d.status || '').toUpperCase() !== 'LIVE') {
    return { ok: false, kod: 'BUKAN_LIVE', error: 'Perlawanan ' + id + ' tidak lagi LIVE. Hubungi Urusetia / Master Admin.', kunci: statusKunci_(db) };
  }
  const rehat = k.rehat;
  const now = new Date();
  // Skor TIDAK dihantar / ditulis: hanya fasa dipulihkan & nama pengadil semasa.
  upsertMatches_([{ id: id, pengadil: ref.nama, fasaMasa: FASA_SAMBUNG[rehat.fasaSebelum] || 'Separuh 1' }], { abaikanKunci: true });
  k.rehat = null;
  k.matchId = id;
  k.aktiviti = now.toISOString();
  tulisKunci_(db.sheet, k);
  const minit = rehat.pada ? Math.max(0, Math.round((now.getTime() - new Date(rehat.pada).getTime()) / 60000)) : 0;
  logTangguh_({ gelanggang: g, matchId: id, pasukan: String(d.namaP1) + ' lwn ' + String(d.namaP2), pengadil: ref.nama,
    sebab: 'Rehat ' + minit + ' minit (' + rehat.sebab + ') · skor ' + d.skorP1 + ' - ' + d.skorP2,
    tindakan: 'SAMBUNG PERLAWANAN' + (rehat.olehId && rehat.olehId !== ref.id ? ' (PENGADIL BAHARU)' : ''), oleh: ref.nama });
  return { ok: true, rehat: rehat, perlawanan: perlawananAwam_(cariPerlawanan_(id)), kunci: statusKunci_(db), masa: now.toISOString() };
}

/* =========================================================
   FASA 4: PEMBETULAN MARKAH (MASTER ADMIN SAHAJA) & ROMBAKAN AUTOMATIK
   Aliran: Master Admin log masuk -> Dashboard -> Pembetulan Markah -> pilih
           perlawanan DISAHKAN -> masukkan skor betul + sebab -> Simpan.
   Pelayan:
     1. Sahkan kunci Master Admin (handlePengadil_) - pengadil / urusetia ditolak.
     2. Semak perlawanan wujud, telah DISAHKAN & tidak sedang dikunci di gelanggang.
     3. Semak skor (0-99), pemenang penalti wajib bagi kalah mati yang seri.
     4. Tulis skor baharu + perlawanan susulan (hasil rombakan aplikasi) dengan
        cop "Versi Pembetulan" di bawah LockService (doPost).
     5. Rombakan pelayan: kira semula Carta_Liga & isi semula slot JOHAN-/NJOHAN-/
        MENANG-/KALAH- perlawanan yang masih MENUNGGU GILIRAN.
     6. Catat ke tab Log_Pembetulan.
   ========================================================= */
function getPembetulanSheet_() {
  const sheet = getOrCreateSheet_(SHEET_PEMBETULAN);
  if (sheet.getRange(1, 1, 1, PEMBETULAN_HEADER.length).getValues()[0].join('') === '') {
    sheet.getRange(1, 1, 1, PEMBETULAN_HEADER.length).setValues([PEMBETULAN_HEADER]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function bacaLogPembetulan_(had) {
  const sheet = getPembetulanSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const n = Math.min(had || 100, last - 1);
  return sheet.getRange(last - n + 1, 1, n, PEMBETULAN_HEADER.length).getValues().reverse().map(function (r) {
    return {
      masa: toIso_(r[0]), versi: String(r[1]), matchId: String(r[2]), kategori: String(r[3]), peringkat: String(r[4]),
      perlawanan: String(r[5]), skorLama: String(r[6]), skorBaharu: String(r[7]), sebab: String(r[10]),
      mod: String(r[11]), terkesan: String(r[12]), oleh: String(r[13])
    };
  });
}

function skorInt_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

function isKnockoutStage_(peringkat) {
  return KNOCKOUT_STAGES.indexOf(String(peringkat || '').toUpperCase()) >= 0;
}

// Pemenang baris yang telah DISAHKAN -> 'P1' | 'P2' | null
function pemenangBaris_(d) {
  if (String(d.status || '').toUpperCase() !== 'SELESAI' || String(d.pengesahan || '').toUpperCase() !== 'DISAHKAN') return null;
  const s1 = Number(d.skorP1) || 0, s2 = Number(d.skorP2) || 0;
  if (s1 > s2) return 'P1';
  if (s2 > s1) return 'P2';
  const pen = String(d.pemenangPenalti || '').trim();
  if (!pen) return null;
  if (pen === 'P1' || pen === String(d.namaP1)) return 'P1';
  if (pen === 'P2' || pen === String(d.namaP2)) return 'P2';
  return null;
}

function isNamaPlaceholder_(nama) {
  const n = String(nama || '').toUpperCase();
  return !n || n === '(MENUNGGU UNDIAN)' || n.indexOf('JOHAN KUMPULAN') === 0 || n.indexOf('NAIB JOHAN KUMPULAN') === 0 ||
    n.indexOf('MENANG PERLAWANAN') === 0 || n.indexOf('KALAH PERLAWANAN') === 0;
}

function placeholderKod_(kod) {
  const c = String(kod || '').toUpperCase();
  let m;
  if ((m = /^JOHAN-([A-Z])$/.exec(c))) return 'JOHAN KUMPULAN ' + m[1];
  if ((m = /^NJOHAN-([A-Z])$/.exec(c))) return 'NAIB JOHAN KUMPULAN ' + m[1];
  if ((m = /^MENANG-(\d+)$/.exec(c))) return 'MENANG PERLAWANAN ' + Number(m[1]);
  if ((m = /^KALAH-(\d+)$/.exec(c))) return 'KALAH PERLAWANAN ' + Number(m[1]);
  return null;
}

// Carta liga dikira di pelayan (Menang 3, Seri 1, Kalah 0 | Mata > PG > Jaringan > Kod)
// Pulangkan senarai baris untuk writeStandings_ + maklumat lengkap setiap kumpulan.
function kiraCartaPelayan_(table, out) {
  const groups = {};
  table.rows.forEach(function (r) {
    const d = r.data;
    if (GROUP_STAGES.indexOf(String(d.peringkat || '').toUpperCase()) < 0) return;
    const key = String(d.kategori).toUpperCase() + '|' + String(d.kumpulan).toUpperCase();
    const g = groups[key] || (groups[key] = { kategori: String(d.kategori).toUpperCase(), kumpulan: String(d.kumpulan).toUpperCase(), teams: {}, total: 0, played: 0 });
    g.total++;
    [['kodP1', 'namaP1'], ['kodP2', 'namaP2']].forEach(function (k) {
      const kod = String(d[k[0]] || '');
      if (kod && !g.teams[kod]) g.teams[kod] = { kod: kod, nama: String(d[k[1]] || kod), P: 0, M: 0, S: 0, K: 0, J: 0, B: 0, PG: 0, Mata: 0 };
    });
    if (!pemenangBarisAtauSeri_(d)) return;
    g.played++;
    const t1 = g.teams[String(d.kodP1)], t2 = g.teams[String(d.kodP2)];
    if (!t1 || !t2) return;
    const s1 = Number(d.skorP1) || 0, s2 = Number(d.skorP2) || 0;
    t1.P++; t2.P++; t1.J += s1; t1.B += s2; t2.J += s2; t2.B += s1;
    if (s1 > s2) { t1.M++; t2.K++; t1.Mata += 3; }
    else if (s2 > s1) { t2.M++; t1.K++; t2.Mata += 3; }
    else { t1.S++; t2.S++; t1.Mata++; t2.Mata++; }
  });
  const rows = [];
  Object.keys(groups).sort().forEach(function (key) {
    const g = groups[key];
    const list = Object.keys(g.teams).map(function (k) { const t = g.teams[k]; t.PG = t.J - t.B; return t; });
    list.sort(function (a, b) { return (b.Mata - a.Mata) || (b.PG - a.PG) || (b.J - a.J) || a.kod.localeCompare(b.kod); });
    list.forEach(function (t, i) {
      t.pos = i + 1;
      rows.push({ kategori: g.kategori, kumpulan: g.kumpulan, pos: t.pos, kod: t.kod, nama: t.nama, P: t.P, M: t.M, S: t.S, K: t.K, J: t.J, B: t.B, PG: t.PG, Mata: t.Mata });
    });
    g.complete = g.total > 0 && g.played === g.total && list.length >= 2 && !list.some(function (t) { return isNamaPlaceholder_(t.nama); });
    g.johan = g.complete ? list[0] : null;
    g.naib = g.complete ? list[1] : null;
  });
  if (out) out.groups = groups;
  return rows;
}

function pemenangBarisAtauSeri_(d) {
  return String(d.status || '').toUpperCase() === 'SELESAI' && String(d.pengesahan || '').toUpperCase() === 'DISAHKAN';
}

// Rombakan pelayan: isi semula slot perlawanan kalah mati yang masih MENUNGGU GILIRAN.
// Perlawanan yang sudah bermula / selesai TIDAK diubah di sini (aplikasi Master Admin
// menghantar keputusan "main semula" melalui senarai susulan).
function rombakJadualPelayan_() {
  const sheet = getJadualSheet_();
  const changes = [];
  const amaran = [];
  for (let pusingan = 0; pusingan < 6; pusingan++) {
    const table = readTable_(sheet);
    const info = {};
    const carta = kiraCartaPelayan_(table, info);
    const byKatNo = {};
    table.rows.forEach(function (r) { byKatNo[String(r.data.kategori).toUpperCase() + '|' + Number(r.data.no)] = r.data; });
    const kemas = [];
    table.rows.forEach(function (r) {
      const d = r.data;
      const kat = String(d.kategori).toUpperCase();
      const upd = { id: d.id };
      let ada = false;
      [1, 2].forEach(function (side) {
        const kod = String(d['kodP' + side] || '').toUpperCase();
        let nama = null, m;
        if ((m = /^(JOHAN|NJOHAN)-([A-Z])$/.exec(kod))) {
          const g = info.groups[kat + '|' + m[2]];
          const t = g && g.complete ? (m[1] === 'JOHAN' ? g.johan : g.naib) : null;
          nama = t ? t.nama : placeholderKod_(kod);
        } else if ((m = /^(MENANG|KALAH)-(\d+)$/.exec(kod))) {
          const src = byKatNo[kat + '|' + Number(m[2])];
          const win = src ? pemenangBaris_(src) : null;
          nama = placeholderKod_(kod);
          if (src && win && !isNamaPlaceholder_(src.namaP1) && !isNamaPlaceholder_(src.namaP2)) {
            const menang = win === 'P1' ? src.namaP1 : src.namaP2;
            const kalah = win === 'P1' ? src.namaP2 : src.namaP1;
            nama = m[1] === 'MENANG' ? menang : kalah;
          }
        }
        if (nama === null || String(d['namaP' + side]) === nama) return;
        if (String(d.status || '').toUpperCase() !== 'MENUNGGU GILIRAN') {
          amaran.push(d.id + ' (' + (side === 1 ? 'P1' : 'P2') + '): dijangka "' + nama + '" tetapi perlawanan telah ' + d.status);
          return;
        }
        upd['namaP' + side] = nama;
        ada = true;
        changes.push(d.id + ': ' + nama);
      });
      if (ada) kemas.push(upd);
    });
    if (!kemas.length) {
      if (carta.length) writeStandings_(carta);
      break;
    }
    upsertMatches_(kemas, { admin: true });
  }
  return { perubahan: changes, amaran: amaran.filter(function (v, i, a) { return a.indexOf(v) === i; }) };
}

function pembetulanSkor_(body) {
  const id = normMatchId_(body.matchId);
  if (!id) return { ok: false, error: 'ID perlawanan tidak sah.' };
  const sebab = String(body.sebab || '').replace(/\s+/g, ' ').trim();
  if (sebab.length < 5) return { ok: false, error: 'Sebab pembetulan wajib diisi (sekurang-kurangnya 5 aksara).' };
  const s1 = skorInt_(body.skorP1), s2 = skorInt_(body.skorP2);
  if (s1 === null || s2 === null) return { ok: false, error: 'Skor mesti nombor bulat 0 hingga 99.' };

  const table = readTable_(getJadualSheet_());
  const rec = table.rows.find(function (r) { return String(r.data.id).toUpperCase() === id; });
  if (!rec) return { ok: false, error: 'Perlawanan ' + id + ' tidak dijumpai dalam Jadual_Perlawanan.' };
  const d = rec.data;
  if (!pemenangBarisAtauSeri_(d)) {
    return { ok: false, kod: 'BELUM_SAH', error: id + ' belum DISAHKAN. Gunakan "Tolak" di Peti Kelulusan untuk keputusan yang belum disahkan.' };
  }
  const dikunci = lockedMatchIds_();
  if (dikunci[id]) return { ok: false, kod: 'DIKUNCI', error: id + ' sedang dikunci di gelanggang oleh ' + dikunci[id] + '. Lepaskan kunci dahulu.' };

  // Pemenang penalti: wajib bagi kalah mati yang seri, dibuang bagi kes lain
  let penalti = '';
  if (isKnockoutStage_(d.peringkat) && s1 === s2) {
    const p = String(body.pemenangPenalti || '').toUpperCase();
    if (p !== 'P1' && p !== 'P2') return { ok: false, error: 'Perlawanan kalah mati seri: pilih pemenang penalti.' };
    penalti = p === 'P1' ? String(d.namaP1) : String(d.namaP2);
  }

  const skorLama = (d.skorP1 === null ? '-' : d.skorP1) + ' - ' + (d.skorP2 === null ? '-' : d.skorP2);
  const penLama = String(d.pemenangPenalti || '');
  if (Number(d.skorP1) === s1 && Number(d.skorP2) === s2 && penLama === penalti) {
    return { ok: false, kod: 'TIADA_PERUBAHAN', error: 'Tiada perubahan markah untuk ' + id + '.' };
  }

  const now = new Date();
  const versi = 'PB-' + Utilities.formatDate(now, TIMEZONE, 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase();
  const mod = String(body.mod || 'MAIN_SEMULA').toUpperCase() === 'KEKAL' ? 'KEKAL' : 'MAIN_SEMULA';
  const kategori = String(d.kategori).toUpperCase();

  // Perlawanan susulan (hasil rombakan aplikasi Master Admin) - ditapis & disahkan
  const byId = {};
  table.rows.forEach(function (r) { byId[String(r.data.id).toUpperCase()] = r.data; });
  const susulan = [];
  const ditolak = [];
  (Array.isArray(body.susulan) ? body.susulan : []).slice(0, 65).forEach(function (s) {
    const sid = normMatchId_(s && s.id);
    if (!sid || sid === id) return;
    const asal = byId[sid];
    if (!asal || String(asal.kategori).toUpperCase() !== kategori) { ditolak.push(sid); return; }
    if (dikunci[sid] || String(asal.status || '').toUpperCase() === 'LIVE') { ditolak.push(sid + ' (LIVE)'); return; }
    const u = { id: sid, versiPembetulan: versi };
    SUSULAN_FIELDS.forEach(function (f) { if (f in s && s[f] !== undefined) u[f] = s[f]; });
    if ('skorP1' in u && u.skorP1 !== '' && u.skorP1 !== null && skorInt_(u.skorP1) === null) { ditolak.push(sid); return; }
    if ('skorP2' in u && u.skorP2 !== '' && u.skorP2 !== null && skorInt_(u.skorP2) === null) { ditolak.push(sid); return; }
    susulan.push(u);
  });
  if (ditolak.some(function (x) { return /LIVE/.test(x); })) {
    return { ok: false, kod: 'SUSULAN_LIVE', error: 'Perlawanan susulan sedang LIVE: ' + ditolak.join(', ') + '. Tangguhkan perlawanan tersebut dahulu.' };
  }

  upsertMatches_([{
    id: id, skorP1: s1, skorP2: s2, pemenangPenalti: penalti, versiPembetulan: versi,
    catatan: ('Dibetulkan (Master Admin) ' + skorLama + ' -> ' + s1 + ' - ' + s2 + ': ' + sebab).slice(0, 500)
  }].concat(susulan), { admin: true });

  // Rombakan pelayan (jaring keselamatan) + carta liga terkini
  const rombak = rombakJadualPelayan_();

  try {
    const sheet = getPembetulanSheet_();
    sheet.appendRow([now, versi, id, kategori, String(d.peringkat), String(d.namaP1) + ' lwn ' + String(d.namaP2),
      skorLama, s1 + ' - ' + s2, penLama, penalti, sebab.slice(0, 300), mod,
      susulan.map(function (x) { return x.id; }).concat(rombak.perubahan).join(', ').slice(0, 1000) || '-',
      String(body.oleh || 'Master Admin').slice(0, 60)]);
    sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sheet.getRange(sheet.getLastRow(), 2).setNumberFormat('@');
  } catch (err) {
    console.warn('log pembetulan', err);
  }

  return {
    ok: true,
    versi: versi,
    matchId: id,
    susulan: susulan.map(function (x) { return x.id; }),
    ditolak: ditolak,
    rombakan: rombak.perubahan,
    amaran: rombak.amaran,
    masa: now.toISOString()
  };
}

function logKeluarPengadil_(body) {
  const t = String(body.token || '').toLowerCase().replace(/[^a-f0-9]/g, '');
  const sesi = sahkanSesi_(t);
  if (sesi.ok) lepasKunciPengadil_(sesi.ref.id);
  if (t) PropertiesService.getScriptProperties().deleteProperty(SESI_PREFIX + t);
  return { ok: true };
}

function toIso_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  if (v === '' || v === null || v === undefined) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function toDate_(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? '' : d;
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
  getPengadilSheet_();
  getKunciSheet_();
  getTangguhSheet_();
  getPembetulanSheet_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Tab ' + SHEET_JADUAL + ', ' + SHEET_PENGADIL + ', ' + SHEET_KUNCI + ', ' + SHEET_TANGGUH + ' & ' + SHEET_PEMBETULAN + ' sedia digunakan.', 'Live Futsal PK KBB', 5);
  return sheet.getName();
}

// 2) Ujian ringkas tanpa aplikasi: kemas kini SR-01.
function testDoPost() {
  const res = doPost({
    postData: {
      contents: JSON.stringify({
        action: 'updateMatch', id: 'SR-01', skorP1: 2, skorP2: 1,
        fasaMasa: 'Separuh 2', status: 'LIVE', pengesahan: 'MENUNGGU', pengadil: 'Cikgu Ali'
      })
    }
  });
  console.log(res.getContent());
}

// 3) Ujian bacaan.
function testDoGet() {
  console.log(doGet({ parameter: { id: 'SR-01' } }).getContent());
}

// 4) Ujian pangkalan data pengadil: cipta, log masuk, senarai.
function testPengadil() {
  const key = getMasterAdminKey_();
  const call = function (obj) {
    return JSON.parse(doPost({ postData: { contents: JSON.stringify(obj) } }).getContent());
  };
  console.log(call({ action: 'simpanPengadil', adminKey: key, pengadil: { nama: 'Ujian Pengadil', password: 'uji1234' } }));
  console.log(call({ action: 'loginPengadil', nama: 'ujian pengadil', password: 'uji1234' }));
  console.log(call({ action: 'senaraiPengadil', adminKey: key }));
}

// 5) Ujian kunci gelanggang (Fasa 2): dua pengadil cuba mengunci Gelanggang A.
function testKunciGelanggang() {
  const key = getMasterAdminKey_();
  const call = function (obj) {
    return JSON.parse(doPost({ postData: { contents: JSON.stringify(obj) } }).getContent());
  };
  call({ action: 'simpanPengadil', adminKey: key, pengadil: { nama: 'Ujian Satu', password: 'uji1111' } });
  call({ action: 'simpanPengadil', adminKey: key, pengadil: { nama: 'Ujian Dua', password: 'uji2222' } });
  const a = call({ action: 'loginPengadil', nama: 'Ujian Satu', password: 'uji1111' });
  const b = call({ action: 'loginPengadil', nama: 'Ujian Dua', password: 'uji2222' });
  console.log('Satu kunci A:', call({ action: 'kunciGelanggang', token: a.token, gelanggang: 'A', matchId: 'SM-01' }).ok);   // true
  console.log('Dua kunci A :', call({ action: 'kunciGelanggang', token: b.token, gelanggang: 'A', matchId: 'SM-01' }));      // DIKUNCI
  console.log('Dua skor A  :', call({ action: 'skorLive', token: b.token, gelanggang: 'A', matchId: 'SM-01', skorP1: 5 })); // HILANG
  console.log('Satu skor A :', call({ action: 'skorLive', token: a.token, gelanggang: 'A', matchId: 'SM-01', skorP1: 1, skorP2: 0, status: 'LIVE' }).ok);
  console.log('Satu lepas  :', call({ action: 'lepasGelanggang', token: a.token, gelanggang: 'A' }).ok);
  call({ action: 'logKeluarPengadil', token: a.token });
  call({ action: 'logKeluarPengadil', token: b.token });
}


// 6) Ujian papan live awam (Fasa 3).
function testPapanLive() {
  console.log(doGet({ parameter: { action: 'live' } }).getContent());
}

// 7) Ujian pembetulan markah (Fasa 4): pengadil DITOLAK, Master Admin DITERIMA.
//    Pastikan SR-01 telah SELESAI & DISAHKAN dalam Jadual_Perlawanan sebelum menjalankan.
function testPembetulan() {
  const key = getMasterAdminKey_();
  const call = function (obj) {
    return JSON.parse(doPost({ postData: { contents: JSON.stringify(obj) } }).getContent());
  };
  call({ action: 'simpanPengadil', adminKey: key, pengadil: { nama: 'Ujian Satu', password: 'uji1111' } });
  const a = call({ action: 'loginPengadil', nama: 'Ujian Satu', password: 'uji1111' });
  console.log('Pengadil betulkan :', call({ action: 'pembetulanSkor', token: a.token, matchId: 'SR-01', skorP1: 3, skorP2: 0, sebab: 'Ujian pengadil' })); // ditolak
  console.log('syncAll tanpa admin:', call({ action: 'updateMatch', id: 'SR-01', skorP1: 9, skorP2: 9 }));                                         // dimuktamad: 1
  console.log('Master Admin      :', call({ action: 'pembetulanSkor', adminKey: key, matchId: 'SR-01', skorP1: 3, skorP2: 0, sebab: 'Ujian pembetulan', mod: 'MAIN_SEMULA' }));
  call({ action: 'logKeluarPengadil', token: a.token });
}

// 8) Ujian Rehat Kecemasan & Ambil Alih (Fasa 5).
//    Pastikan SM-01 belum bermula (MENUNGGU GILIRAN) dalam Jadual_Perlawanan & Gelanggang A kosong.
function testRehatKecemasan() {
  const key = getMasterAdminKey_();
  const call = function (obj) {
    return JSON.parse(doPost({ postData: { contents: JSON.stringify(obj) } }).getContent());
  };
  call({ action: 'simpanPengadil', adminKey: key, pengadil: { nama: 'Ujian Satu', password: 'uji1111' } });
  call({ action: 'simpanPengadil', adminKey: key, pengadil: { nama: 'Ujian Dua', password: 'uji2222' } });
  const a = call({ action: 'loginPengadil', nama: 'Ujian Satu', password: 'uji1111' });
  const b = call({ action: 'loginPengadil', nama: 'Ujian Dua', password: 'uji2222' });
  console.log('A kunci      :', call({ action: 'kunciGelanggang', token: a.token, gelanggang: 'A', matchId: 'SM-01' }).ok);
  console.log('A skor 2-1   :', call({ action: 'skorLive', token: a.token, gelanggang: 'A', matchId: 'SM-01', skorP1: 2, skorP2: 1, status: 'LIVE', fasaMasa: 'Separuh 1' }).ok);
  console.log('A rehat      :', call({ action: 'rehatKecemasan', token: a.token, gelanggang: 'A', matchId: 'SM-01', skorP1: 2, skorP2: 1, fasaSebelum: 'SEPARUH 1', elapsedMs: 420000, sebab: 'Ujian tandas' }).ok);
  console.log('A skor (beku):', call({ action: 'skorLive', token: a.token, gelanggang: 'A', matchId: 'SM-01', skorP1: 5 }).kod);          // REHAT
  console.log('Sync (beku)  :', call({ action: 'updateMatch', id: 'SM-01', skorP1: 9, skorP2: 9 }).dilindungi);                         // 1
  console.log('B ambil alih :', call({ action: 'ambilAlihGelanggang', token: b.token, gelanggang: 'A' }));
  console.log('A sambung    :', call({ action: 'sambungPerlawanan', token: a.token, gelanggang: 'A' }).kod);                            // HILANG
  const sam = call({ action: 'sambungPerlawanan', token: b.token, gelanggang: 'A', matchId: 'SM-01' });
  console.log('B sambung    :', sam.ok, 'skor', sam.perlawanan && sam.perlawanan.skorP1, '-', sam.perlawanan && sam.perlawanan.skorP2); // true 2 - 1
  console.log('B skor 3-1   :', call({ action: 'skorLive', token: b.token, gelanggang: 'A', matchId: 'SM-01', skorP1: 3, skorP2: 1, status: 'LIVE', fasaMasa: 'Separuh 1' }).ok);
  call({ action: 'tangguhAdmin', adminKey: key, gelanggang: 'A', matchId: 'SM-01', sebab: 'Tamat ujian' });
  call({ action: 'logKeluarPengadil', token: a.token });
  call({ action: 'logKeluarPengadil', token: b.token });
}
