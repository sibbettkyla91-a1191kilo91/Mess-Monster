# Mess Monster

PROJECT: React Native/Expo (SDK 54, Expo Router) cleaning-motivation app. Two monsters: Nilly (mint, kawaii) and Luna (dark, witchy). Evolution: egg → baby → teen → adult. Points from chores, spent in the points store. Neglect makes the pet sad/sick; cleaning makes it thrive.

UX: low pressure, zero shame — every choice should make starting a chore easier.

OWNER: Builds via AI-assisted prompting; not a coding background. Explain changes in plain language, not syntax. Propose a plan before large changes.

STACK: `npm start` / `npm test` / `npm run lint`. Imports use `@/` for the repo root. New tab icons need an entry in `components/ui/icon-symbol.tsx` `MAPPING`. React Compiler is on.

## Hard rules

- Never write a Zustand selector that returns a new array or object each call. That caused an infinite re-render crash. Watch raw state maps; derive lists in the component.
- Screens must wait for hydration before taps that write state.
- Seven separate persisted stores. Writes that touch two stores need the existing intent-and-receipt crash-recovery pattern, or a crash loses data.
- Sprite positioning lives only in `store/accessory-config.ts`. Never hardcode positions in components.
- `constants/feature-flags.ts` `FOUNDING_MEMBER_PURCHASE_ENABLED` must stay false until real Apple/Google billing exists. Real-money purchase is not implemented.
- Do not modify unless asked: points store purchase logic, tasks, notifications, onboarding, pet decay.

## Known incomplete (do not "fix" unasked)

- Sprites may be redrawn; accessory anchors are intentionally rough.
- Luna's witch hat is painted into her sprite; her head slot is locked in config.
- Accessories always draw in front of the monster; layered sprites do not exist yet.
- Furniture places as emoji, not art.
- "Ascended" exists in types; nothing triggers it.
