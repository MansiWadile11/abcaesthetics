/**
 * MAIL - how the two email flows actually send
 * =========================================================================
 *
 * Shared by Flow 2 (the practice's notification) and Flow 3 (the patient's
 * confirmation). Neither of those files knows or cares which provider is in
 * use - they hand a message to sendMail() and that is the end of their
 * involvement.
 *
 * WHY THIS EXISTS
 * ---------------
 * Google's own MailApp works with no setup at all, but sends FROM the Google
 * account that authorised the script - so a patient's confirmation arrives
 * from someone's Gmail address rather than the practice's domain, and there
 * is no way to see whether it was delivered, bounced or filtered.
 *
 * Pointing this at a transactional provider fixes both: mail goes out as
 * @abcaestheticsllc.com with proper SPF/DKIM, and every message appears in
 * the provider's dashboard with its delivery status.
 *
 * WHY AN API AND NOT SMTP
 * -----------------------
 * Apps Script has no raw socket access, so it cannot speak SMTP at all.
 * Every provider below offers SMTP credentials AND an HTTP API on the same
 * account - same servers, same domain verification, same deliverability.
 * The API is simply the half of the account Apps Script can reach.
 *
 * THE API KEY IS NOT IN THIS FILE
 * -------------------------------
 * It lives in Script Properties, which is per-project storage that is not
 * part of the source. So these files can be pasted, shared or committed
 * without carrying a credential. See setMailApiKey() in Setup.gs.
 */


/** Where the key is kept. Project Settings -> Script Properties. */
var MAIL_KEY_PROPERTY = "MAIL_API_KEY";


/**
 * Send one message.
 *
 * @param message  { to, subject, replyTo, name, htmlBody, body }
 *                 - the same shape MailApp.sendEmail takes, so the two email
 *                   flows did not have to change shape to use this.
 * @throws on failure, so the calling flow records it and carries on.
 */
function sendMail(message) {
    var provider = String(CONFIG.MAIL_PROVIDER || "gmail").toLowerCase();

    if (provider === "gmail") {
        MailApp.sendEmail(message);
        return;
    }

    var key = mailApiKey();
    if (!key) {
        // Configured for a provider but with no key: fall back rather than
        // lose the email. An enquiry reaching the practice from the wrong
        // address beats one that never arrives.
        log("MAIL_PROVIDER is '" + provider + "' but no API key is set - falling back to Gmail. " +
            "Add " + MAIL_KEY_PROPERTY + " in Project Settings -> Script Properties.");
        MailApp.sendEmail(message);
        return;
    }

    var request = buildMailRequest(provider, message, key);
    var response = UrlFetchApp.fetch(request.url, request.options);
    var code = response.getResponseCode();

    if (code < 200 || code >= 300) {
        // The body can echo the request, so it is truncated and the key is
        // never in scope here - but be careful if you extend this.
        throw new Error(provider + " rejected the message (HTTP " + code + "): " +
            String(response.getContentText()).substring(0, 200));
    }
}


/** The verified sender address. Required by every API provider. */
function mailFrom() {
    if (CONFIG.MAIL_FROM) return CONFIG.MAIL_FROM;
    // Last resort so a misconfiguration is visible rather than silent.
    return CONFIG.WEBSITE_NAME + " <" + CONFIG.PRACTICE_EMAIL + ">";
}

/** Split 'Name <someone@example.com>' apart; providers want the two separately. */
function splitAddress(value) {
    var match = String(value || "").match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
    if (match) return { name: match[1].replace(/^"|"$/g, ""), email: match[2] };
    return { name: "", email: String(value || "").trim() };
}

function mailApiKey() {
    try {
        return PropertiesService.getScriptProperties().getProperty(MAIL_KEY_PROPERTY) || "";
    } catch (err) {
        log("could not read " + MAIL_KEY_PROPERTY + ": " + err.message);
        return "";
    }
}


