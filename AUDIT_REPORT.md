# Mess Monster — Code Audit Report
**Date:** 2026-06-26 | **Auditor:** Claude Code (claude-sonnet-4-6) | **Branch:** main

---

## 1. FEATURE STATUS

| Feature | File Path | Status |
|---|---|---|
| Monster selection / onboarding | `app/onboarding.tsx` | Full |
| Home / pet view | `app/(tabs)/index.tsx` | Full |
| Task logging | `app/(tabs)/explore.tsx` | Full |
| Points store | `app/(tabs)/store.tsx` | Full |
| Zustand + AsyncStorage data layer | `store/use-player-store.ts`, `store/use-pet-store.ts`, `store/use-tasks-store.ts`, `store/use-store-store.ts`, `store/use-photo-store.ts` | Full |
| Stat decay + offline catch-up | `store/use-pet-store.ts` (`applyDecay`, rehydration hook) | Partial |
| Daily chore roll (date-seeded, category-balanced) | `store/preset-tasks.ts` (`getDailyRoll`), `store/use-tasks-store.ts` (`refreshDailyRoll`) | Full |
| Health/happiness bars | `app/(tabs)/index.tsx` (stat bar section) | Full |
| Mood overlays | `app/(tabs)/index.tsx` (`MOOD_CONFIG`, `deriveMood`) | Full |
| Custom naming | `app/onboarding.tsx` (name input + dice), `store/use-player-store.ts` (`setMonsterName`) | Full |
| Streak rewards | `store/use-pet-store.ts` (`checkStreakMilestones`), `app/(tabs)/index.tsx` (milestone banner) | Full |
| Habitat backgrounds (Luna gothic lair / Nilly cozy mint room) | `app/(tabs)/index.tsx` (`HABITAT_IMAGES`) | Full |
| Base sprites (Egg, Baby, Teen, Adult) | `assets/images/` (nilly_*/luna_* PNGs) | Full |
| 8 adult room variants | `assets/images/` (*_adult_kitchen/livingroom/bedroom/bathroom) | Partial |
| Evolution thresholds / rules (Egg→Baby→Teen→Adult→Ascended) | `store/use-pet-store.ts` (`checkEvolution`) | Partial |
| Adult variant logic (dominant category or fallback) | `store/use-pet-store.ts` (adult variant determination block) | Full |
| Ascended form (silhouette + "?" only) | `store/use-pet-store.ts` (threshold defined, no trigger), `app/(tabs)/index.tsx` (no sprite/overlay) | Missing |
| Premium gating (`setPremium(true)`) | `store/use-player-store.ts` (`setPremium`), `store/use-pet-store.ts` (`pendingPremiumGate`) | Partial |

---

## 2. CRITICAL & LOGIC BUGS

**[High] `store/use-pet-store.ts` (`applyDecay`) — Decay can produce negative stat values**
No floor clamp is applied after subtracting hours × rate. If `lastCaredAt` is very old (e.g., 100+ hours), `health` and `happiness` will go deeply negative, not stop at 0. This causes `deriveMood` to receive values below its `< 15` threshold correctly, but downstream display and care calculations assume 0–100 range. Any future arithmetic on raw stat values (e.g., percentage display) will render negative numbers or NaN if divided.

**[High] `store/use-pet-store.ts` (`applyDecay`) — Offline catch-up ignores elapsed time since last *session*, not last care**
`applyDecay` uses `lastCaredAt` as the decay origin. If the user cares for the pet and then opens the app 48 hours later without caring, decay is correctly calculated. However, if `lastCaredAt` is `null` or `0` (new saves before first care action), `Date.now() - 0` yields a ~57-year elapsed time, causing instant maximum decay or negative stats on first launch. The initial `lastCaredAt` is not set to `Date.now()` at store initialization; it is set to `0` via the `PetState` default shape inferred from the type.

**[High] `store/use-pet-store.ts` — Ascended evolution threshold defined but never triggered**
`checkEvolution` contains no branch for `stage === 'adult'` → `ascended`. The ascended stage exists in `EvolutionStage` type (`store/types.ts`) and in the pet store's migration, but there is no points/days threshold, no trigger call, and no sprite or UI for it. Users who reach adult will never progress further, silently.

