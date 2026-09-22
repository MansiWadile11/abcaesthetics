/*
Runs the real apps-script/Code.gs under Node.

Apps Script only executes inside Google, so the file would otherwise be
untestable - which for the one piece of the system that touches patient data
is not good enough. This provides the Google services it expects
(SpreadsheetApp, MailApp, CacheService, LockService, Utilities,
ContentService) as working in-memory stand-ins, then evaluates Code.gs
unmodified and hands back its doPost/doGet along with the state.

So the validation, sanitisation, formula-escaping, duplicate detection, rate
limiting, sheet layout and both email bodies are all exercised as written. The
stubs mimic the real API's shape and are noted where they simplify.
*/

import fs from "node:fs"
import vm from "node:vm"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
/**
 * Apps Script concatenates every .gs file in a project into one script, so the
 * host loads them the same way. The order only matters for readability - all
 * top-level statements are var and function declarations, which hoist.
 */
export const APPS_SCRIPT_DIR = path.join(HERE, "..", "apps-script")

const FILE_ORDER = [
    "Config.gs",
    "Validation.gs",
    "Guards.gs",
    "Mail.gs",
    "Flow1_Sheet.gs",
    "Flow2_AdminEmail.gs",
    "Flow3_AutoReply.gs",
    "Main.gs",
    "Setup.gs",
]

export function readProject() {
    const onDisk = fs.readdirSync(APPS_SCRIPT_DIR).filter((f) => f.endsWith(".gs"))
    const missing = onDisk.filter((f) => !FILE_ORDER.includes(f))
    if (missing.length) throw new Error("apps-script file not in FILE_ORDER: " + missing.join(", "))

    const NL = String.fromCharCode(10)

    return FILE_ORDER
        .filter((f) => onDisk.includes(f))
        .map((f) => ["//# " + f, fs.readFileSync(path.join(APPS_SCRIPT_DIR, f), "utf8")].join(NL))
        .join(NL + NL)
}

/** A small but faithful stand-in for a Sheets range. */
function makeRange(sheet, row, col, numRows, numCols) {
    const api = {
        setValues(values) {
            for (let r = 0; r < values.length; r++) {
                const target = row - 1 + r
                while (sheet._rows.length <= target) sheet._rows.push([])
                for (let c = 0; c < values[r].length; c++) {
                    sheet._rows[target][col - 1 + c] = values[r][c]
                }
            }
            return api
        },
        getValues() {
            const out = []
            for (let r = 0; r < numRows; r++) {
                const source = sheet._rows[row - 1 + r] || []
                const line = []
                for (let c = 0; c < numCols; c++) line.push(source[col - 1 + c] ?? "")
                out.push(line)
            }
            return out
        },
        // Formatting is chainable and has no observable effect here, but it
        // must not throw - Code.gs relies on that.
        setFontWeight: () => api,
        setBackground: () => api,
        setFontColor: () => api,
        setHorizontalAlignment: () => api,
        setWrap: () => api,
        setNumberFormat: () => api,
    }
    return api
}

function makeSheet(name) {
    const sheet = {
        _rows: [],
        getName: () => name,
        getLastRow: () => sheet._rows.length,
        getMaxRows: () => Math.max(1000, sheet._rows.length),
        getRange: (r, c, nr = 1, nc = 1) => makeRange(sheet, r, c, nr, nc),
        appendRow: (row) => {
            // Sheets treats a leading apostrophe as "this is text" and does
            // not store it - reading the cell back gives the bare value.
            // The stub must do the same or the escaping looks broken in tests.
            sheet._rows.push(row.map((cell) =>
                typeof cell === "string" && cell.charAt(0) === "'" ? cell.slice(1) : cell))
            return sheet
        },
        setFrozenRows: () => sheet,
        setColumnWidth: () => sheet,
        getLastColumn: () => sheet._rows.reduce((w, r) => Math.max(w, r.length), 0),
    }
    return sheet
}

