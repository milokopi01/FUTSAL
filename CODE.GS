const SPREADSHEET_ID = "1ZZhQgdqehfgRW7AXDeRz1M6ief5uYAGpPNt6bMa6_Vk";

function doGet(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetMatches = ss.getSheetByName("Jadual_Perlawanan");
  const data = sheetMatches.getDataRange().getValues();
  const headers = data[0];
  const matches = [];

  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    matches.push(obj);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "OK", matches: matches }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const payload = JSON.parse(e.postData.contents);

  if (payload.action === "SYNC_ALL" && payload.matches) {
    const sheet = ss.getSheetByName("Jadual_Perlawanan");
    const rows = sheet.getDataRange().getValues();

    payload.matches.forEach(m => {
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === m.id) {
          sheet.getRange(i + 1, 8).setValue(m.p1Name);
          sheet.getRange(i + 1, 9).setValue(m.s1);
          sheet.getRange(i + 1, 10).setValue(m.s2);
          sheet.getRange(i + 1, 12).setValue(m.p2Name);
          sheet.getRange(i + 1, 14).setValue(m.phase);
          sheet.getRange(i + 1, 15).setValue(m.status);
          sheet.getRange(i + 1, 16).setValue(m.approval);
          sheet.getRange(i + 1, 17).setValue(m.ref);
          break;
        }
      }
    });

    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "IGNORED" }))
    .setMimeType(ContentService.MimeType.JSON);
}
