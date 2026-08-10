// ==============================================================================
// SNEHYOGA CRM - Google Sheet Auto Sync Script (1-Minute Automated Scanner)
// ==============================================================================
//
// INSTRUCTIONS FOR GOOGLE SHEET:
// 1. Open your Google Sheet containing the lead data.
// 2. Row 1 header columns:
//    Client Name | Contact | Email | Amount Paid | Admission Date | End Date | Plan | Status | ASSIGNED TO | lead CRM status
// 3. Go to Extensions > Apps Script in the Google Sheet menu.
// 4. Erase any default code, paste THIS complete file, and click Save (Ctrl + S).
// 5. Select function "setup1MinuteTrigger" from the dropdown and click "Run".
// 6. Authorize permissions when prompted by Google.
// 7. Your Google Sheet will automatically scan every 1 minute, add new leads to CRM with ASSIGNED TO staff,
//    update existing leads if ASSIGNED TO is changed, and update Column J ("lead CRM status") to "Done"!
// ==============================================================================

var SUPABASE_URL = "https://bzqwaxqzggejpejyxhde.supabase.co";
var SUPABASE_KEY = "sb_publishable_aWZ6_LgTmBCAj7RHgmoDwg_YB4H1Ts4";

/**
 * Main Sync Function: Scans Google Sheet every minute, checks for duplicates,
 * posts new leads to Supabase CRM (including ASSIGNED TO staff), updates existing lead assignments,
 * and updates "lead CRM status" column to "Done".
 */
