/**
 * FLOW 2 - EMAIL THE PRACTICE
 * =========================================================================
 *
 * Sends the enquiry to CONFIG.ADMIN_EMAIL as a clean summary table, with
 * Reply-To set to the patient so hitting Reply answers them directly rather
 * than bouncing back to Google.
 *
 * Runs only after flow 1 has stored the enquiry. If THIS flow fails the
 * enquiry is already safe in the sheet, so the visitor still sees success and
 * the failure goes to the log instead.
 *
 * Owns:  the practice's notification and its wording.
 * Needs: CONFIG.ADMIN_EMAIL, CONFIG.WEBSITE_NAME, BRAND.
 *
 * Test it on its own with testFlow2_AdminEmail() in Setup.gs.
 */


/**
 * @returns {ok, skipped, detail} - never throws
 */
function flowNotifyAdmin(v, submittedAt) {
    if (CONFIG.FLOWS.NOTIFY_ADMIN === false) {
        return { ok: true, skipped: true, detail: "turned off in CONFIG.FLOWS" };
    }

    try {
        sendMail(buildAdminEmail(v, submittedAt));
        return { ok: true, skipped: false, detail: "sent to " + CONFIG.ADMIN_EMAIL };
    } catch (err) {
        log("FLOW 2 (admin email) failed: " + err.message);
        return { ok: false, skipped: false, detail: err.message };
    }
}


/** Everything the practice needs, in the order they will want to read it. */
function adminSummaryRows(v, submittedAt) {
    var candidates = [
        ["Name", v.name],
        ["Email", v.email],
        ["Phone", v.phone],
        ["Subject", v.subject],
        ["Preferred contact", v.contactMethod],
        ["Preferred date", v.preferredDate],
        ["Preferred time", v.preferredTime],
        ["Message", v.message],
        ["Submission Date & Time", submittedAt],
        ["Source/Page", v.page],
        ["Consent given", v.consent]
    ];

    var out = [];
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i][1]) out.push(candidates[i]);
    }
    return out;
}

/** Built separately from the sending so it can be inspected in a test. */
function buildAdminEmail(v, submittedAt) {
    var rows = adminSummaryRows(v, submittedAt);
    var cells = "";

    for (var i = 0; i < rows.length; i++) {
        cells +=
            '<tr>' +
            '<td style="padding:9px 14px 9px 0;color:' + BRAND.muted +
            ';white-space:nowrap;vertical-align:top;width:170px;">' + escapeHtml(rows[i][0]) + '</td>' +
            '<td style="padding:9px 0;color:' + BRAND.cocoa + ';vertical-align:top;">' +
            toHtmlLines(rows[i][1]) + '</td>' +
            '</tr>';
    }

    var html =
        '<div style="margin:0;padding:24px;background:' + BRAND.page +
        ';font-family:Helvetica,Arial,sans-serif;color:' + BRAND.ink + ';">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" ' +
        'style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ' + BRAND.line + ';">' +

        '<tr><td style="background:' + BRAND.green + ';padding:20px 26px;">' +
        '<div style="color:#ffffff;font-size:17px;font-weight:700;">New contact form enquiry</div>' +
        '<div style="color:' + BRAND.gold + ';font-size:13px;margin-top:4px;">' + escapeHtml(CONFIG.WEBSITE_NAME) + '</div>' +
        '</td></tr>' +

        '<tr><td style="padding:22px 26px;">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" ' +
        'style="font-size:14px;line-height:1.55;">' + cells + '</table>' +
        '<div style="margin-top:22px;padding-top:16px;border-top:1px solid ' + BRAND.line +
        ';font-size:13px;color:' + BRAND.muted + ';">' +
        'Reply to this email and your reply goes directly to ' +
        '<a href="mailto:' + escapeHtml(v.email) + '" style="color:' + BRAND.green + ';">' + escapeHtml(v.email) + '</a>.' +
        '</div></td></tr></table></div>';

    var text = "New contact form enquiry - " + CONFIG.WEBSITE_NAME + "\n\n";
    for (var j = 0; j < rows.length; j++) {
        text += rows[j][0] + ": " + rows[j][1] + "\n";
    }
    text += "\nReply to this email to answer " + v.email + " directly.\n";

    return {
        to: CONFIG.ADMIN_EMAIL,
        subject: subjectPrefix() + "New Contact Form Enquiry - " + v.name,
        replyTo: v.email,
        name: CONFIG.WEBSITE_NAME,
        htmlBody: html,
        body: text
    };
}
