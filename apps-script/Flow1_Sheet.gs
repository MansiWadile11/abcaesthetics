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

/**
 * Returns the enquiries tab, creating it and its heading row if needed.
 *
 * Memoised for the life of one execution. A single submission asks for the
 * sheet twice - once for the duplicate scan and once to append - and each
 * lookup is a round trip to Google, plus the heading check on top. Apps
 * Script gives every execution a fresh global scope, so this cannot go stale
 * between requests.
 */
var _sheetForThisRun = null;

function getSheet() {
    if (_sheetForThisRun) return _sheetForThisRun;

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

    if (!sheet) {
        sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    }

    if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
        dressHeaderRow(sheet);
        _sheetForThisRun = sheet;
        return sheet;
    }

    syncHeaderRow(sheet);
    _sheetForThisRun = sheet;
    return sheet;
}

/**
 * Bring an existing sheet's heading row up to date.
 *
 * Adding or renaming a column would otherwise leave the headings describing
 * an older layout while new rows are written to the new one - so column F
 * would say "Message" while holding a contact method. Checked once per cold
 * start, and it rewrites nothing when the headings already match.
 *
 * Rows written BEFORE a layout change keep their old shape, so after this
 * runs those earlier rows no longer line up with the headings above them.
 * That is called out in the log rather than silently patched, because only a
 * person can say whether the old rows matter.
 */
function syncHeaderRow(sheet) {
    try {
        var width = Math.max(sheet.getLastColumn(), COLUMNS.length);
        var current = sheet.getRange(1, 1, 1, width).getValues()[0];

        var same = true;
        for (var i = 0; i < COLUMNS.length; i++) {
            if (String(current[i] || "") !== COLUMNS[i]) { same = false; break; }
        }
        if (same) return;

        sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]);
        dressHeaderRow(sheet);

        log("sheet headings updated to the current layout. Rows written before " +
            "this change still follow the old column order - check or delete them.");
    } catch (err) {
        log("heading sync skipped: " + err.message);
    }
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
        sheet.setColumnWidth(COL.SUBMITTED + 1, 170);
        sheet.setColumnWidth(COL.PHONE + 1, 140);
        sheet.setColumnWidth(COL.TREATMENT + 1, 200);
        sheet.setColumnWidth(COL.CONTACT_METHOD + 1, 150);
        sheet.setColumnWidth(COL.MESSAGE + 1, 320);
        sheet.getRange(1, COL.MESSAGE + 1, sheet.getMaxRows(), 1).setWrap(true);

        // Belt and braces alongside forceText(): tell Sheets this column is
        // text, so a phone pasted in by hand keeps its leading zero too.
        sheet.getRange(2, COL.PHONE + 1, sheet.getMaxRows() - 1, 1).setNumberFormat("@");
    } catch (err) {
        log("header formatting skipped: " + err.message);
    }
}

/**
 * Keep a value as text no matter what it looks like.
 *
 * Sheets parses anything that resembles a number, so a phone typed as
 * "08624861120" is stored as the NUMBER 8624861120 and the leading zero is
 * gone for good - you cannot tell afterwards that it was ever there. A
 * leading apostrophe forces text; Sheets does not display it.
 */
function forceText(value) {
    var s = (value === null || value === undefined) ? "" : String(value);
    if (!s) return "";
    if (s.charAt(0) === "'") return s;
    return "'" + s;
}

function buildRow(v, submittedAt) {
    var row = [];
    row[COL.SUBMITTED] = submittedAt;
    row[COL.NAME] = sanitizeForSheet(v.name);
    row[COL.EMAIL] = sanitizeForSheet(v.email);
    // Phone is the one field that must never be treated as a number.
    row[COL.PHONE] = forceText(v.phone);
    row[COL.TREATMENT] = sanitizeForSheet(v.subject);
    row[COL.CONTACT_METHOD] = sanitizeForSheet(v.contactMethod);
    row[COL.MESSAGE] = sanitizeForSheet(v.message);
    row[COL.PAGE] = sanitizeForSheet(v.page);
    row[COL.STATUS] = STATUS_NEW;
    return row;
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

        // Only the span from Email to Message is compared, and ten rows is
        // more than a five-minute window can hold - reading all nine columns
        // of twenty rows made every submission pay for data it never used.
        var start = Math.max(2, last - 9);
        var first = COL.EMAIL + 1;
        var width = COL.MESSAGE - COL.EMAIL + 1;
        var rows = sheet.getRange(start, first, last - start + 1, width).getValues();

        for (var i = rows.length - 1; i >= 0; i--) {
            // Values written with a leading apostrophe come back without it,
            // but strip defensively so this holds either way.
            // Indexes are relative to the narrowed range, which starts at Email.
            var cell = function (col) { return String(rows[i][col - COL.EMAIL] || "").replace(/^'/, ""); };

            if (cell(COL.EMAIL).toLowerCase() === v.email &&
                cell(COL.TREATMENT) === v.subject &&
                cell(COL.MESSAGE) === v.message) {
                return true;
            }
        }
    } catch (err) {
        log("duplicate scan skipped: " + err.message);
    }

    return false;
}
