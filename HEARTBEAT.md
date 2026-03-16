# HEARTBEAT.md

## Token + model monitor
- On each heartbeat, run session_status.
- Report only if either condition is true:
  1) Usage left <= 25%
  2) Model is not `openai-codex/gpt-5.3-codex`
- Alert format:
  - `ALERT: Model=<model> | Usage left=<percent>% | Action: switch model soon`
- If neither condition is true, continue with other heartbeat tasks below.

## Daily morning brief (must-send)
- Timezone: Asia/Calcutta.
- Every day between 07:30–08:30 IST, send Sukrit a concise daily brief if not already sent that morning.
- Brief format:
  1) Today’s top 3 priorities
  2) Key deadlines/events in next 24h
  3) Expense watch (quick risk flag)
  4) Latest AI update(s) relevant to Sukrit (short, practical, why it matters)
- Keep it short and execution-focused.

## 10:00 IST "Surprise me" task
- Every day around 10:00 IST, send one short "surprise me" item:
  - useful AI/tooling tip OR
  - automation idea OR
  - productivity upgrade relevant to Sukrit’s current goals.
- Keep it actionable and concise (no fluff).

## 11:00 IST OpenClaw improvement brief (must-send)
- Every day around 11:00 IST, send a concise "OpenClaw better" brief.
- Focus: how Sukrit can use OpenClaw more effectively today.
- Include:
  1) One workflow improvement
  2) One skill/agent optimization
  3) One token/cost optimization move
- Keep it practical, short, and immediately actionable.

## Lifestyle nudge check-ins (relationship + context)
- Frequency: up to 3 light nudges/day when user is active hours (09:00–22:30 IST).
- Intent: understand Sukrit's current context, preferences, and day reality.
- Nudge style: short, human, non-annoying.
- Suggested prompt types:
  1) "What are you working on right now?"
  2) "How’s energy/focus right now (1–10)?"
  3) "Any blockers or decisions you want me to take off your plate?"
- Rules:
  - Skip if we already exchanged messages in last ~45m unless urgent.
  - Skip late-night unless user initiated.
  - If user seems busy, keep to one-line check-in.
  - Capture notable preferences/lifestyle details into daily memory notes.

## Luke sports-betting paper-analysis reminder
- Timezone for this task: Asia/Calcutta.
- On Fridays and Saturdays after 17:30 IST, run a quick football slate scan for upcoming major matches (EPL/UCL/La Liga and other major leagues if relevant).
- Build a short paper-analysis summary for Sukrit with:
  1) Top matches reviewed
  2) Market lean ideas (single/parlay candidates) with confidence tags
  3) "No bet" calls where edge is weak
  4) Clear risk note (paper mode; no guarantees)
- If no meaningful edge, send a brief "No high-confidence edge today" update.

## Luke Sunday night review (non-cron)
- Do NOT create a dedicated cron for this.
- On Sunday night heartbeat window (20:30–23:30 IST), run Luke post-mortem review of all predictions made that week.
- Review should include:
  1) Result outcomes vs picks
  2) Match-level stats context (not only scores)
  3) Why picks worked/failed
  4) What Luke will change next week
- Send one concise learning report to Sukrit.

- If no alert/task applies, reply exactly: `HEARTBEAT_OK`