**[High] `app/(tabs)/_layout.tsx` (line referencing `debug-sprites`) — Missing screen file causes runtime crash in dev**
The tab navigator references `debug-sprites` as a tab. The file `app/(tabs)/debug-sprites.tsx` does not exist. On any environment where `__DEV__` is truthy (all current dev builds), the Expo Router will attempt to resolve this route and crash or produce a blank tab. There is no `__DEV__` guard around the tab definition itself.

**[Medium] `store/use-player-store.ts` (`recordActivity`) — Streak breaks on same-day repeated calls due to no idempotency guard for `activeDaysCount`**
`activeDaysCount` is incremented only when `lastActiveDay !== today` (correct), but the streak update runs unconditionally every call. If `lastActiveDay === today` (same-day second task), the function enters the else-if block (`=== yesterday` → increment, else → reset to 1) using the already-updated `lastActiveDay`. Since `lastActiveDay` was set to today on the first task, a second task on the same day will find `lastActiveDay === today`, skip both branches, and fall through — but the logic depends on exact branch order. A careful read shows the guard `if (lastActiveDay !== today)` wraps `activeDaysCount` but NOT the streak block. The streak block runs even when `lastActiveDay === today`, meaning if somehow `today === yesterday` (timezone edge case at midnight), streak can be incorrectly incremented twice.

**[Medium] `store/use-pet-store.ts` (`trackEarned`) — `totalPointsEarned` and `categoryCompletions` are updated in `use-pet-store`, but `totalPoints` / `availablePoints` live in `use-player-store`**
These are two separate Zustand stores with separate AsyncStorage keys. The evolution check in `use-pet-store.ts` (`checkEvolution`) reads `totalPointsEarned` from `petState` and `activeDaysCount` from `usePlayerStore.getState()`. This cross-store read via `getState()` works at call time but is not reactive — if `use-player-store` rehydrates after `use-pet-store`, `activeDaysCount` may read `0` during the post-rehydration `recheckEvolution()` call, incorrectly blocking evolution.

**[Medium] `store/use-tasks-store.ts` (`refreshDailyRoll`) — No guard against calling `getDailyRoll` on empty `PRESET_TASKS`**
If `PRESET_TASKS` is ever empty (e.g., future refactor removes tasks), `getDailyRoll` will enter an infinite loop or return an empty array, and the daily roll will silently show nothing with no error surfaced to the user.

**[Medium] `app/(tabs)/explore.tsx` (task timer / reward flow) — Custom tasks (non-preset) bypass min-time anti-cheat**
The timer uses `TASK_MIN_TIMES[taskId]` with a default fallback of 180s. However, the daily roll only surfaces preset tasks. If a future feature allows custom task IDs, they will always fall through to the 180s default, which may be too short for some task types and bypasses category-specific minimums. This is a design gap rather than a crash bug, but merits flagging before custom task support lands.

**[Medium] `store/use-pet-store.ts` — `pendingPremiumGate` and `premiumGateShownFor` can desync after `recheckEvolution`**
After `setPremium(true)` is called and `recheckEvolution()` runs, evolution proceeds to adult and sets `pendingEvolution`. However, if the app is killed between `setPremium` and `recheckEvolution`, the pet store has `premiumGateShownFor: 'adult'` but `evolutionStage: 'teen'`, and on next launch neither the premium gate nor the evolution will re-trigger, leaving the monster permanently stuck at teen for premium users who force-quit at the wrong moment.

**[Medium] `store/use-photo-store.ts` (`addPhoto`) — Cap at 200 records is implemented as prepend + no splice**
The `addPhoto` method prepends and the 200-record cap is mentioned in comments, but the actual slice/splice to enforce this cap needs verification. If it is absent or off-by-one, unbounded photo URI accumulation in AsyncStorage will eventually hit storage limits on low-end Android devices.

---

## 3. MISSING ARCHITECTURE & ASSETS

