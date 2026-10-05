function doGet(e) {
  return ContentService.createTextOutput("Sistem Backend Futsal PK Beroperasi.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Sila buat panggilan dari aplikasi frontend. Jangan guna butang 'Run' di editor.");
    }
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    const data = params.data || {};
    
    let result = {};
    
    switch(action) {
      case 'daftarGuru':
        result = daftarGuru(data);
        break;
      case 'logMasukGuru':
        result = logMasukGuru(data);
        break;
      case 'daftarPasukan':
        result = daftarPasukan(data);
        break;
      case 'janaJadual':
        result = janaJadual(data);
        break;
      case 'dapatkanData':
        result = dapatkanData();
        break;
      case 'kemaskiniSkor':
        result = kemaskiniSkor(data);
        break;
      default:
        result = { success: false, message: 'Tindakan tidak sah.' };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Ralat: Tab Sheet bernama '" + sheetName + "' tidak dijumpai!");
  }
  return sheet;
}

function daftarGuru(data) {
  const sheet = getSheet("Guru");
  const dataRange = sheet.getDataRange().getValues();
  
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][1] === data.emel) {
      return { success: false, message: 'Emel telah didaftarkan!' };
    }
  }
  
  sheet.appendRow([data.nama, data.emel, data.password, data.sekolah, data.kodSekolah, data.telefon]);
  return { success: true, message: 'Pendaftaran guru berjaya. Sila log masuk.' };
}

function logMasukGuru(data) {
  const sheet = getSheet("Guru");
  const dataRange = sheet.getDataRange().getValues();
  
  for (let i = 1; i < dataRange.length; i++) {
    if (dataRange[i][1] === data.emel && dataRange[i][2] === data.password) {
      return { 
        success: true, 
        data: {
          nama: dataRange[i][0],
          sekolah: dataRange[i][3],
          kodSekolah: dataRange[i][4]
        }
      };
    }
  }
  return { success: false, message: 'Emel atau Kata Laluan salah.' };
}

function daftarPasukan(data) {
  const sheet = getSheet("Pasukan");
  const idPasukan = 'P' + (sheet.getLastRow() + 1);
  sheet.appendRow([idPasukan, data.namaPasukan, data.kategori, data.kodSekolah]);
  return { success: true, message: 'Pasukan berjaya didaftarkan.', id: idPasukan };
}

function janaJadual(data) {
  const sheetPasukan = getSheet("Pasukan");
  const sheetPerlawanan = getSheet("Perlawanan");
  const pasukanData = sheetPasukan.getDataRange().getValues();
  
  if (pasukanData.length <= 1) return { success: false, message: 'Sila daftar sekurang-kurangnya 2 pasukan.' };
  
  if(sheetPerlawanan.getLastRow() > 1) {
    sheetPerlawanan.getRange(2, 1, sheetPerlawanan.getLastRow() - 1, 8).clearContent();
  }
  
  let pasukanList = [];
  for (let i = 1; i < pasukanData.length; i++) {
    if(pasukanData[i][1]) pasukanList.push(pasukanData[i][1]); 
  }
  
  let matchId = 1;
  // Format liga (Semua lawan semua)
  for (let i = 0; i < pasukanList.length; i++) {
    for (let j = i + 1; j < pasukanList.length; j++) {
      sheetPerlawanan.appendRow([
        'M' + matchId, 
        pasukanList[i], 
        pasukanList[j], 
        0, 0, 0, 0, 
        'Belum Mula'
      ]);
      matchId++;
    }
  }
  
  kiraSemulaKedudukan();
  return { success: true, message: 'Jadual kejohanan liga berjaya dijana.' };
}

