# Phase 3 — what the practice needs to confirm

Everything in this file blocks work that is otherwise ready to ship. Nothing
here has been guessed at, and no placeholder has been published.

Last updated: 14 November 2026.

---

## 1. The postcode — blocks LocalBusiness schema

**Status: blocking. This is the single highest-value outstanding item.**

The site publishes the address as **16240 Parker Road, Lake Oswego, Oregon** in
the footer of all 28 pages and on the contact page. A five-digit postcode
appears **nowhere on the site** — I checked all 28 built pages and the whole
repository.

Schema.org `PostalAddress` wants `postalCode`, and a `LocalBusiness` whose
address cannot be completed is worse than none: it competes with the Google
Business Profile entry that does have one, and a half-written address is
exactly how NAP consistency breaks across directories.

So `LocalBusiness` / `MedicalBusiness` markup is **written but withheld**.
Organization, WebSite, BreadcrumbList and Article shipped without it.

**Question: what is the full postcode?** (Lake Oswego is 97034 / 97035, but
which one applies to 16240 Parker Road is not something to infer.)

Everything else that node needs is already confirmed and in hand:

| Field | Value | Source |
|---|---|---|
| `name` | ABC Aesthetics & Wellness | footer, all 28 pages |
| `legalName` | ABC Aesthetics LLC | privacy policy, terms, partners |
| `streetAddress` | 16240 Parker Road | footer, contact |
| `addressLocality` | Lake Oswego | footer, contact |
| `addressRegion` | OR | footer, contact |
| `telephone` | 971-978-7840 | footer, all 28 pages |
| `email` | info@abcaestheticsllc.com | footer, all 28 pages |
| `openingHours` | Mon–Fri 09:00–18:00, Sat–Sun 10:00–18:00 | footer, /about/, /contact/ — consistent in all three |
| `founder` | Dr. Nawal M. Qneibi, DNP-BC | /about/ |
| `foundingDate` | 2023 | /about/ |

## 2. Suite or unit number

The address has no suite, unit or floor anywhere on the site. **Is there one?**
If the practice is inside a larger building, directories and map listings
generally expect it, and leaving it out can split the listing.

If there genuinely is no suite, say so and this closes — it is not a defect.

## 3. Business hours — confirm, do not change

Hours **are** published, consistently, in three places:

> Monday – Friday 9:00 AM – 6:00 PM
> Saturday – Sunday 10:00 AM – 6:00 PM
> By Appointment Only

(The /about/ page adds: "Hours may be updated as the practice schedule changes.")

No change has been made to them. **Please confirm these are still correct**
before they are published as `openingHoursSpecification`, since schema hours
feed Google's "open now" display and a stale value there is worse than none.

Also worth deciding: **"By appointment only" alongside fixed hours is
ambiguous to a machine.** Should the hours be published as bookable windows,
or should the markup say appointment-only and omit the ranges?

## 4. Patient reviews — Review / AggregateRating markup

The site carries 26 patient reviews, and five of them appear on every
treatment page. **None of it has been marked up as `Review` or
`AggregateRating`, and none will be without written authorisation.**

Two separate questions:

1. Are the reviews authorised for republication as structured data?
2. Is the practice comfortable with review snippets appearing in search
   results for a medical practice? This is a compliance judgement, not a
   technical one — review rich results for health services attract scrutiny,
   and Google requires that marked-up reviews be genuine, attributable and
   collected without incentive.

Until both are answered in writing, the reviews stay as visible page content
only, which is where they are now.

## 5. Credentials and medical specialties for schema

The only credential the site states is **DNP-BC** (Doctor of Nursing Practice,
Board Certified), on /about/ and in several page titles. The Organization
markup now carries exactly that and nothing more.

If `MedicalBusiness` is added later it accepts `medicalSpecialty`, and the
practice should supply the **exact wording** it wants used, rather than having
it inferred from the treatment page names. Schema.org's `MedicalSpecialty`
enumeration is a fixed list (Dermatology, PlasticSurgery, and so on) and none
of its values should be claimed without the practice confirming it applies.

## 6. Two smaller confirmations for the llms.txt draft

The draft at `docs/llms.txt.draft` is ready but unpublished. Two lines need a
decision:

1. **The one-sentence practice description** is the only sentence in that file
   assembled rather than quoted from the site. Please approve or rewrite it.
2. **Booking route.** Should AI assistants be pointed at
   `/book-appointment/` (the practice's own form) or at the Jane booking site
   as the primary route? The draft currently lists the on-site form.

---

## Already answered — no action needed

- **Brand name**: ABC Aesthetics & Wellness, with ABC Aesthetics LLC retained
  for legal references only. Confirmed and shipped.
- **`/book-appointment/`**: kept, indexable, and now linked from ten pages
  while Jane remains the primary booking route. Shipped in Batch B.
