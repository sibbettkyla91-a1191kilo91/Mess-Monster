# 🧟 Mess Monster — Master Project Document

_Last updated: May 17, 2026 | Maintained by: Kilo (Kyla Sibbett)_
_This document is the single source of truth for Mess Monster. Share it with any AI assistant (Claude, Manus, Gemini, Claude Code) to bring them up to speed._

---

## 📌 Project Overview

**Mess Monster** is an Android cleaning motivation app where real-world cleaning keeps a customizable virtual pet — a "mess monster" — alive and happy. The dirtier the house gets, the worse your monster feels. Clean something, and your monster thrives.

It's a gamified cleaning coach designed for people who struggle with motivation, executive dysfunction, overwhelm, or just need a reason to start.

**Platform:** Android (Google Play — first launch target)
**Built With:** React Native via Expo
**Business Model:** Freemium (~$4.99/month premium)
**Status:** Core game loop + onboarding screen built and committed. Ready for next feature build.

---

## 🎯 Core Concept & Mechanic

- Your virtual pet (a mess monster) is directly tied to the cleanliness of your home
- The player logs cleaning tasks → earns points → uses points to care for their monster
- Neglect tasks → monster gets sad, sick, or messy
- Clean consistently → monster thrives, levels up, unlocks items
- Real-world cleaning = in-app progress (two-layer anti-cheat planned — see below)

**The emotional hook:** You're not cleaning for yourself (that's hard). You're cleaning _for your monster_ (that's easier).

---

## ✨ Features

### Free Tier

- Virtual pet (mess monster) with mood states (thriving, happy, sad, sick, messy)
- Step-by-step cleaning coach (breaks tasks into small, doable steps)
- Points system for completing cleaning tasks
- Basic points store (pet care items)
- Name randomizer for your monster
- Royalty-free background music

### Premium Tier (~$4.99/month)

- Spotify integration for background music
- Additional monster customization options
- Expanded points store inventory
- AR "Scan to Feed" feature (v2 — doubles as premium anti-cheat)
- _(Additional premium features TBD)_

---

## 🧟 Mascots & Characters

### Nilly _(Kilo's personal monster, primary mascot)_

- **Vibe:** Mint green, kawaii, soft and cute
- **Personality:** Sweet, encouraging, a little goofy
- **Role:** Primary mascot, face of the app
- **Design:** Approved via Leonardo AI
- **Status in app:** Implemented (using placeholder image — real artwork pending)

### Luna _(secondary mascot)_

- **Vibe:** Dark witchy aesthetic — black, red, and gold
- **Personality:** Mysterious, moody, dramatically unbothered
- **Role:** Alternate monster choice (pick-one at first launch)
- **Design:** Approved via Leonardo AI
- **Status in app:** Implemented in onboarding (using placeholder image — real artwork pending)

> 💡 _Mascot artwork finalized. Both Nilly and Luna designs approved. In-app, the user picks ONE monster at first launch — they don't share a screen except in marketing materials._

---

## 🎬 Onboarding Flow

1. **First launch** → user sees a "Choose Your Monster" screen
2. **Two sides:** Nilly (mint green styling) vs. Luna (dark purple/black + red styling)
3. **User taps one** → selection saved to player store, screen never shown again
4. **User names their monster** (with optional randomizer)
5. **Theme assignment:** App color palette + tone adapts to which monster was chosen
6. **Drop into main app** → start logging cleaning tasks

**Status:** ✅ Built and committed (May 12). Placeholder images currently — real artwork pending. Needs phone preview test.

---

## 🧪 Mess Evolution System _(monster state mechanic)_

The monster's appearance evolves based on the _type_ of mess being ignored — not just how long it's been since cleaning. This makes the visual feedback feel intuitive and personal.

**Currently implemented mood states (auto-derived from time since last care):**

- **Thriving** — recent cleaning, monster glowing/happy
- **Happy** — doing well, recent activity
- **Sad** — neglected for moderate time
- **Sick** — neglected for too long
- **Messy** — combined state when multiple task types ignored

**Visual feedback:**

- Mint green tones when monster is happy/thriving (Nilly)
- Red tones when monster is sad/sick (Nilly)
- Luna's palette inverts this with her dark/red/gold scheme

**Future expansion:** The _type_ of mess ignored could change the monster's appearance differently (e.g., dishes-neglected monster looks different from laundry-neglected monster). This is a planned v1.5 / v2 enhancement.

---

## 🛡️ Anti-Cheat System _(planned — not yet built)_

A two-layer system designed to verify real-world cleaning without being annoying:

1. **Time locks** (free tier) — Tasks have a minimum realistic completion time. Tapping a task too quickly flags it.
2. **Photo spot checks** (premium) — Occasional optional photo verification for points multipliers or special rewards.

