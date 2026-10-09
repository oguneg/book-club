---
name: Bookclub
description: A reading journal you share with your club. Paper, ink, a bookcloth ribbon, and page numbers in the margin.
colors:
  paper: "#F6F0E4"
  paper-raised: "#FBF7EE"
  ink: "#2A2119"
  ink-muted: "#6B5D4F"
  hairline: "#E2D7C3"
  control-edge: "#958676"
  bookcloth: "#8A3B2E"
  on-bookcloth: "#FFFFFF"
  moss: "#3F6B4A"
  madder: "#A2322A"
  paper-dark: "#1B1814"
  paper-raised-dark: "#24201A"
  ink-dark: "#EEE5D5"
  ink-muted-dark: "#B3A693"
  hairline-dark: "#3A332A"
  control-edge-dark: "#766A5C"
  bookcloth-dark: "#D9876F"
  on-bookcloth-dark: "#1B1814"
  moss-dark: "#8DBF96"
  madder-dark: "#E8857C"
typography:
  display:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
  section-head:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "1.4px"
  reading:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  margin-figure:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.1
    fontFeature: "\"onum\""
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.bookcloth}"
    textColor: "{colors.on-bookcloth}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  button-primary-disabled:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  page-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    width: "76px"
    height: "48px"
  text-field:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    height: "48px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  desk:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Bookclub

## Overview

**Creative North Star: "The Reading Journal"**

Every screen is a page of a well-kept reading journal. The book's own span is the organizing line: progress is drawn from the first page to the last with a bookcloth-red ribbon at your place, notes carry their page number in the margin like pencilled marginalia, and a "you are here" rule divides what you've read from what's ahead. The page is set in type, not boxed: small-caps section heads over hairline rules, generous space between sections, and exactly one raised surface (the desk) for the thing you came to do.

It is calm and dense in the way a good book is: one reading column with a narrow side rail on wide screens, warm paper in light, a dark study in dark mode, and nothing that blinks for attention. Color is almost entirely ink on paper; bookcloth red is spent on the ribbon, on "you", and on the single primary action of a screen.

**Key Characteristics:**
- Page numbers and dates live in a 48px margin column, in Literata with old-style figures.
- One raised desk per screen; every other section is flat type over a hairline rule.
- Bookcloth red marks where you are (ribbon, read portion, "you") and the one primary button.
- Literata for headings, note text and figures; the system UI face for controls and metadata.
- Light and dark are both first-class, from the same roles.

## Colors

Ink on warm paper with one bookcloth accent; dark mode is the same roles under lamplight.

### Primary
- **Bookcloth Red** (bookcloth / bookcloth-dark): the ribbon bookmark, the read portion of a book's span, "you" in progress rows, the "you are here" rule, and the one filled button per screen. Text on it uses on-bookcloth.

### Neutral
- **Warm Paper** (paper / paper-dark): the page ground everywhere.
- **Raised Paper** (paper-raised / paper-raised-dark): the desk, text fields, hover rows. Never used to box a whole section.
- **Ink** (ink / ink-dark): body text, titles, note text.
- **Faded Ink** (ink-muted / ink-muted-dark): metadata, section heads, "p." labels, hints. Passes 4.5:1 on paper in both themes.
- **Hairline** (hairline / hairline-dark): decorative rules between sections, cover backdrops, the disabled primary fill.
- **Control Edge** (control-edge / control-edge-dark): the edge of anything you interact with (fields, secondary buttons, chips) and the unread line of a book's span; 3:1 against the page (WCAG 1.4.11).

### Tertiary
- **Moss** (moss / moss-dark): confirmations ("Saved."), always beside a drawn check mark.
- **Madder** (madder / madder-dark): errors and destructive actions, always beside a drawn alert mark.

### Named Rules
**The Ribbon Rule.** Bookcloth red means "where you are" or "the one thing to do here". If a screen has two filled red buttons, one of them is wrong.

**The Two Edges Rule.** Decoration takes the hairline; anything you can press or type into takes the control edge. Never swap them.

## Typography

**Display Font:** Literata (with Georgia, serif)
**Body Font:** the platform UI face (system-ui, -apple-system, Segoe UI, Roboto)

**Character:** Literata carries the book: titles, the readers' own words and the numbers in the margin. The system face carries the machinery, so controls never pretend to be prose.

### Hierarchy
- **Display** (700, 34px, 1.15): page titles: the greeting, a club's name, a page's own name. One per page (the h1).
- **Headline** (700, 26px, 1.2): the book you're in, on home and the reading page.
- **Title** (600, 20px, 1.25): a club's book, the page field's figures.
- **Section head** (600, 14px, uppercase, 1.4px tracking, faded ink): every section over its hairline rule; these are h2s, never labels above another heading.
- **Reading** (400, 16px, 1.6): note bodies and long-form legal/help text; keep lines under about 75 characters.
- **Margin figure** (400, 20px, old-style figures): page numbers beside notes, the day beside a meeting; a 12px "p." or month sits above or below in faded ink.
- **Body** (400, 16px, 1.5) and **Label** (600, 14px): UI text, buttons, metadata.

### Named Rules
**The Marginalia Rule.** Page numbers and dates sit in the 48px left margin, right-aligned, in Literata old-style figures; they are never buried in a metadata line.