function dapatkanData() {
  const sheetPerlawanan = getSheet("Perlawanan");
  const sheetKedudukan = getSheet("Kedudukan");
  
  const perlawanan = [];
  if(sheetPerlawanan.getLastRow() > 1) {
    const pData = sheetPerlawanan.getDataRange().getValues();
    for(let i = 1; i < pData.length; i++){
      if(pData[i][0]) {
        perlawanan.push({
          id: pData[i][0], p1: pData[i][1], p2: pData[i][2],
          s1: pData[i][3], s2: pData[i][4],
          pen1: pData[i][5], pen2: pData[i][6], status: pData[i][7]
        });
      }
    }
  }
  
  const kedudukan = [];
  if(sheetKedudukan.getLastRow() > 1) {
    const kData = sheetKedudukan.getDataRange().getValues();
    for(let i = 1; i < kData.length; i++){
      if(kData[i][0]) {
        kedudukan.push({
          pasukan: kData[i][0], p: kData[i][1], w: kData[i][2],
          d: kData[i][3], l: kData[i][4], gf: kData[i][5],
          ga: kData[i][6], gd: kData[i][7], mata: kData[i][8]
        });
      }
    }
  }
  
  return { success: true, perlawanan: perlawanan, kedudukan: kedudukan };
}

function kemaskiniSkor(data) {
  const sheet = getSheet("Perlawanan");
  const rows = sheet.getDataRange().getValues();
  
  let matchFound = false;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === data.idPerlawanan) {
      sheet.getRange(i + 1, 4).setValue(data.s1); // Skor 1
      sheet.getRange(i + 1, 5).setValue(data.s2); // Skor 2
      sheet.getRange(i + 1, 6).setValue(data.pen1); // Pen 1
      sheet.getRange(i + 1, 7).setValue(data.pen2); // Pen 2
      sheet.getRange(i + 1, 8).setValue('Tamat'); // Status
      matchFound = true;
      break;
    }
  }
  
  if (matchFound) {
    kiraSemulaKedudukan();
    return { success: true, message: 'Keputusan perlawanan berjaya disahkan.' };
  }
  
  return { success: false, message: 'Perlawanan tidak dijumpai.' };
}

function kiraSemulaKedudukan() {
  const sheetPerlawanan = getSheet("Perlawanan");
  const sheetKedudukan = getSheet("Kedudukan");
  
  const matches = sheetPerlawanan.getDataRange().getValues();
  let stats = {};
  
  for(let i=1; i<matches.length; i++) {
    let p1 = matches[i][1];
    let p2 = matches[i][2];
    if(!p1 || !p2) continue;

    if(!stats[p1]) stats[p1] = {p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, mata:0};
    if(!stats[p2]) stats[p2] = {p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, mata:0};
    
    let status = matches[i][7];
    if (status === 'Tamat') {
      let s1 = parseInt(matches[i][3]) || 0;
      let s2 = parseInt(matches[i][4]) || 0;
      
      stats[p1].p += 1; stats[p2].p += 1;
      stats[p1].gf += s1; stats[p1].ga += s2;
      stats[p2].gf += s2; stats[p2].ga += s1;
      
      if (s1 > s2) { stats[p1].w += 1; stats[p1].mata += 3; stats[p2].l += 1; }
      else if (s2 > s1) { stats[p2].w += 1; stats[p2].mata += 3; stats[p1].l += 1; }
      else { stats[p1].d += 1; stats[p1].mata += 1; stats[p2].d += 1; stats[p2].mata += 1; }
    }
  }
  
  let resultsArr = [];
  for (let team in stats) {
    stats[team].gd = stats[team].gf - stats[team].ga;
    resultsArr.push([
      team, stats[team].p, stats[team].w, stats[team].d, 
      stats[team].l, stats[team].gf, stats[team].ga, 
      stats[team].gd, stats[team].mata
    ]);
  }
  
  resultsArr.sort((a, b) => {
    if(b[8] !== a[8]) return b[8] - a[8]; // Mata
    if(b[7] !== a[7]) return b[7] - a[7]; // GD
    return b[5] - a[5]; // GF
  });
  
  if(sheetKedudukan.getLastRow() > 1) {
    sheetKedudukan.getRange(2, 1, sheetKedudukan.getLastRow() - 1, 9).clearContent();
  }
  if(resultsArr.length > 0) {
    sheetKedudukan.getRange(2, 1, resultsArr.length, 9).setValues(resultsArr);
  }
}
