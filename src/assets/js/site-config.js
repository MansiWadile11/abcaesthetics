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

/* Shown to visitors whenever we cannot take the enquiry online. */
export const PRACTICE_PHONE = "971-978-7840"
export const PRACTICE_EMAIL = "abcaestheticsllc@gmail.com"