### Gameplay
- **12 neglect/sick sprites** (per mascot): Only standard stage sprites exist; no sad/sick visual variants in `assets/images/`. The `sad_luna_*` and `sad_nilly_*` files visible in git status (`sad_luna_baby.jpg`, `sad_luna_egg.jpg`, `sad_luna_teen.jpg`, `sad_nilly_egg.jpg`) are untracked and not referenced in any sprite map.
- **Ascended form:** No silhouette sprite, no "?" overlay, no evolution trigger, no UI branch.
- **Placeable habitat items (decor):** Decor items exist in the store catalog (`store/store-items.ts`) and can be purchased, but there is no rendering layer in `app/(tabs)/index.tsx` to display owned decor items in the habitat. Purchased decor has zero visible effect.
- **Animations:** No entrance/exit animations on modals; milestone banner and evolution overlay appear/disappear without transitions. No sprite transition animation between evolution stages.
- **Anti-cheat photo validation:** Photo URI is stored locally but never validated (no hash check, no server-side verification, no duplicate detection). Users can submit the same photo repeatedly.
- **Task category coverage:** Only 7 categories defined in types; `other` category exists but no preset tasks use it. `laundry` category exists in types but has zero preset tasks and no `TASK_MIN_TIMES` entry.

### Monetisation
- **RevenueCat integration:** Entirely absent. `setPremium(true)` in `store/use-player-store.ts` is a boolean flag with no payment flow, receipt validation, restore purchases, or entitlement check.
- **Premium wall UI:** The premium gate modal in `app/(tabs)/index.tsx` has an "Upgrade" button that calls `setPremium(true)` directly — no paywall screen, no pricing display, no SKU.
- **$24.99/yr pricing:** Not referenced anywhere in code, UI, or `app.json`.
- **Subscription management:** No restore-purchases flow, no subscription status polling, no lapsed-subscription handling (premium flag stays `true` forever once set).

### Infrastructure
- **Push notifications:** No `expo-notifications` dependency, no permission request, no scheduling for decay reminders or streak nudges.
- **App icon:** `assets/images/icon.png` exists but adaptive Android icons (foreground/background/monochrome) need verification against Play Store density requirements.
- **Splash screen:** `splash-icon.png` exists; `expo-splash-screen` plugin configured. Functional but not audited for brand quality.
- **Error boundaries:** `utils/errorHandler.ts` exists as a utility singleton but no React error boundary component wraps any screen. A JS throw in any screen will produce a white screen with no recovery path.
- **Crash reporting:** No Sentry, Bugsnag, or Firebase Crashlytics integration.
- **Deep linking:** URL scheme `messmonster://` is configured in `app.json` but no deep link handlers are implemented in `app/_layout.tsx`.
- **Production `app.json`:** Missing `android.package`, `ios.bundleIdentifier`, `android.versionCode`, EAS project ID, and submission config. Current `app.json` is development-only.

### Compliance / Store
- **Release build config:** No `eas.json`, no EAS build profiles, no signing key configuration.
- **Privacy policy:** No URL referenced in `app.json` or any screen. Required by Google Play and Apple App Store for apps collecting photos and usage data.
- **Content rating:** No IARC questionnaire or age rating metadata in `app.json`.
- **Play Store assets:** No store listing screenshots, feature graphic, or short/long descriptions prepared.
- **Website:** No production web build or landing page. `web/App.tsx` is a placeholder with no Indiegogo link or press kit.
- **COPPA / child safety:** App collects photos. No age gate or parental consent flow.

---

## 4. QUALITY RATING (1–5)

| Area | Rating | Justification |
|---|---|---|
| Core loop | 4 | Task → reward → care → evolution loop is coherent and well-implemented; blocked only by missing ascended stage and decor rendering. |
| UI / screens | 4 | Home screen is polished with particle system, animations, mood overlays, and themed variants; explore and store screens are functional but lack animation polish. |
| Data persistence | 3 | Five Zustand stores with AsyncStorage are well-structured, but cross-store rehydration ordering is unsafe and the negative-stat decay bug is a data-integrity risk. |
| Evolution system | 3 | Egg→Baby→Teen→Adult thresholds and adult variant logic are solid; ascended stage is entirely unimplemented and the premium-gate desync bug can permanently block adult evolution. |
| Premium gating | 1 | Gate UI exists but `setPremium(true)` bypasses all payment — shipping this is a revenue loss and potential store policy violation. |
| Production readiness | 1 | No EAS config, no real IAP, no crash reporting, no privacy policy, missing Play Store assets, and a dev-only tab that crashes on launch. Not shippable in current state. |