**The No-Eyebrow Rule.** No small label above a heading. A section head is the heading; a book title is its own heading.

## Layout

One reading column (max 600px) on phones and narrow windows; from 1024px wide, pages that have a record beside them (home, reading, club) use a main column plus a 320px side rail at 40px gap, inside a 1060px frame. Narrow narrow-form pages (sign-in, settings forms) use a 420px column. The rail always follows the main column on a phone, so the first screen is the main column's: the book, your place, the desk. Section rhythm: 24px between sections, 12px from a rule to its content, 16px page gutters. Covers: 48px (lists), 72px (book headers), 128px (current book, shelf).

## Elevation & Depth

Flat by default, with exactly one lifted surface per screen. Depth comes from the desk's soft, offset shadow and a hairline edge; everything else is separated by rules and space.

### Shadow Vocabulary
- **Desk** (light `0px 1px 2px rgba(42,33,25,0.06), 0px 10px 28px -14px rgba(42,33,25,0.28)`; dark `0px 1px 2px rgba(0,0,0,0.5), 0px 12px 30px -14px rgba(0,0,0,0.7)`): the raised surface for logging your page or writing a note.

### Named Rules
**The One Desk Rule.** A screen has at most one raised surface. If you're reaching for a second card, set it in type with a section head instead.

## Shapes

Gently rounded: 6px for chips and messages, 10px for buttons and fields, 16px for the desk. Book covers keep a 6px radius. Lines are hairlines (1 device pixel) except the read portion of a book's span (3px, round-ended) and progress fills (4px). The ribbon bookmark is a flat notched rectangle (12×26 on the span, 12×22 in the margin).

## Components

### Buttons
- **Shape:** gently rounded (10px), 48px tall, 16px side padding.
- **Primary:** bookcloth fill, on-bookcloth label; one per screen (Save on home and reading, Choose the book when there is none).
- **Disabled:** goes neutral (hairline fill, faded-ink label), never a paler red.
- **Secondary:** raised-paper fill with a control-edge border and an ink label.
- **Quiet actions:** rare or destructive choices (finish, stop, remove, manage) are text buttons in bookcloth or madder, with a confirm step.

### Chips
- **Style:** transparent with a control-edge border, faded-ink label, 40px tall.
- **State:** selected gets a bookcloth border, paper fill and ink label; used for note scopes (tabs) and note audiences (radios).

### Inputs / Fields
- **Style:** raised paper (or paper inside the desk), control-edge border, 10px radius, 48px tall.
- **Focus:** bookcloth border plus a 1px bookcloth ring (no layout shift).
- **Error / Disabled:** madder border and a message with a drawn alert mark below.
- **Page field:** 76px wide, Literata 20px tabular figures, centred, inside the sentence "I'm on page [ ] of 320 · Save".

### Navigation
- A back link at the top of every sub-page: a drawn chevron and the parent's name in bookcloth. Home carries the wordmark and an Account link. Signed-out forms end with Privacy · Terms · Help links. Keyboard focus shows a 2px bookcloth outline at 2px offset on the web.

### Book Span (signature)
The book as a line from its first to its last page: control-edge hairline for the whole, bookcloth for what you've read, a ribbon bookmark at your page that slides there (700ms, cubic-bezier(0.16, 1, 0.3, 1)) when you log, unless reduced motion is on. Meeting targets are short faded-ink ticks; the club's pace is a dashed ink tick. "p. 1" and "p. 320" sit under the ends.

### Marginal Notes (signature)
Each note is a row: the margin figure, then author · audience · time, the note in Literata, and React / Reply / More. Replies indent behind a control-edge hairline. "You are here · p. 142" is a bookcloth rule with the ribbon in the margin; notes past it are blurred (redaction bars on native) until the reader presses "Show note", and that choice holds for the note everywhere it appears until the app closes.

### Note Timeline (signature)
A club's notes as marks along the book, like comments along a track: the book span with your ribbon, and below it a 24px circle per note with the writer's initials (Literata 10px), joined to its place by a short stem. Your own notes take a bookcloth ring; notes past your ribbon are dashed with blurred initials. Marks closer than 28px merge into one with an ink count badge. Hover or focus previews who, where and the first two lines (only "Ahead of where you are · p. N" for notes ahead); a tap opens the mark's notes below the line, still covered until "Show note". Marks are placed by percentage so they render before layout is measured.

## Do's and Don'ts

### Do:
- **Do** give every screen one job on the desk and set everything else as flat sections under small-caps heads.
- **Do** put page numbers, percentages and meeting dates in the margin column, in Literata old-style figures.
- **Do** keep control edges at 3:1 and text at 4.5:1 in both themes; check with axe after changes.
- **Do** draw icons and marks as SVG in the bookcloth/madder/moss roles.

### Don't:
- **Don't** box sections in bordered cards or nest cards.
- **Don't** put a label or eyebrow above a heading.
- **Don't** use a colored side stripe on messages, list items or callouts; messages get a hairline edge and a drawn mark.
- **Don't** use Unicode arrows or emoji as icons (emoji reactions are content, not icons).
- **Don't** spend bookcloth red on more than the ribbon, "you" and one primary action per screen.
