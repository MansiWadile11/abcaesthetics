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
    "https://script.google.com/macros/s/AKfycby_uKh0CQRZHmRDaB5Zy-CSMODddBpW2JHqDbzq0LreonsW2pUJsvh7gRrY8NR6nWRQ/exec"

/*
Where a successful submission lands.

Every page is served at a trailing-slash path (/about/, /contact/) so the ten
URLs carried over from the old site match it exactly. vercel.json sets
cleanUrls + trailingSlash to produce that shape, and the dev server does the
same through the clean-urls plugin in vite.config.js.

If the final host cannot serve that shape, change this to "/thank-you.html" -
the page itself is identical either way.
*/
export const THANK_YOU_PATH = "/thank-you/"

/*
Google reCAPTCHA v3 - PUBLIC site key only.

The matching SECRET key is never here and never in this repository. It lives
in the Apps Script project's Script Properties, which is where the token,
hostname, action and score are actually checked. A score trusted in the
browser protects nothing: a bot posts straight to the endpoint.

v3 is invisible - there is no checkbox and no puzzle. A token is requested at
the moment the visitor submits, and travels with the enquiry.

Leave this empty and nothing is loaded and nothing is enforced; the honeypot,
rate limiting, duplicate suppression and server-side validation already in
place continue to do the work. See .env.example for the two-sided setup.
*/
export const RECAPTCHA_SITE_KEY =
    import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""

/* Shown to visitors whenever we cannot take the enquiry online. */
export const PRACTICE_PHONE = "971-978-7840"
export const PRACTICE_EMAIL = "abcaestheticsllc@gmail.com"
