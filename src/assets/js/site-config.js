/*
File: Site configuration

THE ONE PLACE to set the contact form's backend address.

-----------------------------------------------------------------------------
PASTE YOUR APPS SCRIPT WEB APP URL BELOW
-----------------------------------------------------------------------------

After deploying apps-script/Code.gs (Deploy -> New deployment -> Web app),
Google shows a "Web app URL". Paste it here. It looks like:

    https://script.google.com/macros/s/AKfycbx..................../exec

It must end in /exec - a URL ending in /dev only works while you are signed in
as the script's owner, so the form would fail for every actual visitor.

Nothing else in the website needs changing when the backend moves, and nothing
here is secret: the Web App URL is a public endpoint by design. The Google
credentials stay inside Apps Script and never reach the browser.
*/

export const APPS_SCRIPT_URL =
    import.meta.env.VITE_APPS_SCRIPT_URL ||
    "https://script.google.com/macros/s/AKfycbzRPyBHx0fjiREjc4h_vMaAjKufIxdIUBJv-Cw6YAktDP_HMVFQ157RJFNKnAP8Av2t/exec"

/*
Where a successful submission lands.

"/thank-you" works on any host that serves extensionless URLs (Vercel does,
via the rewrite in vercel.json). If the final host cannot, change this to
"/thank-you.html" - the page itself is identical either way.
*/
export const THANK_YOU_PATH = "/thank-you"

/* Shown to visitors whenever we cannot take the enquiry online. */
export const PRACTICE_PHONE = "971-978-7840"
export const PRACTICE_EMAIL = "abcaestheticsllc@gmail.com"
