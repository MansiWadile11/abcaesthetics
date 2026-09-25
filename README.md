# ABC Aesthetics Medspa

Website for **ABC Aesthetics & Wellness** — medical aesthetics and wellness care in
Lake Oswego, Oregon, led by Dr. Nawal M. Qneibi, DNP-BC.

Static site: Vite 8, Tailwind CSS 4, Handlebars partials. No server and no
database — the enquiry forms post to a Google Apps Script web app.

---

## Getting started

Requires [Node.js](https://nodejs.org/). Dependencies are managed with npm.

```bash
npm install        # install dependencies
npm run dev        # dev server on http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the built output
```

## Tests

```bash
npm test            # Apps Script backend, in a sandboxed VM (no network)
npm run test:ui     # the enquiry forms, in a real browser, desktop + mobile
npm run test:routes # every URL serves the page it should  (needs npm run dev)
npm run test:links  # every internal link resolves to a canonical URL
npm run test:meta   # titles, descriptions, canonical, Open Graph, robots
npm run test:clean  # kill a dev server a test run left behind
```

`test:routes` and `test:ui` need the dev server; the rest read `dist/`, so run
`npm run build` first.

## Layout

```
src/
  *.html              one file per page
  blog/<slug>/        articles, published at /blog/<slug>/
  partials/           navbar, footer, head, analytics, title-meta
  assets/css/         style.css is the entry; _general.css holds the site's own rules
  assets/js/          app.js imports the behaviour modules
public/               images and other files served as-is
apps-script/          the .gs files that back the enquiry forms
tests/
```

**Stylesheet order matters.** `style.css` imports Tailwind first, so
`_general.css` — which comes after it — beats utility classes without needing
`!important` on every rule. Keep that order.

## URLs

Pages are served at trailing-slash paths: `/about/`, `/injectables/`. That is
the shape the practice's previous site used, which lets ten pages keep the
exact address they already rank for. `vercel.json` sets `cleanUrls` and
`trailingSlash` to produce it, and the `clean-urls` plugin in `vite.config.js`
does the same in dev so local and production agree.

`vercel.json` also holds the 301s from the old site's remaining URLs.

## Configuration

Nothing secret lives in this repository. Google credentials stay inside Apps
Script; the values below are public by design and are set per environment.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_SITE_URL` | `https://abcaestheticsllc.com` | absolute host for canonical and Open Graph tags |
| `VITE_GA_ID` | `GT-5TCZ3J3C` | Google Analytics tag. **Set it to empty to switch analytics off** — do that for Vercel Preview so review traffic stays out of the practice's reporting |
| `VITE_APPS_SCRIPT_URL` | see `src/assets/js/site-config.js` | the enquiry form's backend |

Copy `.env.example` to `.env` for local work. On Vercel these go in
Project → Settings → Environment Variables.

## Enquiry forms

The contact and appointment forms post to a Google Apps Script web app, which
writes to a Google Sheet, emails the practice, and sends the enquirer a
confirmation — three independent flows, each separately configurable.

Setup, migration to the practice's own Google account, and the testing
checklist are in **[SETUP-ENQUIRY-FORM.md](SETUP-ENQUIRY-FORM.md)**.

## Content rules

The practice is a medical provider, and the site's copy follows rules agreed
with them:

- no guaranteed outcomes, and no unsupported medical claims;
- no exact medication dosing, injection maps, device settings or fixed
  clinical protocols — those are decided by the treating provider per patient;
- before-and-after photographs only with the patient's authorization.

Keep to these when editing copy, alt text or metadata.
