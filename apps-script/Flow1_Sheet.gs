/**
 * FLOW 1 - STORE THE ENQUIRY IN THE GOOGLE SHEET
 * =========================================================================
 *
 * The enquiry's permanent record. This is the flow that matters most: if it
 * fails the enquiry is not stored anywhere, so the visitor is told, and the
 * two email flows are skipped rather than promising a reply to something
 * nobody can look up.
 *
 * Owns:  the tab, its headings, the row layout, the timestamp, and the
 *        duplicate scan that reads the sheet back.
 * Needs: CONFIG.SHEET_ID, CONFIG.SHEET_NAME, CONFIG.TIMEZONE, COLUMNS.
 *
 * Test it on its own with testFlow1_Sheet() in Setup.gs.
 */


/**
 * @param v            the validated enquiry
 * @param submittedAt  the formatted timestamp for column A
 * @returns {ok, skipped, detail} - never throws; Main.gs decides what to do
 */
function flowSaveToSheet(v, submittedAt) {
    if (CONFIG.FLOWS.SAVE_TO_SHEET === false) {
        return { ok: true, skipped: true, detail: "turned off in CONFIG.FLOWS" };
    }

    try {
        appendRow(v, submittedAt);
        return { ok: true, skipped: false, detail: "row appended" };
    } catch (err) {
        log("FLOW 1 (sheet) failed: " + err.message);
        return { ok: false, skipped: false, detail: err.message };
    }
}


// ---------------------------------------------------------------------------
// The sheet itself
// ---------------------------------------------------------------------------

function getSpreadsheet() {
    if (CONFIG.SHEET_ID) return SpreadsheetApp.openById(CONFIG.SHEET_ID);

    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;

    throw new Error(
        "No spreadsheet. Either set CONFIG.SHEET_ID, or create this script " +
        "from Extensions -> Apps Script inside the sheet itself."
    );
}

/** Returns the enquiries tab, creating it and its heading row if needed. */
function getSheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    }

    if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
        dressHeaderRow(sheet);
    }

    return sheet;
}

/** Cosmetic, but it is the difference between a log and a sheet someone works in. */
function dressHeaderRow(sheet) {
    try {
        sheet.getRange(1, 1, 1, COLUMNS.length)
            .setFontWeight("bold")
            .setBackground(BRAND.green)
            .setFontColor("#ffffff")
            .setHorizontalAlignment("left");

        sheet.setFrozenRows(1);
        sheet.setColumnWidth(1, 170);   // date & time
        sheet.setColumnWidth(6, 320);   // message
        sheet.getRange(1, 6, sheet.getMaxRows(), 1).setWrap(true);
    } catch (err) {
        log("header formatting skipped: " + err.message);
    }
}

function buildRow(v, submittedAt) {
    return [
        submittedAt,
        sanitizeForSheet(v.name),
        sanitizeForSheet(v.email),
        sanitizeForSheet(v.phone),
        sanitizeForSheet(v.subject),
        sanitizeForSheet(v.message),
        sanitizeForSheet(v.page),
        STATUS_NEW
    ];
}

function appendRow(v, submittedAt) {
    // Two browser tabs submitting at the same instant must not land on the
    // same row. The lock is held only for the write itself.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);

    try {
        getSheet().appendRow(buildRow(v, submittedAt));
    } finally {
        lock.releaseLock();
    }
}

function stamp(date) {
    return Utilities.formatDate(date, CONFIG.TIMEZONE, "MMM dd, yyyy 'at' hh:mm a");
}

/**
 * Has this exact enquiry already been written?
 *
 * The cache in Guards.gs catches the common case; this is the durable check,
 * for when the cache entry was evicted or the repeat arrived through a
 * different execution.
 */
function sheetHasRecently(v) {
    try {
        var sheet = getSheet();
        var last = sheet.getLastRow();
        if (last < 2) return false;

        var start = Math.max(2, last - 19);
        var rows = sheet.getRange(start, 1, last - start + 1, COLUMNS.length).getValues();

        for (var i = rows.length - 1; i >= 0; i--) {
            if (String(rows[i][2]).toLowerCase() === v.email &&
                String(rows[i][4]) === v.subject &&
                String(rows[i][5]).replace(/^'/, "") === v.message) {
                return true;
            }
        }
    } catch (err) {
        log("duplicate scan skipped: " + err.message);
    }

    return false;
}
