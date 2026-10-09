---
name: Bookclub
description: A reading journal you share with your club. Paper, ink, a bookcloth line through the book, and everything one tap away.
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
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.md}"
    width: "140px"
    height: "64px"
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
  segmented:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "12px"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "22px"
    size: "44px"
  fab:
    backgroundColor: "{colors.bookcloth}"
    textColor: "{colors.on-bookcloth}"
    typography: "{typography.body}"
    rounded: "26px"
    padding: "0 18px"
    height: "52px"
  sheet:
    backgroundColor: "{colors.paper-raised}"
    rounded: "20px"
    padding: "0 16px 16px"
    width: "480px"
  tab-bar:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink-muted}"
    height: "64px"
    width: "220px"
---

# Design System: Bookclub

## Overview

**Creative North Star: "The Reading Journal, one tap deep"**

Every screen is a page of a well-kept reading journal, and every common job is one tap from it. Three places live in the tab bar: **My books** (what you're reading, each one tap from an update; what you want to read; what you've read), **Clubs**, and **You**. The book itself is the organizing line: first page to last, bookcloth red for what you've read, the faces of your club above it and note bubbles below it, like comments along a track. Updating your page, writing a note and reading the notes at a place each open a sheet over the page and close back to it; nothing sends you to another screen to do the everyday things.

It stays calm and quiet: warm paper in light, a dark study in dark mode, ink for almost everything, bookcloth red spent on "you", the read part of the line and the screen's main action. Rare actions (finish, stop, edit pages, owner tools) wait behind a ⋯ or a gear, never on the page.