function scanAndSyncLeads() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log("[Sync] Sheet is empty or contains only headers.");
      return;
    }

    // 1. Locate column headers dynamically (case-insensitive)
    var headerRow = data[0].map(function(h) { return String(h || "").trim().toLowerCase(); });
    
    var clientNameIdx = headerRow.indexOf("client name");
    var contactIdx = headerRow.indexOf("contact");
    var admissionDateIdx = headerRow.indexOf("admission date");
    
    // Find "ASSIGNED TO" column dynamically
    var assignedToIdx = -1;
    for (var c = 0; c < headerRow.length; c++) {
      var h = headerRow[c];
      if (h.indexOf("assigned to") !== -1 || h.indexOf("assigned") !== -1) {
        assignedToIdx = c;
        break;
      }
    }

    // Find Column "lead CRM status"
    var crmStatusIdx = -1;
    for (var c = 0; c < headerRow.length; c++) {
      var h = headerRow[c];
      if (h.indexOf("lead crm status") !== -1 || h.indexOf("crm status") !== -1) {
        crmStatusIdx = c;
        break;
      }
    }

    // Fallbacks if header names have slight variation
    if (clientNameIdx === -1) {
      clientNameIdx = headerRow.findIndex(function(h) { return h.includes("client") || h.includes("name"); });
    }
    if (contactIdx === -1) {
      contactIdx = headerRow.findIndex(function(h) { return h.includes("contact") || h.includes("phone") || h.includes("mobile"); });
    }
    if (admissionDateIdx === -1) {
      admissionDateIdx = headerRow.findIndex(function(h) { return h.includes("admission") || h.includes("date"); });
    }

    if (clientNameIdx === -1 || contactIdx === -1) {
      Logger.log("[Sync Error] Could not find required column headers ('Client Name', 'Contact'). Header row: " + JSON.stringify(headerRow));
      return;
    }

    // If 'lead CRM status' column does not exist, default to Column J (10th column / index 9)
    if (crmStatusIdx === -1) {
      crmStatusIdx = 9; // Column J
      sheet.getRange(1, 10).setValue("lead CRM status").setFontWeight("bold");
    }

    // 2. Fetch existing leads from Supabase database for duplicate checking & assignment updates
    var getOptions = {
      method: "get",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": "Bearer " + SUPABASE_KEY
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/leads?select=id,contact,client_name,assigned_to", getOptions);
    if (response.getResponseCode() !== 200) {
      Logger.log("[Sync Error] Failed to fetch existing leads from Supabase. Response: " + response.getContentText());
      return;
    }

    var existingLeads = JSON.parse(response.getContentText());
    
    // Build lookup maps of existing leads
    var existingMap = {};
    var existingSet = {};
    for (var i = 0; i < existingLeads.length; i++) {
      var item = existingLeads[i];
      if (item.contact) {
        var cleanC = String(item.contact).replace(/\D/g, "");
        if (cleanC) {
          existingSet[cleanC] = true;
          existingMap[cleanC] = item;
        }
        var contactLow = String(item.contact).trim().toLowerCase();
        existingSet[contactLow] = true;
        existingMap[contactLow] = item;
      }
      if (item.client_name && item.contact) {
        var combo = (String(item.client_name).trim() + "_" + String(item.contact).trim()).toLowerCase();
        existingSet[combo] = true;
        existingMap[combo] = item;
      }
    }

    // Standardize staff names case-insensitively (e.g. "Ragini k" -> "Ragini K")
    var KNOWN_STAFF = ["Mayuri K", "Ragini K", "Shreya K"];
    function formatAssignedTo(val) {
      if (!val) return null;
      var str = String(val).trim();
      if (!str) return null;
      for (var s = 0; s < KNOWN_STAFF.length; s++) {
        if (KNOWN_STAFF[s].toLowerCase() === str.toLowerCase()) {
          return KNOWN_STAFF[s];
        }
      }
      return str;
    }

    // 3. Process each row from Google Sheet
    var newLeadsToInsert = [];
    var existingLeadsToUpdate = [];

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var rawName = row[clientNameIdx];
      var rawContact = row[contactIdx];
      var rawAdmissionDate = admissionDateIdx !== -1 ? row[admissionDateIdx] : null;
      var rawAssignedTo = assignedToIdx !== -1 ? row[assignedToIdx] : null;

      var clientName = String(rawName || "").trim();
      var contact = String(rawContact || "").trim();
      var assignedTo = formatAssignedTo(rawAssignedTo);

      // Skip empty rows
      if (!clientName || !contact) continue;

      var cleanDigits = contact.replace(/\D/g, "");
      var contactLower = contact.toLowerCase();
      var comboKey = (clientName + "_" + contact).toLowerCase();

      var existingItem = existingMap[cleanDigits] || existingMap[contactLower] || existingMap[comboKey];

      // If ALREADY in CRM
      if (existingItem) {
        // Mark status as Done in lead CRM status column
        sheet.getRange(r + 1, crmStatusIdx + 1).setValue("Done");

        // If sheet has an assigned_to value and database assigned_to is different or null, prepare update
        if (assignedTo && (existingItem.assigned_to || "").toLowerCase() !== assignedTo.toLowerCase()) {
          existingLeadsToUpdate.push({
            id: existingItem.id,
            assigned_to: assignedTo
          });
          existingItem.assigned_to = assignedTo; // update in-memory map
        }
        continue;
      }

      // Format Admission Date to YYYY-MM-DD
      var formattedAdmissionDate = parseSheetDate(rawAdmissionDate);

      // Prepare new lead object with row index saved
      newLeadsToInsert.push({
        client_name: clientName,
        contact: contact,
        admission_date: formattedAdmissionDate,
        assigned_to: assignedTo,
        lead_status: "Select Option",
        created_at: new Date().toISOString(),
        rowIndex: r + 1
      });

      // Mark in local set
      if (cleanDigits) existingSet[cleanDigits] = true;
      existingSet[contactLower] = true;
      existingSet[comboKey] = true;
    }

    // 4. Update existing leads in Supabase if ASSIGNED TO was added/changed in Google Sheet
    if (existingLeadsToUpdate.length > 0) {
      Logger.log("[Sync] Updating assigned_to for " + existingLeadsToUpdate.length + " existing lead(s)...");
      for (var u = 0; u < existingLeadsToUpdate.length; u++) {
        var updateObj = existingLeadsToUpdate[u];
        var patchOptions = {
          method: "patch",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          payload: JSON.stringify({ assigned_to: updateObj.assigned_to }),
          muteHttpExceptions: true
        };
        var patchResponse = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/leads?id=eq." + updateObj.id, patchOptions);
        Logger.log("[Sync Patch] Lead ID " + updateObj.id + " updated to assigned_to=" + updateObj.assigned_to + " (Status: " + patchResponse.getResponseCode() + ")");
      }
    }

    // 5. Send new leads to Supabase REST API
    if (newLeadsToInsert.length > 0) {
      Logger.log("[Sync] Found " + newLeadsToInsert.length + " new lead(s). Posting to CRM...");

      var payloadData = newLeadsToInsert.map(function(item) {
        return {
          client_name: item.client_name,
          contact: item.contact,
          admission_date: item.admission_date,
          assigned_to: item.assigned_to,
          lead_status: item.lead_status,
          created_at: item.created_at
        };
      });

      var postOptions = {
        method: "post",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        payload: JSON.stringify(payloadData),
        muteHttpExceptions: true
      };

      var postResponse = UrlFetchApp.fetch(SUPABASE_URL + "/rest/v1/leads", postOptions);
      var statusCode = postResponse.getResponseCode();

      if (statusCode === 201 || statusCode === 200) {
        Logger.log("[Sync Success] Successfully added " + newLeadsToInsert.length + " lead(s) to CRM.");
        // Mark newly added leads as Done in lead CRM status column
        for (var k = 0; k < newLeadsToInsert.length; k++) {
          sheet.getRange(newLeadsToInsert[k].rowIndex, crmStatusIdx + 1).setValue("Done");
        }
      } else {
        Logger.log("[Sync Error] Failed to post leads. Code: " + statusCode + ", Body: " + postResponse.getContentText());
      }
    } else {
      Logger.log("[Sync] Scan finished. No new leads to insert.");
    }

    // Force Google Sheet to flush and display all cell updates immediately
    SpreadsheetApp.flush();
    Logger.log("[Sync Complete] All sheet statuses and assignments synchronized.");

  } catch (err) {
    Logger.log("[Sync Exception] Error: " + err.toString());
  }
}

/**
 * Helper function to parse dates into YYYY-MM-DD format
 */
function parseSheetDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  var strVal = String(val).trim();
  if (!strVal) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) return strVal;
  var parsed = new Date(strVal);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return null;
}

/**
 * Run this function ONCE to set up automatic scanning every 1 minute.
 */
function setup1MinuteTrigger() {
  deleteExistingTriggers();

  ScriptApp.newTrigger("scanAndSyncLeads")
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log("[Trigger] Successfully set up 1-minute automatic scanner trigger!");
}

/**
 * Helper to delete triggers if resetting setup.
 */
function deleteExistingTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "scanAndSyncLeads") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * Manual test function - run from Apps Script console to verify connection & status update.
 */
function testManualSync() {
  Logger.log("Starting manual test scan...");
  scanAndSyncLeads();
  Logger.log("Manual test scan completed.");
}
