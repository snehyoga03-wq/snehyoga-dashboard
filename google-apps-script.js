// Google Apps Script code for receiving form submissions
// Deploy this as a Web App in Google Apps Script

// SETUP INSTRUCTIONS:
// 1. Open Google Sheets and create a new spreadsheet
// 2. Go to Extensions > Apps Script
// 3. Delete any existing code and paste this code
// 4. Click "Deploy" > "New deployment"
// 5. Select type: "Web app"
// 6. Execute as: "Me"
// 7. Who has access: "Anyone"
// 8. Click "Deploy" and copy the Web App URL
// 9. Paste that URL in src/components/RegistrationForm.tsx where it says "YOUR_GOOGLE_SCRIPT_URL_HERE"

function doPost(e) {
  try {
    // Get the active spreadsheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // If this is the first time, add headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Name",
        "Phone"
      ]);
      
      // Format header row
      var headerRange = sheet.getRange(1, 1, 1, 3);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#4CAF50");
      headerRange.setFontColor("#FFFFFF");
    }
    
    // Get form data
    var timestamp = new Date();
    var name = e.parameter.name || "";
    var phone = e.parameter.phone || "";
    
    // Add new row with data
    sheet.appendRow([
      timestamp,
      name,
      phone
    ]);
    
    // Auto-resize columns for better readability
    sheet.autoResizeColumns(1, 3);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({
        "status": "success",
        "message": "Data saved successfully"
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({
        "status": "error",
        "message": error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function to verify the script works
function testScript() {
  var testData = {
    parameter: {
      name: "Test User",
      phone: "9876543210"
    }
  };
  
  var result = doPost(testData);
  Logger.log(result.getContent());
}
