---
version: 1
slug: "src-app-app-index-tsx"
primary_target: "src/app/(app)/index.tsx"
related_targets: ["src/app/(app)/readings/[id].tsx","src/app/(app)/clubs/[id]/index.tsx","src/app/(app)/shelf.tsx","src/app/(app)/books/edition/[id].tsx"]
---

# Signed-in app (home, reading, club, book, shelf)

Mode: Operate. Readers check in for seconds at a time (log a page, read what others said, leave a thought); club owners occasionally manage. Extension of the incumbent world (warm paper, ink, bookcloth red, Literata), pinned by PRODUCT.md: "warm and bookish… a good reading journal, not a productivity tool". User chose: core loop first, "reading journal" tone, all five critique issues (2026-10-09).

## Direction contract

THESIS: Every screen is a page of a well-kept reading journal. The book's own span is the organizing line: page numbers sit in the margin like marginalia, a bookcloth-red ribbon marks where you are, and the one thing you came to do sits on the page's only raised surface. Refuses the stacked bordered card with an H2 per section.

OWN-WORLD: Paper ground and ink; bookcloth red reserved for the ribbon, "you" and the single primary action per screen. Literata for headings, note text and marginal figures (old-style numerals); small-caps section heads over a hairline rule; system UI face for controls. One raised "desk" surface per screen (soft offset shadow), everything else set flat in type.

STORY: You see where you are in your book, move the ribbon in one step, and read what others marked up to that page; the club page shows who is where against the pace before anything to manage.

FIRST VIEWPORT: Home: current book large (cover, title, ribbon across the book's span, "I'm on page [ ] Save" on the desk). Reading: same header + desk, then notes in the margin layout. Club: book, ribbon rows of who is where with the pace mark, next meeting in one line. Desktop ≥1024px: main column plus a side rail.

FORM: Extension of the established world (no concept roll; code-led, no image generation). Seed key: none (extension).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