**Future v2 option:** AR "Scan to Feed" — point your phone at the cleaned area and the monster "eats" the mess. Doubles as anti-cheat and a magical premium feature.

---

## 🔔 Push Notification Strategy _(planned — not yet built)_

Escalation cadence, themed to match the chosen monster's voice:

- **Gentle reminders** → "Nilly's getting bored 💚"
- **More urgent** → "Nilly hasn't eaten in a while 🥺"
- **Last resort** → "Nilly is feeling really sick 😢"
- Luna's notifications use her moody/dramatic voice instead

Tone stays warm and never shame-based. User can adjust frequency.

---

## 🛠️ Tech Stack

| Layer                  | Tool                                          | Status                |
| ---------------------- | --------------------------------------------- | --------------------- |
| Framework              | React Native                                  | ✅ Installed          |
| Build System           | Expo                                          | ✅ Scaffolded         |
| Target Platform        | Android (Google Play)                         | —                     |
| Node.js                | v24.15.0                                      | ✅ Installed          |
| npm                    | 11.12.1                                       | ✅ Installed          |
| State management       | Zustand                                       | ✅ Installed          |
| Local persistence      | AsyncStorage                                  | ✅ Installed          |
| Project location       | `C:\Users\kylas\mess-monster`                 | ✅ Created            |
| AI build partner       | Claude Code                                   | ✅ Authenticated      |
| Phone preview          | Expo Go (Android)                             | ✅ Installed + tested |
| AI planning partner    | Claude (this project) + Gemini (second brain) | ✅ Active             |
| Autonomous agent (new) | Manus                                         | 🆕 Being added        |
| Asset creation         | Leonardo AI                                   | ✅ Mascot art done    |
| Music (free)           | Royalty-free library TBD                      | ⬜                    |
| Music (premium)        | Spotify integration                           | ⬜                    |

---

## 🏗️ Dev Status & Build Log _(as of May 17, 2026)_

### ✅ Completed

| Milestone                                                     | Date    |
| ------------------------------------------------------------- | ------- |
| App concept finalized                                         | Earlier |
| Core mechanic defined                                         | Earlier |
| Mascot designs approved (Nilly + Luna)                        | Earlier |
| Master project doc created                                    | Earlier |
| Master doc merged with Gemini second-brain notes              | May 8   |
| Node.js + npm installed                                       | May 9   |
| PowerShell execution policy set (RemoteSigned)                | May 9   |
| Expo project scaffolded (`mess-monster` folder, 911 packages) | May 9   |
| Expo Go installed on Android phone                            | May 9   |
| First app preview on phone (blank scaffold)                   | May 9   |
| Claude Code installed + authenticated                         | May 11  |
| Data layer built (Zustand + AsyncStorage)                     | May 11  |
| Pet mood system (5 states, auto-derived from time since care) | May 11  |
| Task history with AsyncStorage persistence                    | May 11  |
| Points system (earn, spend, streak tracking)                  | May 11  |
| Nilly's pet screen (5 mood states, color feedback)            | May 11  |
| Task logging screen (8-10 preset tasks across categories)     | May 11  |
| Core game loop end-to-end (check task → points → mood update) | May 11  |
| App preview confirmed working on phone                        | May 12  |
| Luna design decision: pick-one at first launch                | May 12  |
| Monster selection / onboarding screen built                   | May 12  |

### ⬜ Not started

- Onboarding screen previewed on phone
- Real artwork (Nilly + Luna) swapped in for placeholders
- Points store (spend points on monster care items)
- Anti-cheat mechanism (time locks + photo spot checks)
- Push notification system
- Naming flow + name randomizer word list
- Theme system (palette swap based on monster choice)
- Freemium / paywall logic
- Spotify integration
- AR Scan to Feed (v2)
- Google Play submission

---

## 💰 Business Model

- **Free tier:** Core app fully functional with basic features
- **Premium:** ~$4.99/month subscription
- **Revenue path:** Google Play in-app subscriptions
- **Crowdfunding:** Indiegogo campaign in planning (pre-launch hype + funding)
- **TBD:** One-time purchases as alternative to subscription

---

## 📣 Indiegogo Campaign

- **Status:** Planning phase — haven't heard back from Indiegogo yet
- **Goal:** Pre-launch funding + community building + early adopter rewards
- **Mascots featured:** Nilly (primary), Luna (secondary)
- **Strong campaign hooks:**
  - "Choose your monster" — Nilly vs. Luna personality split
  - Community World Bosses (planned v2 — "be part of the first Dust Bunny battle!")
  - AR Scan to Feed reveal as stretch goal