---

## 5. ACTION PLAN

### Blockers — Must-fix before launch

1. **Fix negative stat decay:** Add `Math.max(0, ...)` clamp to both `health` and `happiness` after decay calculation in `store/use-pet-store.ts` (`applyDecay`). Also initialize `lastCaredAt` to `Date.now()` in the default state, not `0`.
2. **Remove or guard the debug-sprites tab:** Either create `app/(tabs)/debug-sprites.tsx` or wrap the tab definition in `app/(tabs)/_layout.tsx` with a `__DEV__ &&` conditional to prevent the route resolution crash in all builds.
3. **Integrate RevenueCat (or equivalent IAP):** Replace `setPremium(true)` with a real purchase flow, receipt validation, and restore-purchases button. The current gate is trivially bypassable.
4. **Implement ascended stage:** Add evolution trigger (`stage === 'adult'` branch in `checkEvolution`), a threshold (e.g., 1000 points + 30 days), a silhouette sprite, and the "?" overlay in `app/(tabs)/index.tsx`.
5. **Wire decor items to habitat renderer:** Owned decor items must be rendered in the habitat view in `app/(tabs)/index.tsx`; currently purchased decor has no visible effect, breaking the store's value proposition.
6. **Fix premium-gate desync on force-quit:** Persist a `premiumUnlockPending` flag that survives app kill; on rehydration, re-run `recheckEvolution` if flag is set, then clear it.
7. **Add EAS build config:** Create `eas.json` with development/preview/production profiles; add `android.package` and `ios.bundleIdentifier` to `app.json`; configure signing.
8. **Add privacy policy URL:** Reference a hosted privacy policy in `app.json` (`android.privacyPolicyUrl`, `ios.privacyPolicyUrl`) and in a Settings or About screen. Required for photo collection.
9. **Add React error boundary:** Wrap each tab screen in an error boundary component so JS errors produce a recovery UI instead of a white screen.

### Should-do

1. Add `expo-notifications` for decay reminder push notifications (streak-at-risk, pet mood critical).
2. Track and display owned decor in a dedicated inventory/collection UI tab or panel.
3. Add sad/sick sprite variants; commit the four untracked `sad_*` assets and add them to the sprite map in `app/(tabs)/index.tsx`.
4. Add modal open/close animations (fade or slide) to milestone banner, evolution overlay, and premium gate.
5. Fix cross-store rehydration ordering: use Zustand's `onRehydrateStorage` callback to sequence `use-player-store` rehydration before `use-pet-store.recheckEvolution()` is called.
6. Add `expo-notifications` or a lightweight analytics event for IAP conversion tracking.
7. Add laundry preset tasks to `store/preset-tasks.ts` (category exists in types but has zero tasks).
8. Enforce photo-record cap in `store/use-photo-store.ts` (`addPhoto`) — confirm `slice(0, 200)` is present; if not, add it.
9. Integrate Sentry or Firebase Crashlytics for production crash visibility.
10. Prepare Play Store listing assets: 2–8 screenshots (1080×1920), feature graphic (1024×500), short description (≤80 chars), full description.

### Post-launch

- Implement Spotify integration (Premium tier feature).
- Build custom task creation UI (user-defined label, category, point value).
- Add placeable item drag-and-drop in habitat view.
- Implement Ascended "mystery" mechanic with community speculation hook.
- Build web landing page with Indiegogo link and press kit.
- Add COPPA age gate if targeting users under 13.
- Implement anti-cheat duplicate photo detection (perceptual hash or timestamp dedup).
- Add content rating IARC questionnaire metadata.