export function createHost({ sheetId = "test-sheet", failSheet = false } = {}) {
    const state = {
        sheets: new Map(),
        inbox: [],
        logs: [],
        cache: new Map(),
        lockWaits: 0,
        failSheet,
        http: [],          // every UrlFetchApp request made
        httpReply: null,   // what the next one should answer
        props: {},         // Script Properties
    }

    const spreadsheet = {
        getName: () => "ABC Enquiries (test)",
        getSheetByName: (n) => state.sheets.get(n) || null,
        insertSheet: (n) => {
            const s = makeSheet(n)
            state.sheets.set(n, s)
            return s
        },
    }

    const sandbox = {
        console: { log: (m) => state.logs.push(String(m)) },
        Logger: { log: (m) => state.logs.push(String(m)) },

        SpreadsheetApp: {
            openById: (id) => {
                if (state.failSheet) throw new Error("simulated Sheets outage")
                if (id !== sheetId) throw new Error("Unexpected sheet id: " + id)
                return spreadsheet
            },
            getActiveSpreadsheet: () => {
                if (state.failSheet) throw new Error("simulated Sheets outage")
                return spreadsheet
            },
        },

        MailApp: {
            sendEmail: (opts) => {
                if (state.failMail) throw new Error("simulated mail failure")
                if (!opts || !opts.to) throw new Error("no recipient")
                state.inbox.push(JSON.parse(JSON.stringify(opts)))
            },
        },

        CacheService: {
            getScriptCache: () => ({
                get: (k) => {
                    const hit = state.cache.get(k)
                    if (!hit) return null
                    if (hit.expires < Date.now()) { state.cache.delete(k); return null }
                    return hit.value
                },
                put: (k, v, ttl) => {
                    state.cache.set(k, { value: String(v), expires: Date.now() + (ttl || 600) * 1000 })
                },
            }),
        },

        LockService: {
            getScriptLock: () => ({
                waitLock: () => { state.lockWaits++ },
                releaseLock: () => {},
            }),
        },

        Utilities: {
            formatDate: (date, tz, fmt) => {
                // Only the format Code.gs actually asks for.
                const parts = new Intl.DateTimeFormat("en-US", {
                    timeZone: tz, year: "numeric", month: "short", day: "2-digit",
                    hour: "2-digit", minute: "2-digit", hour12: true,
                }).formatToParts(date)
                const get = (t) => (parts.find((p) => p.type === t) || {}).value || ""
                const out = `${get("month")} ${get("day")}, ${get("year")} at ${get("hour")}:${get("minute")} ${get("dayPeriod")}`
                return fmt.includes("'at'") ? out : out.replace(" at ", " ")
            },
            base64Encode: (value) => Buffer.from(String(value), "utf8").toString("base64"),
            DigestAlgorithm: { MD5: "MD5" },
            computeDigest: (_alg, value) => {
                const buf = crypto.createHash("md5").update(String(value), "utf8").digest()
                // Apps Script hands back SIGNED bytes; Code.gs corrects for it,
                // so the stub must reproduce that or the correction is untested.
                return Array.from(buf).map((b) => (b > 127 ? b - 256 : b))
            },
        },

        // Outbound HTTP, used by the mail provider adapters. Nothing leaves
        // the machine: every request is captured for inspection instead.
        UrlFetchApp: {
            fetch: (url, options) => {
                state.http.push({ url, options: JSON.parse(JSON.stringify(options || {})) })
                const reply = state.httpReply || { code: 200, body: '{"ok":true}' }
                return {
                    getResponseCode: () => reply.code,
                    getContentText: () => reply.body,
                }
            },
        },

        PropertiesService: {
            getScriptProperties: () => ({
                getProperty: (k) => (k in state.props ? state.props[k] : null),
                setProperty: (k, v) => { state.props[k] = String(v) },
                deleteProperty: (k) => { delete state.props[k] },
            }),
        },

        ContentService: {
            MimeType: { JSON: "application/json" },
            createTextOutput: (text) => {
                const out = {
                    _text: text,
                    _mime: "text/plain",
                    setMimeType(m) { out._mime = m; return out },
                    getContent: () => out._text,
                    getMimeType: () => out._mime,
                }
                return out
            },
        },
    }

    const context = vm.createContext(sandbox)
    vm.runInContext(readProject(), context, { filename: "apps-script" })

    /** POST a JSON body the way the website does (text/plain carrying JSON). */
    function post(payload) {
        const out = sandbox.doPost({
            postData: { contents: JSON.stringify(payload), type: "text/plain" },
            parameter: {},
        })
        return JSON.parse(out.getContent())
    }

    function get() {
        return JSON.parse(sandbox.doGet().getContent())
    }

    return {
        post,
        get,
        state,
        sandbox,
        rows: () => {
            const sheet = state.sheets.get("Enquiries")
            return sheet ? sheet._rows.slice() : []
        },
        header: () => {
            const sheet = state.sheets.get("Enquiries")
            return sheet && sheet._rows.length ? sheet._rows[0] : null
        },
        dataRows: () => {
            const sheet = state.sheets.get("Enquiries")
            return sheet ? sheet._rows.slice(1) : []
        },
        clearCache: () => state.cache.clear(),
    }
}