- **Reward tiers:** TBD
- **Campaign copy/assets:** TBD
- **Launch timing:** TBD — ideally timed with app near-completion or beta

---

## 🎨 Design Notes & Aesthetic

- **Overall vibe:** Cute but slightly chaotic — kawaii meets "my house is a disaster"
- **Color palettes:**
  - **Nilly:** Mint green primary, soft/warm accents
  - **Luna:** Black, red, gold — moody and dramatic
- **UI feel:** Friendly, low-pressure, encouraging — NOT shame-based
- **Tone of voice:** Warm, a little silly, zero judgment
- **Key UX principle:** Lower the barrier to starting. One small task is a win.
- **Theme system:** The chosen monster determines color palette + notification voice throughout the app

---

## 💡 Future Ideas Bank _(v2+ — from Gemini second brain)_

- **AR "Scan to Feed"** — Use phone camera to scan cleaned areas; monster "eats" the mess. Doubles as premium anti-cheat. _(High priority for v2)_
- **Body Double Mode** — "Clean with a Friend" — two users run a shared Pomodoro session, their monsters visit each other. Strong for the ADHD market but needs real-time backend infrastructure.
- **Community World Bosses** — A giant "Dust Bunny" appears periodically; community cleans together to defeat it. Limited-edition rewards. _(Great Indiegogo hook)_
- **Mini-Boss Rooms** — Rooms framed as dungeon levels with boss challenges. _(Needs UX review — must stay low-pressure and not feel like failure if user can't "defeat" a room.)_
- **Expanded Mess Evolution** — Monster appearance changes based on _type_ of mess ignored, not just total time. (e.g., dishes-neglected look ≠ laundry-neglected look.)

---

## ❓ Open Questions / TBD Items

- [x] Monster state system — Mess Evolution defined and implemented ✅
- [x] Onboarding flow — built ✅
- [x] Anti-cheat mechanism — designed (not built) ✅
- [x] Push notification strategy — designed (not built) ✅
- [x] Luna's role in app — pick-one at start (decided May 12) ✅
- [ ] Real artwork swap (replace placeholder Nilly/Luna images)
- [ ] AR "Scan to Feed" — technical planning needed (v2)
- [ ] Full premium feature list beyond Spotify + AR
- [ ] Points store item list (what can you buy for your monster?)
- [ ] Leveling/progression system details
- [ ] Royalty-free music library selection
- [ ] Indiegogo reward tiers
- [ ] Monetization: one-time purchases vs subscription only?
- [ ] Name randomizer word list / style
- [ ] Push notification frequency defaults / user controls

---

## 📝 Notes for AI Build Partners

### For Claude Code (in-terminal build agent)

- **Project location:** `C:\Users\kylas\mess-monster`
- **Resume command:** `cd mess-monster` then `claude`
- **Android only** — no iOS to start
- **Build modularly** — one feature at a time, confirm before next
- **Mascot artwork exists** — Nilly and Luna are finalized, do not regenerate
- **Indiegogo branding** — match existing visual identity
- **Token usage matters** — keep prompts specific, use `/compact` regularly, exit between sessions
- **Build order:** Follow Dev Status & Build Log sequence above

### For Manus (autonomous agent — new addition)

- **Read this doc in full before acting** — it's the only source of truth
- **Codebase is at:** `C:\Users\kylas\mess-monster` (React Native + Expo)
- **What's already built:** See ✅ items in Dev Status & Build Log
- **What's next:** See ⬜ items in Dev Status & Build Log
- **Don't:**
  - Re-scaffold the project — it already exists
  - Generate new monster artwork — Nilly + Luna are finalized
  - Build for iOS — Android only for v1
  - Skip the modular build order — confirm each feature before moving on
- **Do:**
  - Coordinate with Kilo before starting any new feature
  - Use the same Zustand + AsyncStorage pattern as the existing data layer
  - Match the existing app's color/tone style (low-pressure, kawaii, warm)
  - Commit work in git after each feature

### For Gemini (second brain / planning)

- Used for brainstorming, idea generation, and broad strategic thinking
- Major contributions so far: Mess Evolution mechanic, AR Scan to Feed concept, World Bosses concept, Body Double Mode, notification escalation system

---

## 🔗 External Resources & Links

- Mascot artwork (Leonardo AI): _[add file locations]_
- Indiegogo draft: _[add when created]_
- Google Play Developer account: _[add]_
- Expo project: `C:\Users\kylas\mess-monster`
- GitHub repo: _[add if pushed to remote]_
- Gemini Second Brain: _[add link]_
- Master doc origin chat: https://claude.ai/chat/a9d8b6c2-1af1-4bb8-88fa-7a250ff6ed74

---

_This is a living document. Update it as the project evolves._
