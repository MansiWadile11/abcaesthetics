# Phase 3 Batch E — the nine treatment pages, reviewed together

**Nothing in this file has been applied.** It is a proposal for the practice
to approve, reject or rewrite. No clinical wording was changed, and none will
be without sign-off.

Measured on the built output of `main` @ `85bf96e`, 14 November 2026.

---

## The headline finding: this is better than it looks

The Phase 3 audit flagged up to 61% overlap between treatment pages. Measured
properly, by word count rather than by n-gram:

| Page | Total words | Shared boilerplate | Unique | % unique |
|---|---|---|---|---|
| `/injectables/` | 1,543 | 213 | 1,330 | **86%** |
| `/hormone-metabolic-wellness/` | 1,168 | 268 | 900 | 77% |
| `/skin-energy/` | 1,139 | 284 | 855 | 75% |
| `/regenerative-aesthetics/` | 1,073 | 284 | 789 | 74% |
| `/hair-restoration/` | 1,034 | 268 | 766 | 74% |
| `/mens-wellness/` | 1,008 | 284 | 724 | 72% |
| `/wellness-products/` | 982 | 284 | 698 | 71% |
| `/sexual-wellness/` | 938 | 284 | 654 | 70% |
| `/womens-wellness/` | 927 | 284 | 643 | 69% |

Every page is **69–86% unique**, and each has substantial original clinical
content. There are **33 H2 headings unique to a single page** against only 4
shared by five or more. This is not thin or duplicated content, and it does
not need rewriting wholesale.

What inflates the similarity score is ~284 words of repeated blocks per page —
and **most of that repetition is either required or deliberate**.

## What is repeated, and whether it should be

17 paragraphs appear on 5 or more of the 9 pages. Sorted by what should
actually happen to them:

### Leave alone — repetition is correct here (≈190 of the 284 words)

| Block | Pages | Why it stays |
|---|---|---|
| **Five patient reviews** ("Came in for Micro-needling…", "A pleasant experience. AMAZING results.", "Great place for friendly honest superior service.", "Nawal was great!…", "Had a great experience…") | 9/9 | Authorised patient quotes. Must not be edited, paraphrased or rotated per page — they are attributable statements, not copy. |
| **Safety paragraph** ("Patient safety and appropriate clinical assessment are fundamental… risks and side effects, which are discussed…") | 9/9 | A required disclosure. It should be identical everywhere; varying legal text per page is a liability, not an SEO win. |
| "Goals are discussed and agreed at consultation. Individual results vary." | 9/9 | Individualisation disclaimer. Same reasoning. |
| "Product and treatment selection is individualized following consultation and clinical assessment." | 9/9 | Same. |
| Footer copyright and practice strapline | 9/9 | Site chrome. |

### Worth differentiating — the genuinely generic ~95 words

These four are the "How your treatment works" steps, and they say the same
thing on 8 of 9 pages while describing visibly different procedures:

| Current text | Pages |
|---|---|
| "A discussion of your goals and concerns, with clinical assessment and review of your medical history." | 6/9 |
| "Treatment selection and sequencing are planned around your goals and explained before proceeding." | 8/9 |
| "Your treatment is carried out by Dr. Qneibi in a professional, private, patient-centered setting." | 8/9 |
| "You receive aftercare guidance specific to your treatment, and any follow-up is discussed individually." | 8/9 |

Plus the shared CTA line, "Book a consultation and Dr. Qneibi will discuss the
options appropriate for your goals." (8/9).

**Proposal.** Keep the four-step structure and the step titles. Replace only
the step *body* on each page with one sentence describing what that step
actually involves **for that treatment** — the assessment for hair restoration
is not the assessment for injectables, and the aftercare for microneedling is
not the aftercare for hormone therapy.

**This needs the practice to write it, not me.** Each sentence is a clinical
statement about what happens during a specific treatment. I can draft
structure and placeholders; the practice supplies the content. Nothing here
should be invented to fill a template.

### Shared headings

| Heading | Pages |
|---|---|
| "A practice committed to you" | 9/9 |
| "How your treatment works" | 9/9 |
| "Have a question?" | 9/9 |
| "Want to schedule an appointment?" | 8/9 |

**Proposal, optional and low priority.** "How your treatment works" could
become "How your [treatment] works" — e.g. "How your hair restoration plan
works". That is a mechanical substitution using each page's existing H1 noun,
with no new claims, and it sharpens the topical signal at near-zero risk. The
other three are navigational furniture and are fine repeated.

## The pages that actually compete with each other

Similarity is not evenly spread. The top pairs:

| Pair | 5-gram overlap |
|---|---|
| `/womens-wellness/` vs `/mens-wellness/` | **58.1%** |
| `/womens-wellness/` vs `/sexual-wellness/` | **56.6%** |
| `/mens-wellness/` vs `/sexual-wellness/` | **52.9%** |
| `/sexual-wellness/` vs `/wellness-products/` | 47.9% |
| median across all 36 pairs | 41.3% |

Three pages — women's, men's and sexual wellness — genuinely overlap in
subject matter as well as in boilerplate, and all three mention sexual
wellness. They are the only pages at real risk of Google picking one to
represent the group.

**Proposal.** Address these three first and leave the other six alone. The
question for the practice is an editorial one: **should sexual wellness be its
own page, or a section within the men's and women's pages?** If it stays
separate, each of the three needs a clear statement of who it is for and what
it covers that the others do not. That is a positioning decision, not a
copywriting task.

## Suggested order, if approved

1. **Differentiate the three wellness pages.** Highest impact; needs the
   practice's editorial decision first.
2. **Per-treatment step descriptions** on all nine. Mechanical to implement
   once the practice supplies the sentences.
3. **"How your [treatment] works" headings.** Lowest risk, smallest gain; can
   ship without new copy.

## What I did not do, and why

- **No clinical wording was changed.** Every sentence about what a treatment
  is, does or involves is untouched.
- **No outcomes, benefits, credentials or medical claims were invented.** The
  gaps above are left as gaps for the practice to fill.
- **No reviews were edited, rotated or rewritten.**
- **No required disclosure was varied** to reduce a similarity score.
