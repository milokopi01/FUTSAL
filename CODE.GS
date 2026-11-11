/**
 * SISTEM PENGURUSAN KEJOHANAN & SIMULASI GELANGGANG PINTAR (MULTI-EVENT)
 * Backend: Google Apps Script (Code.gs)
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var params = e.parameter || {};
    var postData = {};
    if (e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }
    var action = postData.action || params.action || "getAllData";
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "getAllData") {
      return jsonResponse({
        status: "success",
        tournaments: getSheetData(ss, "Tournaments"),
        users: getSheetData(ss, "Users"),
        courts: getSheetData(ss, "Courts"),
        teams: getSheetData(ss, "Teams"),
        matches: getSheetData(ss, "Matches")
      });
    }

    if (action === "syncState") {
      if (postData.tournaments) writeSheetData(ss, "Tournaments", postData.tournaments);
      if (postData.users) writeSheetData(ss, "Users", postData.users);
      if (postData.courts) writeSheetData(ss, "Courts", postData.courts);
      if (postData.teams) writeSheetData(ss, "Teams", postData.teams);
      if (postData.matches) writeSheetData(ss, "Matches", postData.matches);
      return jsonResponse({ status: "success", message: "Data berjaya disimpan ke Google Sheets" });
    }

    return jsonResponse({ status: "error", message: "Action tidak sah" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getSheetData(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var result = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[i][j];
    }
    result.push(obj);
  }
  return result;
}

function writeSheetData(ss, sheetName, dataArray) {
  if (!dataArray || dataArray.length === 0) return;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  var headers = Object.keys(dataArray[0]);
  var rows = [headers];
  for (var i = 0; i < dataArray.length; i++) {
    var row = [];
    for (var j = 0; j < headers.length; j++) {
      var val = dataArray[i][headers[j]];
      row.push(val !== undefined && val !== null ? val : "");
    }
    rows.push(row);
  }
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
