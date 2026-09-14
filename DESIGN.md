---
name: Aviary public landing
description: Public landing page; money assigned to purposes within the existing Aviary identity.
colors:
  ink: "#101112"
  surface: "#1a1c1e"
  line: "#36383b"
  text: "#f8f7f4"
  muted: "#b8babd"
  accent: "#f4501a"
  on-accent: "#1f120a"
  accent-hover: "#ff7543"
  headline-accent: "#ff8459"
  link: "#ff986f"
  tabletop: "#e7ecdd"
  lesson-ink: "#242923"
  envelope-empty: "#f5f7ed"
  rent: "#e7b7fd"
  food: "#b7e7a2"
  savings: "#a5d8ee"
  fun: "#f8cb7b"
  field: "#fff1e5"
  field-ink: "#2b160d"
  dark-button: "#202322"
  white: "#fff"
  light-button: "#fff3e7"
  light-button-ink: "#25150c"
typography:
  display:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "clamp(42px, 5.3vw, 68px)"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "clamp(32px, 3.6vw, 46px)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-.025em"
  body:
    fontFamily: "Nunito, sans-serif"
    fontSize: "17px"
    lineHeight: 1.7
  button:
    fontFamily: "Nunito, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    lineHeight: 1.3
rounded:
  field: "9px"
  button: "12px"
  tabletop: "24px"
  keypad: "32px"
  mobile-tabletop: "19px"
spacing:
  section-top: "96px"
  container-inline: "32px"
  mobile-section-top: "66px"
  mobile-section-inline: "22px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "13px 20px"
  button-dark:
    backgroundColor: "{colors.dark-button}"
    textColor: "{colors.white}"
    rounded: "{rounded.button}"
    padding: "13px 20px"
  button-light:
    backgroundColor: "{colors.light-button}"
    textColor: "{colors.light-button-ink}"
    rounded: "{rounded.button}"
    padding: "13px 20px"
  sample-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.field-ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
---

# Design System: Aviary public landing

## Overview

**Creative North Star: Money at work.** This documents only the public `/` landing page, within `.lp`, preserving Aviary’s orange, Fredoka/Nunito pairing, and animated money workers assigned to envelopes. It establishes no new global app identity and does not govern the signed-in dashboard, mobile app, or legal pages.

The dark page frames a light tabletop where money gains a purpose. Rounded characters make the explanation approachable; clear amounts and explicit actions carry the lesson. Spacious sections then move through expense entry, product evidence, platform choices, trust, questions, and getting started.

Source of truth: `src/landing.css`, `src/views/LandingPage.tsx`, `src/components/landing/MoneyLesson.tsx`, `Playground.tsx`, `LandingClient.tsx`, and `lessonState.ts`. This is an extraction of the implementation, not an additional product feature specification.

## Colors

Orange identifies Aviary and the strongest actions. The hero uses the lighter headline accent, and links use the lighter link orange. Near-black ink, off-white text, muted gray copy, and thin gray dividers establish the reading surface. The pale green tabletop is a distinct teaching surface with dark ink.

Pastels identify named jobs: lilac Rent, green Food, blue Savings, and amber Fun. The matching worker and assigned envelope share their job color. Names, icons, amounts, and assignment captions also convey state; color is not the only cue. The orange expense keypad uses warm pale fields and dark text.

## Typography

Fredoka (`--font-fredoka`, sans-serif fallback) supplies headings, the wordmark, amounts, and keypad digits. Nunito (`--font-nunito`, sans-serif fallback) supplies body copy, labels, controls, and navigation. Preserve these loaded font variables in implementation.

Display and section headings use weight 500 and tight spacing. The wordmark uses 30px/600; story and platform titles use 25px/500. General section body copy is 17px with 1.7 line height and a 610px maximum width. The opening paragraph is 18px/1.55. Controls use weight 800. Lesson amounts use Fredoka at 25–28px; the expense amount uses 64px, reducing to 54px on mobile.

## Layout

The header, opening, lesson wrapper, sections, and footer align to a centered 1200px maximum container. Standard desktop horizontal padding is 32px and section top padding is 96px. The hero places copy beside a 236px action column. The lesson uses four equal envelope columns; the expense section pairs flexible copy with a 380px keypad column and a 90px gap. Other sections use a mix of two-column layouts and simple divided rows. FAQ narrows to 860px.

At 900px and below, gaps and side columns compress; envelope purpose captions disappear. At 640px and below, navigation wraps into its own row, hero actions form two equal columns, envelopes form a 2×2 grid, and expense, benefits, platforms, and trust stack. Standard sections use 66px top and 22px side padding. The lesson wrapper has 12px side padding; its surface uses 14px 16px 0 padding. Waiting workers shrink and lose decorative faces. Hero type becomes `clamp(39px, 8.8vw, 52px)` and section headings become 34px. The keypad stays at most 380px wide.