**Key Characteristics:**
- A tab bar with icons and labels (My books · Clubs · You) on phones; the same three as a slim sidebar from 1024px.
- My books: Reading · Want to read · Read. Each book you're reading is a card with its progress and its own "Update page", so several books are one tap each.
- One page per book: the book line (your ribbon, your club's faces, the notes) on your own reading, with the club as a layer, not a second page.
- Start opens on "Where are you?"; finishing opens a quiet ending with Undo; a new club is three short steps.
- Everyday jobs in sheets: Update page (with +5 / +10 / +25), + Note (one box and who sees it), notes at a place.
- One floating "+ Note" button wherever you can write; one filled button per screen.
- Literata for titles, note text and figures; the system UI face for controls and metadata. Lucide line icons.
- Light and dark are both first-class, from the same roles.

## Colors

Ink on warm paper with one bookcloth accent; dark mode is the same roles under lamplight.

### Primary
- **Bookcloth Red** (bookcloth / bookcloth-dark): the read part of the book line, your face and your note rings, the active tab, the floating note button and the one filled button per screen. Text and icons on it use on-bookcloth.

### Neutral
- **Warm Paper** (paper / paper-dark): the page ground everywhere, and the track of a segmented control.
- **Raised Paper** (paper-raised / paper-raised-dark): sheets, the tab bar, text fields, the selected segment, note bubbles and faces on the line.
- **Ink** (ink / ink-dark): body text, titles, note text, count badges.
- **Faded Ink** (ink-muted / ink-muted-dark): metadata, inactive tabs and segments, hints, "p." labels. Passes 4.5:1 on paper and raised paper in both themes.
- **Hairline** (hairline / hairline-dark): decorative rules, the sheet's grabber, the tab bar's edge, segmented track borders.
- **Control Edge** (control-edge / control-edge-dark): the edge of anything you press or type into (fields, secondary buttons, bubbles, the selected segment) and the unread part of the book line; 3:1 against the page (WCAG 1.4.11).

### Tertiary
- **Moss** (moss / moss-dark): confirmations ("Saved."), always beside a drawn check mark.
- **Madder** (madder / madder-dark): errors and destructive actions, always beside a drawn alert mark.

### Named Rules
**The Ribbon Rule.** Bookcloth red means "you" or "the one thing to do here". If a screen has two filled red buttons, one of them is wrong (the floating "+ Note" counts as the screen's one when it is there).

**The Two Edges Rule.** Decoration takes the hairline; anything you can press or type into takes the control edge. Never swap them.

## Typography

**Display Font:** Literata (with Georgia, serif)
**Body Font:** the platform UI face (system-ui, -apple-system, Segoe UI, Roboto)

**Character:** Literata carries the book: titles, the readers' own words and the numbers. The system face carries the machinery, so controls never pretend to be prose.

### Hierarchy
- **Display** (700, 34px, 1.15): page titles (a club's name, "What are you reading?") and the page figure in the Update page sheet. One h1 per page.
- **Headline** (700, 26px, 1.2): the book on a reading's own page.
- **Title** (600, 20px, 1.25): sheet titles ("Where are you?", "Note at p. 178"), a club's book.
- **Section head** (600, 14px, uppercase, 1.4px tracking, faded ink): sections of form-like pages (account, club settings, moderation, an edition) over a hairline rule; these are h2s.
- **Reading** (400, 16px, 1.6): note bodies and long-form legal/help text; keep lines under about 75 characters.
- **Margin figure** (400, 20px, old-style figures): page numbers beside notes in a list, the day beside a meeting.
- **Body** (400, 16px, 1.5) and **Label** (600, 14px): UI text, buttons, segments, metadata. Tab labels are 12px / 600.

### Named Rules
**The One-Line Rule.** Copy says one thing in one line: "Page 178 of 320 · 56%", "You: p. 178 · 4 pages ahead of pace". If a control needs a second line to explain it, the control is wrong.

**The No-Eyebrow Rule.** No small label above a heading.

## Layout

One reading column (max 600px), 16px gutters, centred in whatever space the navigation leaves. Phones: the tab bar sits at the bottom (64px, icon over label) and the floating "+ Note" button rides 16px above the bottom, aligned to the column's right edge. From 1024px: the tabs become a 220px sidebar (icon beside label, the active one in a soft bookcloth pill), the column stays 600px, and sheets open as a centred 480px dialog. Detail pages (a reading, a club, a book) open over the tabs with a back link at the top. Section rhythm: 24px between sections, 12px within. Covers: 48px (lists), 72px (headers), 128px (a book's own page).

## Elevation & Depth

Flat pages; things that are temporary float. A sheet rises over a 40% ink scrim with the soft sheet shadow; the floating note button carries a short, tight shadow so it reads as pressable over scrolling text. Nothing else is raised.

### Shadow Vocabulary
- **Sheet** (light `0px 1px 2px rgba(42,33,25,0.06), 0px 10px 28px -14px rgba(42,33,25,0.28)`; dark `0px 1px 2px rgba(0,0,0,0.5), 0px 12px 30px -14px rgba(0,0,0,0.7)`): bottom sheets, wide-screen dialogs, the note preview on hover.
- **Float** (`0px 2px 4px rgba(0,0,0,0.16), 0px 10px 24px -8px rgba(0,0,0,0.35)`): the floating "+ Note" button.

### Named Rules
**The One Task Rule.** A sheet does one job and closes back to the page: Escape, the scrim and the × all close it. If a sheet needs a second sheet, the first was doing two jobs.

## Shapes

Gently rounded: 6px for chips and messages, 10px for buttons, fields and segments, 12px for a segmented track, 20px for a sheet's top corners (all four on a wide dialog). Round things are people and notes: faces (28px) and note bubbles (26px) on the line, the 44px icon buttons, the pill-shaped floating button. Lines are hairlines except the read part of the book line (3px, round-ended). Icons are Lucide outlines at 1.75 stroke (2 on small marks and on red).

## Components

### Buttons
- **Primary:** bookcloth fill, on-bookcloth label, 48px tall, 10px radius; one per screen ("Update page", "Start reading", "Post").
- **Disabled:** goes neutral (hairline fill, faded-ink label), never a paler red.
- **Secondary:** raised-paper fill with a control-edge border and an ink label (+5 / +10 / +25, "I have another edition").
- **Icon button:** 44px round, a 20px Lucide icon in ink (⋯, gear, invite, ×); always has a label for screen readers.
- **Quiet actions:** rare or destructive choices (finish, stop, remove) are text buttons in a menu sheet, with a confirm step.

### Floating note button
Bookcloth pill, 52px tall, a plus and "Note" in on-bookcloth, at the bottom right of the column. Shown wherever you can write (your reading, a club whose book you're reading).

### Sheets
A bottom sheet on phones (grabber, title in Literata 20px, ×, scrolling content, safe-area padding) and a centred 480px dialog from 1024px. The Modal is the dialog and carries the title as its name. Used for: Update page (with "I'm just starting" before the first log), + Note, the notes at a place on the line, the book's ⋯ menu, inviting to a club, and the ending.

### One page per book
Each book has one page: yours. When your club is reading it, the club is a layer on that page, not a second page: faces on the line, a club strip under it (a row with the club's name and "Next: Fri, Oct 16, 6:30 PM · read to p. 120", opening the club), and a Club · Everyone switch on the notes (Club first). The club page is the book with one "Open the book" (or "Start reading the book"), who's where (furthest first, the pace on top), meetings (upcoming first), and invite; no second notes feed, Update page or "+ Note".

### Starting and finishing
Starting a book opens it on its own page with "Where are you?" already up. Finishing needs no confirming: it opens a quiet ending sheet ("You finished The Hobbit"; how many notes from other readers are open now; "Leave a last thought"; "Read the notes"; "Next up" from Want to read with Start reading), and "Not finished yet? Undo" puts you back on the page you were on.

### Setting up a club
A new club is three short steps after its name, with a three-bar progress mark under the heading and "Skip for now" on each: which book first (choosing it starts the owner's own reading too), when everyone should finish (a date sets the pace), and invite (copy the link or read out the code). Club settings group "This book" and "Club".

### Segmented control
Two to four choices in one row: a paper track with a hairline edge, the selected segment raised paper with a control edge and a soft shadow, labels 14px / 600. As tabs (a club's Notes · Meetings · Members, with `aria-selected`) or radios (who sees a note: Club · Everyone · Only me, with `aria-checked`).

### Inputs / Fields
- **Style:** raised paper, control-edge border, 10px radius, 48px tall.
- **Focus:** bookcloth border plus a 1px bookcloth ring (no layout shift).
- **Error / Disabled:** madder border and a message with a drawn alert mark below.
- **Page field:** 140px wide, Literata 34px tabular figures, centred, between "Page" and "of 320" in the Update page sheet.

### Navigation
- **Tabs:** My books (books on a shelf), Clubs (people), You (person in a circle); active in bookcloth, inactive in faded ink; wrapped in a navigation landmark.
- **Rows:** lists of places (clubs, account, help) are rows with an icon or cover, a title, one line of detail and a chevron, 56px tall.
- **Back link:** a chevron and the parent's name in bookcloth at the top of every detail page.
- Keyboard focus shows a 2px bookcloth outline at 2px offset on the web.

### Book Line (signature)
The book as one line from its first to its last page: control-edge hairline for the whole, bookcloth for what you've read. A ribbon bookmark always marks your page, alone or in a club, so you are never merged with anyone else. The rest of your club are faces: 28px raised-paper circles with 11px initials, lifted 26px above the line on a stem so they clear the ribbon. Below the line, a 26px note bubble (a speech-bubble icon) per place, tied to it by a short stem; your own notes take a bookcloth ring, and notes past your place are dashed and faded. Faces or bubbles closer than 30px merge into one with a count: filled ink for notes, outlined for people, and a merged face announces each person with their own position. Under the line, one plain sentence says where everyone is in your own pages ("Sam ≈26 pages ahead · Lena ≈127 behind"). The club's pace is a dashed ink tick, keyed by "On pace today: p. 68" with the same dash. Hover or focus previews who, where and the first two lines (only "Ahead of where you are" for notes ahead); a tap opens that place's notes in a sheet, still covered until "Show note". Everything is placed by percentage so it renders before layout is measured.

### Sections
Form-like pages (account, club settings, moderation) are set in type, not boxed: a section head over a hairline rule, 12px to its content, 24px between sections.

### Notes
Each note in a list: the page in the margin, then author · audience · time, the note in Literata, and React / Reply / More. Notes past your place are blurred (redaction bars on native) until you press "Show note", and that choice holds for the note everywhere it appears until the app closes.

## Do's and Don'ts

### Do:
- **Do** put the everyday job one tap from the page: a sheet, not a new screen.
- **Do** keep rare and owner actions behind ⋯ or the gear.
- **Do** say it in one line; numbers in Literata, tabular where they change.
- **Do** keep control edges at 3:1 and text at 4.5:1 in both themes; check with axe at 375px and 1280px, with sheets open.
- **Do** expose state with `aria-selected`, `aria-checked`, `aria-busy` and `aria-disabled` (react-native-web ignores `accessibilityState` except `disabled`).

### Don't:
- **Don't** box whole sections or nest cards; a card holds one thing you can look up or open (the next meeting, a club row).
- **Don't** add a second filled red button beside the floating one.
- **Don't** stack sheets, or put a form in a sheet whose button needs scrolling to reach on a phone.
- **Don't** use Unicode arrows or emoji as icons (emoji reactions are content, not icons).
- **Don't** use a colored side stripe on messages, list items or callouts.
