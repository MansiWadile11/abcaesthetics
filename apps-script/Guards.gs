/**
 * GUARDS - duplicates and rate limiting
 * =========================================================================
 *
 * Runs before any flow, so a repeat or a flood never reaches the sheet or the
 * mailbox.
 *
 * CacheService is shared across executions and expires on its own, which is
 * exactly the shape of both problems. It can be evicted early under memory
 * pressure, so the duplicate check also asks the sheet itself
 * (sheetHasRecently, in Flow1_Sheet.gs).
 */


function fingerprint(v) {
    var basis = [v.email, v.form, v.subject, v.message].join("|").toLowerCase();
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, basis);
    var hex = "";
    for (var i = 0; i < bytes.length; i++) {
        var b = (bytes[i] + 256) % 256;
        hex += (b < 16 ? "0" : "") + b.toString(16);
    }
    return "dup_" + hex;
}

function isDuplicate(v) {
    // Fast path: this execution, or a recent one, already saw it.
    if (CacheService.getScriptCache().get(fingerprint(v))) return true;

    // Durable path: the cache entry may have been evicted, or the repeat may
    // have arrived through a different execution. Owned by flow 1, because
    // only that flow knows how the sheet is laid out.
    return sheetHasRecently(v);
}


function remember(v) {
    CacheService.getScriptCache().put(fingerprint(v), "1", LIMITS.DUPLICATE_WINDOW);
}

/** Returns true when the submission should be refused. */
function rateLimit(v) {
    var cache = CacheService.getScriptCache();

    var emailKey = "rate_" + v.email;
    var perEmail = Number(cache.get(emailKey) || 0) + 1;
    cache.put(emailKey, String(perEmail), LIMITS.PER_EMAIL_WINDOW);
    if (perEmail > LIMITS.PER_EMAIL) return true;

    var globalCount = Number(cache.get("rate_global") || 0) + 1;
    cache.put("rate_global", String(globalCount), LIMITS.PER_EMAIL_WINDOW);
    if (globalCount > LIMITS.GLOBAL) return true;

    return false;
}