The header is sticky. Anchor sections use 98px scroll clearance, increasing to 122px on mobile. Do not solve overflow by clipping the entire page.

## Elevation & Depth

Depth comes primarily from contrasting surfaces and borders. The header, editorial rows, and platform sections remain flat. Money workers alone have a small grounding shadow: `0 5px 8px -6px #34412a70`. Avoid expanding this into a general card-shadow system.

## Shapes

Buttons have 12px corners; fields use 9px. The teaching surface and final call to action use 24px corners, reducing to 19px on mobile. The expense keypad uses 32px corners. Envelopes use `9px 9px 17px 17px` corners and outlined empty positions. Workers have a compact rounded body, rupee symbol, face, and feet. These are teaching illustrations, not extra navigation controls.

## Components

### Buttons and navigation

The primary button uses orange with dark ink; outline uses a gray border on the dark page; dark and warm-light variants support colored surfaces. Desktop buttons use 13px 20px padding and at least 48px height. Hover changes background over 160ms ease. Text controls and header app entry use at least 44px height; mobile navigation links are 36px high. The page includes a focus-revealed skip link and named navigation landmarks.

### Money lesson

A worker travels from the waiting area to its envelope through shared-layout motion. The spring uses stiffness 190 and damping 24. Motion starts through direct assignment or the explicit “Show me” control, never on initial load. Guided playback waits 1800ms between assignments and 4800ms for spending/adjustment stages. Pause, Replay, Undo, and Reset remain available. Manual actions stop playback.

The sample begins with ₹1,000 and allocates ₹400 Rent, ₹300 Food, ₹200 Savings, and ₹100 Fun. ₹0 unassigned still means ₹1,000 owned. Spending ₹100 from Food leaves ₹900; moving ₹50 from Fun to Food keeps ₹900 total, Food ₹250, Fun ₹50, and Savings ₹200. These are sample amounts, not a recommended budget. Preserve that distinction and the explicit labels “Still yours,” “Spent,” and “Available.”

Assigned envelope buttons remain focusable with `aria-disabled`, guarded against another assignment. Labels announce the action or available balance, decorative workers are hidden from assistive technology, and an atomic status region reports balances. A no-script explanation carries the same example.

### Expense sample

The orange keypad provides a labeled amount field, note, category selector, numeric buttons, balance, and submission state. It supports exactly one local expense plus undo/reset; nothing is saved to an account. It uses separate starting balances of Food ₹2,000, Travel ₹1,000, and Fun ₹500, not the lesson balances. Preserve explicit sample scope instead of implying it is a working account dashboard.

Amount entry accepts up to two decimals, requires a positive amount and nonempty note, and cannot exceed the selected sample envelope. Inputs lock after submission; undo restores the balance. Error text is associated with the amount input and status feedback is atomic. Fields are at least 44px high, numeric buttons 53px (49px mobile), and submit is 48px high.

### FAQ, product evidence, and optional film

FAQ uses native details/summary disclosures with plus/minus indicators and a shared name for the accordion. Product imagery identifies the actual Android screen. The optional 25-second preview is inside a disclosure, mounts only when opened, has native controls, does not autoplay, and pauses when closed. The preview asset has its audio removed; the player is muted. Keep its visual-description track, readable description, and retry error state.

### Focus and reduced motion

Interactive elements use a 3px blue outline with 5px offset. The lesson uses a darker blue focus outline, and the keypad uses dark ink with 2px offset. Do not remove focus indications. `MotionConfig` honors the user preference; reduced motion disables shared-layout worker travel and sets zero-duration transitions. CSS also removes animation/transitions and uses automatic scrolling under reduced motion. All lesson actions still work without animation.

## Do's and Don'ts

- **Do** preserve the incumbent Aviary identity and restrict these rules to the public landing page.
- **Do** let worker movement explain assignment and visible numbers explain spending and reallocation.
- **Do** keep sample labels, accessible names, keyboard controls, undo/reset, and reduced-motion behavior intact.
- **Do** preserve the distinction between available envelope money, unassigned money, and money spent.
- **Don't** imply assignment spends money or that Savings must be spent.
- **Don't** imply either sample reads or writes an account, or turn its amounts into budget advice.
- **Don't** invent platform availability, financial integrations, privacy promises, or full-app capability for the keypad.
- **Don't** spread the tabletop palette or money-worker motif into the dashboard as a new global identity.
