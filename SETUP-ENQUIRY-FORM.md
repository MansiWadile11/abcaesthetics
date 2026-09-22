# Contact form — setup guide

```
Website form  →  Google Apps Script Web App  →  FLOW 1  Google Sheet
                                             →  FLOW 2  webmaster@codevelop.us
                                             →  FLOW 3  patient confirmation
                                             →  /thank-you
```

There is no server, no serverless function and no database. The whole backend
runs inside the practice's own Google account, so when the website moves off
Vercel to its final host **nothing here changes** — the Web App URL stays the
same and the form keeps working.

Setup is about ten minutes. Steps 1–11 below, in order.

> **Currently on a test Google account.** It is not the production account.
> While `CONFIG.ENVIRONMENT` is `"test"` every notification to the practice
> is subject-prefixed `[TEST]`. See
> [Moving from the test account](#moving-from-the-test-account-to-the-practices-account)
> for the switch-over checklist.

---

## The three flows

The backend is deliberately split into three separate flows. Each is its own
file, each can be switched off, tested and changed on its own, and each fails
on its own without taking the others down.

| | Flow | File | If it fails |
|---|---|---|---|
| **1** | Save to Google Sheet | `Flow1_Sheet.gs` | The visitor is told, and **stays on the form**. Flows 2 and 3 are skipped |
| **2** | Email the practice | `Flow2_AdminEmail.gs` | Logged. The visitor still sees success |
| **3** | Confirm to the patient | `Flow3_AutoReply.gs` | Logged. The visitor still sees success |

**Why flow 1 is different.** The thank-you page is a promise that somebody
will call back, and nobody can call back about a row that does not exist. So
if the sheet write fails the enquiry is not stored anywhere, the visitor is
told, and no email is sent — an email would promise a reply to an enquiry
nobody can look up. Once the row *is* written the enquiry is safe, so an email
failure is the practice's problem to fix, not the patient's to read about.

The supporting files are `Config.gs` (everything you edit), `Main.gs` (runs
the three flows in order), `Validation.gs`, `Guards.gs` (duplicates and rate
limiting) and `Setup.gs` (the test functions).

Switch a flow off in `Config.gs` without deleting anything:

```js
FLOWS: {
    SAVE_TO_SHEET: true,
    NOTIFY_ADMIN:  true,
    AUTO_REPLY:    true
},
```

Switching flow 1 **off** is a decision, not a failure — the emails still go
out. Flow 1 being on and *failing* is what stops them.

---

## 1. Create the Google Sheet

Go to [sheets.new](https://sheets.new) and name it something like
**ABC Aesthetics — Enquiries**.

## 2. The column headers

**You do not need to type them.** The script creates the tab, the headings,
the frozen top row and the colouring by itself on the first submission.

For reference, this is what it builds — a tab named `Enquiries`:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Submission Date & Time | Name | Email | Phone | Subject | Message | Source/Page | Status |

Every new enquiry is appended as a new row with **Status = `New`**. Nothing is
ever overwritten. `Status` is yours to work in — change it to `Contacted`,
`Booked` or `Closed` as you go; the script never touches it again.

## 3. Open the script editor

In that sheet: **Extensions → Apps Script**.

Opening it from inside the sheet matters — the script then knows which
spreadsheet it belongs to, and you can skip step 5 entirely.

## 4. Paste the code — eight files

Delete the `function myFunction() {}` stub that is already there.

Then, for each file below: click **+ → Script** in the left sidebar, name it
exactly as shown (Apps Script adds the `.gs` itself), and paste that file's
contents from the `apps-script/` folder of this project.

| Name it | What it is |
|---|---|
| `Config` | **the only file you edit** |
| `Validation` | the rules every flow shares |
| `Guards` | duplicates and rate limiting |
| `Flow1_Sheet` | flow 1 — the Google Sheet |
| `Flow2_AdminEmail` | flow 2 — the practice's email |
| `Flow3_AutoReply` | flow 3 — the patient's confirmation |
| `Main` | runs the three flows in order |
| `Setup` | the test functions you run from the editor |

The first file is easiest to make by renaming the existing `Code` file
(three-dot menu → **Rename**) to `Config`.

Order does not matter — Apps Script joins every file in the project into one
script before running it. Press **save** (Ctrl+S) when they are all in.

> It is more pasting than one big file would be, but each flow is then its own
> file you can read, change or switch off without touching the other two.

## 5. Set the Sheet ID

**If you opened the editor from inside the sheet (step 3), skip this.** Leave
`SHEET_ID: ""` and it uses the sheet it lives in.

Only if you created a standalone script: copy the ID out of the sheet's URL —
the long string between `/d/` and `/edit` —

```
https://docs.google.com/spreadsheets/d/1AbCdEfGh...XyZ/edit
                                       └──── this part ────┘
```

and put it in `Config.gs`:

```js
SHEET_ID: "1AbCdEfGh...XyZ",
```

## 6. Check the admin email

Still in `Config.gs` — the only file you ever need to edit. It is grouped by
flow, so you can see at a glance which setting belongs to which:

```js
SHEET_ID:       "",                            // step 5
SHEET_NAME:     "Enquiries",                   // the tab name
ADMIN_EMAIL:    "webmaster@codevelop.us",      // who gets every enquiry
WEBSITE_NAME:   "ABC Aesthetics & Wellness",   // used in both emails
WEBSITE_URL:    "https://abcaestheticsllc.com",// optional button in the confirmation
PRACTICE_EMAIL: "abcaestheticsllc@gmail.com",  // shown to patients
PRACTICE_PHONE: "971-978-7840",
```

`ADMIN_EMAIL` is already set to `webmaster@codevelop.us`. Change it later by
editing this one line and re-deploying.

## 7. Run `setup` once, and approve the permissions

In the editor's function dropdown (top toolbar) choose **`setup`** and press
**Run**.

This creates the tab and headings, then runs **all three flows** and reports
each one separately in the Execution log:

```
Flow 1  Google Sheet : OK  (row appended)
Flow 2  Admin email  : OK  (sent to webmaster@codevelop.us)
Flow 3  Auto-reply   : OK  (sent to webmaster@codevelop.us)
```

It also triggers Google's authorisation prompt **while you are watching**,
which is much better than having it appear on a patient's first attempt.

If one flow says `FAILED`, you know exactly which to look at — and you can
re-run just that one with `testFlow1_Sheet`, `testFlow2_AdminEmail` or
`testFlow3_AutoReply` from the same dropdown. Flow 1's test writes a row and
sends nothing; the other two send an email and write nothing.

**The prompts you will see, in order:**

1. **"Authorization required"** → click **Review permissions**.
2. Choose the Google account that should own this (whichever account sends the
   emails — the practice's, ideally).
3. **"Google hasn't verified this app"** — this is expected. It appears for
   every private script that isn't published to the Marketplace. Click
   **Advanced**, then **Go to [your project name] (unsafe)**. It is your own
   script; the warning is about unverified *publishers*, not about the code.
4. A list of what it wants: see, edit and create spreadsheets; send email as
   you; connect to an external service. Click **Allow**.

You only do this once. Check the sheet — a "Setup Test" row should be there —
and check for the test email, then delete that row.

## 8. Deploy as a Web App

**Deploy → New deployment**. Click the gear icon beside "Select type" and
choose **Web app**.

| Field | Set it to |
|---|---|
| Description | `Contact form v1` (anything) |
| **Execute as** | **Me (your address)** |
| **Who has access** | **Anyone** |

## 9. Getting the access level right

**"Who has access" must be `Anyone`.** This is the single most common thing to
get wrong.

- `Anyone` — correct. Website visitors are not signed in to Google, so this is
  the only setting that lets them submit.
- `Anyone with Google account` — the form fails for most real patients.
- `Only myself` — the form fails for everyone but you.

"Anyone" does **not** make the sheet public. It makes one URL accept a POST.
The sheet, the emails and the Google account stay private, and the script only
ever appends a row and sends mail — there is nothing to read back out of it.

## 10. Copy the URL into the website

After deploying, Google shows a **Web app URL**:

```
https://script.google.com/macros/s/AKfycbx....................../exec
```

Copy it, and paste it into **one place** —
[`src/assets/js/site-config.js`](src/assets/js/site-config.js):

```js
export const APPS_SCRIPT_URL =
    import.meta.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfyc..../exec"
```

It must end in **`/exec`**. A URL ending `/dev` only works while *you* are
signed in as the script's owner, so the form would fail for every actual
visitor.

Then rebuild and redeploy the website (`npm run build`).

Nothing here is secret — a Web App URL is a public endpoint by design, and the
Google credentials never leave Apps Script.

## 11. Test the whole flow

Submit the contact form on the live site and confirm four things:

1. a new row appears in the sheet, with Status `New`;
2. `webmaster@codevelop.us` receives **New Contact Form Enquiry - [name]**,
   and hitting Reply goes to the patient, not to Google;
3. the address you used receives a confirmation;
4. you land on `/thank-you`.

You can also open the Web App URL directly in a browser — it answers with a
small health check showing the tab name and how many enquiries it holds.

---

## Re-deploying after you change the code

Apps Script keeps serving the **deployed** version, not what is in the editor.
After editing any `.gs` file: **Deploy → Manage deployments → the pencil icon →
Version: New version → Deploy.**

Use *Manage deployments*, not *New deployment* — a new deployment issues a
**new URL**, which would mean updating the website again.

---

## What happens when something goes wrong

| Situation | What the visitor sees |
|---|---|
| Sheet cannot be written | An error with the phone number. **No redirect**, typing kept. No email is sent — it would promise a reply to an enquiry nobody can look up |
| Sheet written, admin email fails | Success. The enquiry is safely recorded; the failure is logged |
| Sheet written, patient confirmation fails | Success. It is a courtesy and never blocks the enquiry |
| Network drops mid-submit | "Please check your connection and try again, or call…". No redirect |
| Script deployed with the wrong access | Treated as a failure, not a success — the visitor gets a usable message |
| Not configured yet | A notice asking them to call or email instead |

The thank-you page is reached **only** after Apps Script confirms it has the
enquiry. Technical detail never reaches a patient; it goes to the Apps Script
log (**Executions** in the editor sidebar).

---

## Spam and abuse protection

All of it is on by default and needs no configuration:

- a **honeypot** field hidden from people — anything in it is dropped silently;
- **URLs rejected in the name field** — never a real enquiry;
- **duplicate suppression** — the same enquiry twice within five minutes is
  recorded once, checked both in cache and against the sheet itself;
- **rate limiting** — 5 per email address per 10 minutes, 40 overall;
- **formula-injection protection** — a message starting `=`, `+`, `-` or `@`
  is stored as text, so Sheets cannot evaluate it;
- **server-side validation** — Apps Script re-checks everything independently.
  Frontend validation is for speed only and is never trusted.

A submit-timing check is deliberately **not** used to reject anything. Browser
autofill fills a form in milliseconds, and silently discarding a real patient
enquiry is far worse than receiving one spam email.

---

## Sending from your own domain

Out of the box the emails go through Google's own mail service, which means
they come **from the Google account that authorised the script** - a Gmail
address, not `@abcaestheticsllc.com` - and there is no way to see whether a
patient's confirmation was delivered, bounced or filtered.

Pointing it at a transactional email provider fixes both. It is a ten-minute
change and nothing else in the system moves: same sheet, same validation, same
website.

### Why an API key and not SMTP

Apps Script has no raw socket access, so it cannot speak SMTP at all.

That matters less than it sounds. Postmark, Resend, SendGrid, Brevo and
Mailgun all give you **SMTP credentials and an HTTP API on the same account** -
same servers, same domain verification, same deliverability, same dashboard.
The API is simply the half Apps Script can reach. You lose nothing.

(A plain mailbox from a web host - cPanel, Hostinger, GoDaddy - offers SMTP
only. Apps Script cannot use those at all; that would need a server.)

### Setting it up

1. **Sign up** with a provider. For a clinic's volume the free tiers are
   ample - Postmark ~100/month, Resend 3,000/month, Brevo 300/day.

2. **Verify the domain.** They give you two or three DNS records for
   `abcaestheticsllc.com` (SPF and DKIM). Add them, then wait - this is the
   slow part, usually an hour or two. Mail sent before they are live will be
   rejected or land in spam.

3. **Store the API key.** In Apps Script: **Project Settings** (the gear icon)
   → **Script properties** → **Add script property**:

   | Property | Value |
   |---|---|
   | `MAIL_API_KEY` | the key from your provider |

   Or run `setMailApiKey()` from Setup.gs, then clear the key from the file.

   **The key never goes in Config.gs.** Script Properties are not part of the
   source, so the eight files stay safe to paste, share and commit.

4. **In `Config.gs`**, set two values:

   ```js
   MAIL_PROVIDER: "postmark",   // or resend | sendgrid | brevo | mailgun
   MAIL_FROM: "ABC Aesthetics & Wellness <noreply@abcaestheticsllc.com>",
   ```

   `MAIL_FROM` must be an address verified with that provider in step 2.
   Mailgun also needs `MAIL_DOMAIN`.

5. **Check before sending.** Run **`checkMailProvider()`** - it reports what is
   configured and what is missing without sending anything.

6. **Send one for real.** Run **`testMailProvider()`**, then look at the
   message that arrives: the **From** address should be your own domain, and
   the message should appear in the provider's dashboard.

7. **Redeploy** so the live form uses it: Deploy → Manage deployments → pencil
   → New version.

### If something is wrong

The safe default is deliberate: with `MAIL_PROVIDER` set but **no key stored**,
sending falls back to Gmail and says so in the log. An enquiry arriving from
the wrong address is better than one that disappears.

| Symptom | Cause |
|---|---|
| Still arriving from Gmail | No key stored, or `MAIL_PROVIDER` still `"gmail"` |
| `422` / `Sender not verified` | `MAIL_FROM` is not verified with the provider |
| `401` / `Unauthorized` | Wrong key, or pasted with whitespace |
| Sends fine, lands in spam | DNS records not live yet - check with the provider |

A rejected email never loses the enquiry. The row is already in the sheet, the
visitor still reaches the Thank You page, and the failure is recorded against
the flow it belongs to.

---

## Limits worth knowing

**Email quota.** Apps Script sends 100 emails/day from a consumer Gmail
account, 1,500/day from Google Workspace. Each enquiry sends two (the practice
and the patient), so a free account covers about 50 enquiries a day. Far above
what a single clinic receives, but worth knowing before a campaign.

**Emails come from the account that deployed the script**, not from a
`noreply@abcaestheticsllc.com` address. If the practice wants patient
confirmations to come from their own domain, deploy the script from a Google
Workspace account on that domain.

---

## Moving from the test account to the practice's account

The current setup runs on a **test Google account**. Everything is arranged so
the move to the practice's Workspace account is a checklist, not a rebuild.

**The one thing that catches people out:** a new Google account means a new
Apps Script project, which means a **new Web App URL**. The old URL keeps
working and keeps writing to the old sheet, so if you forget this step the
form appears fine while every enquiry quietly lands in the test account.

While `ENVIRONMENT` says `"test"`, every notification to the practice is
subject-prefixed **`[TEST]`**, so a development enquiry can never be mistaken
for a real patient. Patients never see it - their confirmation is unmarked,
and nothing is added to the sheet.

### The checklist

1. **Create the sheet on the production account.** Either make a fresh one, or
   open the test sheet and use **File → Make a copy** into the production
   account. Copying keeps the column layout and any test rows - delete those.
   (Transferring *ownership* across organisations is often blocked by Workspace
   admin policy, so copying is usually the quicker route.)
2. **Extensions → Apps Script** from inside the new sheet, and paste the same
   eight files. They are unchanged - nothing in them is tied to an account.
3. **In `Config.gs`, set three things:**
   ```js
   ENVIRONMENT:   "production",          // removes the [TEST] subject prefix
   OWNER_ACCOUNT: "info@abcaestheticsllc.com",   // whichever account this is
   SHEET_ID:      "",                    // leave "" if opened from the sheet
   ```
   `ADMIN_EMAIL`, `PRACTICE_EMAIL`, `PRACTICE_PHONE`, `WEBSITE_NAME` and
   `WEBSITE_URL` almost certainly stay as they are - check them anyway.
4. **Run `setup()`** and approve the permission prompts as the production
   account. All three flows should report OK.
5. **Deploy → New deployment → Web app**, *Execute as* **Me**, *Who has
   access* **Anyone**. Copy the new `/exec` URL.
6. **Paste it into `src/assets/js/site-config.js`** - the single place the
   website stores it - then rebuild and redeploy the website.
7. **Submit the form once on the live site** and confirm the row lands in the
   *production* sheet and the email arrives **without** the `[TEST]` prefix.
8. **Retire the test deployment.** In the test project: **Deploy → Manage
   deployments → Archive**. Leaving it live means a stale URL still accepting
   enquiries into a sheet nobody reads.

### Telling the two apart

Open either Web App URL in a browser. The health check says which account it
belongs to:

```json
{ "ok": true, "environment": "test", "owner": "dev@example.com",
  "sheet": "Enquiries", "rows": 12 }
```

### What does NOT need changing

The eight `.gs` files, the website's form markup, the validation, the sheet
column layout, and `/thank-you`. Only `Config.gs` and the one URL in
`site-config.js` are account-specific - there is a test asserting that no
sheet ID or real email address is hard-coded anywhere else.

---

## Moving to a different host

Only two things are host-specific, and neither is the backend:

1. **`/thank-you`** needs the host to serve `thank-you.html` at an
   extensionless path. On Vercel that is the one rewrite in `vercel.json`. If
   the final host cannot do it, change `THANK_YOU_PATH` in
   `src/assets/js/site-config.js` to `"/thank-you.html"` — the page is
   identical either way.
2. **`vercel.json`** itself, which only sets the build command, the output
   directory and that rewrite. Reproduce those three in the new host's terms.

The Apps Script URL, the sheet, and both emails carry on unchanged.

---

## One thing to decide before launch

The "how can we help" box will collect symptom descriptions and treatments
people are considering, which makes where it is stored a clinical-records
decision, not just a technical one.

Standard consumer Google accounts are **not** covered by a HIPAA business
associate agreement. If Dr. Qneibi wants this data held under a BAA, the
script should be deployed from a **Google Workspace account with a signed
BAA** rather than a personal Gmail account.

Nothing in the code changes either way — same file, same steps, just a
different account doing the deploying. It only needs to be a decision somebody
has made on purpose.

---

## Testing locally

```
npm test           # the Apps Script backend, 192 checks
npm run test:ui    # the browser flow, desktop and mobile, 84 checks
npm run test:routes # every URL serves its own page, 38 checks
npm run dev        # the site at http://localhost:5173
```

`npm test` runs the real `.gs` files under Node with Google's services replaced
by in-memory stand-ins, so validation, sanitisation, formula escaping,
duplicate detection, rate limiting, the sheet layout and both email bodies are
all genuinely executed. `npm run test:ui` drives real browsers against that
same code.

Neither touches the practice's Google account, and neither can prove your
sheet sharing and deployment access are right — only step 11 does that.
