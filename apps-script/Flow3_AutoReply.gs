/**
 * FLOW 3 - CONFIRM TO THE PATIENT
 * =========================================================================
 *
 * Sends the person who filled the form a branded confirmation: we have your
 * enquiry, thank you, the team will review it and get back to you shortly.
 *
 * Runs only after flow 1 has stored the enquiry, so nobody is ever told
 * "we have it" about something that was not recorded.
 *
 * This flow is a courtesy and NEVER decides the outcome. A confirmation can
 * be rejected for reasons that have nothing to do with the enquiry - a full
 * mailbox, a typo that still passed validation, an over-strict spam filter -
 * and none of those mean the practice did not receive it.
 *
 * Owns:  the patient's confirmation and its wording.
 * Needs: CONFIG.PRACTICE_EMAIL, CONFIG.PRACTICE_PHONE, CONFIG.WEBSITE_NAME,
 *        CONFIG.WEBSITE_URL, BRAND.
 *
 * Test it on its own with testFlow3_AutoReply() in Setup.gs.
 */


/**
 * @returns {ok, skipped, detail} - never throws
 */
function flowSendAutoReply(v) {
    if (CONFIG.FLOWS.AUTO_REPLY === false) {
        return { ok: true, skipped: true, detail: "turned off in CONFIG.FLOWS" };
    }

    try {
        sendMail(buildAutoReply(v));
        return { ok: true, skipped: false, detail: "sent to " + v.email };
    } catch (err) {
        log("FLOW 3 (auto-reply) failed: " + err.message);
        return { ok: false, skipped: false, detail: err.message };
    }
}


/** A short recap so the patient can see what we understood. */
function autoReplySummaryRows(v) {
    var candidates = [
        ["What you asked about", v.subject],
        ["Preferred contact", v.contactMethod],
        ["Preferred date", v.preferredDate],
        ["Preferred time", v.preferredTime]
    ];

    var out = [];
    for (var i = 0; i < candidates.length; i++) {
        if (candidates[i][1]) out.push(candidates[i]);
    }
    return out;
}

/** Built separately from the sending so it can be inspected in a test. */
function buildAutoReply(v) {
    var summary = autoReplySummaryRows(v);

    var summaryHtml = "";
    if (summary.length) {
        var cells = "";
        for (var j = 0; j < summary.length; j++) {
            cells +=
                '<tr><td style="padding:10px 14px;color:' + BRAND.muted +
                ';white-space:nowrap;vertical-align:top;">' + escapeHtml(summary[j][0]) + '</td>' +
                '<td style="padding:10px 14px 10px 0;color:' + BRAND.cocoa + ';vertical-align:top;">' +
                toHtmlLines(summary[j][1]) + '</td></tr>';
        }
        summaryHtml =
            '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" ' +
            'style="font-size:14px;line-height:1.55;background:' + BRAND.page +
            ';border-radius:10px;margin:0 0 20px;">' + cells + '</table>';
    }

    var button = "";
    if (CONFIG.WEBSITE_URL) {
        button =
            '<p style="margin:24px 0 0;"><a href="' + escapeHtml(CONFIG.WEBSITE_URL) +
            '" style="display:inline-block;background:' + BRAND.green +
            ';color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;' +
            'padding:12px 24px;border-radius:999px;">Visit our website</a></p>';
    }

    var html =
        '<div style="margin:0;padding:24px;background:' + BRAND.page +
        ';font-family:Helvetica,Arial,sans-serif;color:' + BRAND.ink + ';">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" ' +
        'style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ' + BRAND.line + ';">' +

        '<tr><td style="background:' + BRAND.green + ';padding:24px 28px;text-align:center;">' +
        '<div style="color:#ffffff;font-size:19px;font-weight:700;">' + escapeHtml(CONFIG.WEBSITE_NAME) + '</div>' +
        '<div style="color:' + BRAND.gold + ';font-size:12px;margin-top:5px;letter-spacing:0.08em;' +
        'text-transform:uppercase;">Lake Oswego, Oregon</div>' +
        '</td></tr>' +

        '<tr><td style="padding:28px;">' +
        '<p style="margin:0 0 14px;font-size:17px;font-weight:700;color:' + BRAND.cocoa + ';">' +
        'Thank you, ' + escapeHtml(v.name) + ' &mdash; we have your enquiry.</p>' +

        '<p style="margin:0 0 18px;font-size:15px;line-height:1.65;">' +
        'Our team will review what you have sent and get back to you shortly, usually within 24&ndash;48 hours. ' +
        'Sending this form does not by itself confirm an appointment &mdash; we will contact you to arrange and confirm it.' +
        '</p>' +

        summaryHtml +

        '<p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#6d5f52;">' +
        'Treatment recommendations, eligibility, treatment frequency, product selection and clinical protocols are ' +
        'individualized following consultation and assessment. Results vary by individual, and no specific outcome ' +
        'is guaranteed.</p>' +

        '<p style="margin:0;font-size:15px;line-height:1.7;">Need us sooner? Call ' +
        '<a href="tel:' + escapeHtml(CONFIG.PRACTICE_PHONE.replace(/\D/g, "")) +
        '" style="color:' + BRAND.green + ';font-weight:600;">' + escapeHtml(CONFIG.PRACTICE_PHONE) + '</a>' +
        ' or email <a href="mailto:' + escapeHtml(CONFIG.PRACTICE_EMAIL) +
        '" style="color:' + BRAND.green + ';font-weight:600;">' + escapeHtml(CONFIG.PRACTICE_EMAIL) + '</a>.</p>' +

        button +
        '</td></tr>' +

        '<tr><td style="background:' + BRAND.page + ';padding:18px 28px;text-align:center;font-size:12px;color:' +
        BRAND.muted + ';line-height:1.6;">' +
        escapeHtml(CONFIG.WEBSITE_NAME) + ' &middot; 16240 Parker Road, Lake Oswego, Oregon<br>' +
        'This is an automated confirmation &mdash; please do not send clinical details by reply.' +
        '</td></tr></table></div>';

    var text =
        "Thank you, " + v.name + " - we have your enquiry.\n\n" +
        "Our team will review what you have sent and get back to you shortly, usually within 24-48 hours. " +
        "Sending this form does not by itself confirm an appointment - we will contact you to arrange and confirm it.\n\n";

    for (var k = 0; k < summary.length; k++) {
        text += summary[k][0] + ": " + summary[k][1] + "\n";
    }

    text +=
        "\nTreatment recommendations, eligibility, treatment frequency, product selection and clinical protocols " +
        "are individualized following consultation and assessment. Results vary by individual, and no specific " +
        "outcome is guaranteed.\n\n" +
        "Need us sooner? Call " + CONFIG.PRACTICE_PHONE + " or email " + CONFIG.PRACTICE_EMAIL + ".\n\n" +
        CONFIG.WEBSITE_NAME + ", 16240 Parker Road, Lake Oswego, Oregon\n" +
        "This is an automated confirmation - please do not send clinical details by reply.\n";

    return {
        to: v.email,
        subject: "We have your enquiry - " + CONFIG.WEBSITE_NAME,
        replyTo: CONFIG.PRACTICE_EMAIL,
        name: CONFIG.WEBSITE_NAME,
        htmlBody: html,
        body: text
    };
}