/**
 * Build the provider-specific HTTP request.
 *
 * Kept separate from sending so a test can inspect exactly what would go out
 * without anything leaving the machine.
 */
function buildMailRequest(provider, message, key) {
    var from = splitAddress(mailFrom());
    var to = splitAddress(message.to);

    // Every provider is given both an HTML and a plain-text part. A medical
    // enquiry confirmation arriving blank in a text-only client is a patient
    // who believes nothing was received.
    var html = message.htmlBody;
    var text = message.body;

    switch (provider) {

        case "postmark":
            return {
                url: "https://api.postmarkapp.com/email",
                options: {
                    method: "post",
                    contentType: "application/json",
                    headers: { "X-Postmark-Server-Token": key, Accept: "application/json" },
                    muteHttpExceptions: true,
                    payload: JSON.stringify({
                        From: mailFrom(),
                        To: to.email,
                        Subject: message.subject,
                        HtmlBody: html,
                        TextBody: text,
                        ReplyTo: message.replyTo || "",
                        MessageStream: CONFIG.MAIL_STREAM || "outbound"
                    })
                }
            };

        case "resend":
            return {
                url: "https://api.resend.com/emails",
                options: {
                    method: "post",
                    contentType: "application/json",
                    headers: { Authorization: "Bearer " + key },
                    muteHttpExceptions: true,
                    payload: JSON.stringify({
                        from: mailFrom(),
                        to: [to.email],
                        subject: message.subject,
                        html: html,
                        text: text,
                        reply_to: message.replyTo || undefined
                    })
                }
            };

        case "sendgrid":
            return {
                url: "https://api.sendgrid.com/v3/mail/send",
                options: {
                    method: "post",
                    contentType: "application/json",
                    headers: { Authorization: "Bearer " + key },
                    muteHttpExceptions: true,
                    payload: JSON.stringify({
                        personalizations: [{ to: [{ email: to.email }] }],
                        from: { email: from.email, name: from.name || CONFIG.WEBSITE_NAME },
                        reply_to: message.replyTo ? { email: message.replyTo } : undefined,
                        subject: message.subject,
                        content: [
                            { type: "text/plain", value: text },
                            { type: "text/html", value: html }
                        ]
                    })
                }
            };

        case "brevo":
            return {
                url: "https://api.brevo.com/v3/smtp/email",
                options: {
                    method: "post",
                    contentType: "application/json",
                    headers: { "api-key": key, accept: "application/json" },
                    muteHttpExceptions: true,
                    payload: JSON.stringify({
                        sender: { email: from.email, name: from.name || CONFIG.WEBSITE_NAME },
                        to: [{ email: to.email }],
                        subject: message.subject,
                        htmlContent: html,
                        textContent: text,
                        replyTo: message.replyTo ? { email: message.replyTo } : undefined
                    })
                }
            };

        case "mailgun":
            if (!CONFIG.MAIL_DOMAIN) {
                throw new Error("Mailgun needs CONFIG.MAIL_DOMAIN (the sending domain, e.g. mg.abcaestheticsllc.com)");
            }
            return {
                // Mailgun is form-encoded, not JSON, and authenticates with
                // HTTP Basic using the literal username "api".
                url: "https://api.mailgun.net/v3/" + CONFIG.MAIL_DOMAIN + "/messages",
                options: {
                    method: "post",
                    headers: { Authorization: "Basic " + Utilities.base64Encode("api:" + key) },
                    muteHttpExceptions: true,
                    payload: {
                        from: mailFrom(),
                        to: to.email,
                        subject: message.subject,
                        text: text,
                        html: html,
                        "h:Reply-To": message.replyTo || ""
                    }
                }
            };

        default:
            throw new Error(
                "Unknown MAIL_PROVIDER '" + provider + "'. Use one of: " +
                "gmail, postmark, resend, sendgrid, brevo, mailgun."
            );
    }
}
