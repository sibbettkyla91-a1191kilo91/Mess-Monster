# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mess Monster is a gamified Android cleaning motivation app. A virtual pet (the "mess monster") is tied to real-world cleaning: players log cleaning tasks, earn points, and spend points to care for their monster. Neglect causes the monster to become sad/sick; consistent cleaning makes it thrive.

**Mascots:**

- **Nilly** — primary mascot, mint green, kawaii aesthetic
- **Luna** — secondary mascot, dark witchy aesthetic

**Tiers:**

- Free: basic pet states, cleaning coach
- Premium (~$4.99/month): Spotify integration, extra customization

**Core UX principle:** low pressure, zero shame — every design decision should lower the barrier to starting a cleaning task.

## Commands

```bash
npm install          # Install dependencies
npm start            # Start Expo dev server (interactive: press a/i/w for Android/iOS/web)
npm run android      # Start with Android emulator
npm run ios          # Start with iOS simulator
npm run web          # Start with web browser
npm run lint         # Run ESLint via expo lint
npm run reset-project  # Move starter code to app-example/ and create blank app/
```

There is no test runner configured yet.

## Architecture

This is a React Native app built with **Expo SDK 54** and **Expo Router v6** (file-based routing). The new React Native architecture (`newArchEnabled: true`) and React Compiler (`reactCompiler: true`) are both enabled. The app URL scheme is `messmonster://`.

### Routing

Expo Router uses the `app/` directory for file-based routing:

- `app/_layout.tsx` — root Stack navigator; wraps everything in `ThemeProvider` for dark/light mode
- `app/(tabs)/_layout.tsx` — bottom tab navigator with Home and Explore tabs
- `app/modal.tsx` — modal screen accessible as a stack push from any tab

The root layout sets `anchor: '(tabs)'` so the initial route is the tabs group.

### Theming

- `constants/theme.ts` exports `Colors` (light/dark palettes) and `Fonts` (platform-specific font stacks)
- `hooks/use-theme-color.ts` — reads the active color scheme and returns the correct color from `Colors`, with optional prop overrides
- `hooks/use-color-scheme.ts` — re-exports `useColorScheme` from `react-native` (the `.web.ts` variant overrides this for web)
- Themed primitives: `ThemedText` and `ThemedView` in `components/` wrap RN `Text`/`View` and apply theme colors automatically

### Icons

`IconSymbol` (`components/ui/icon-symbol.tsx` / `.ios.tsx`) uses **SF Symbols** on iOS and falls back to **Material Icons** on Android and web. New icons require adding an entry to the `MAPPING` object in `icon-symbol.tsx`.

### Path alias

`@/` maps to the repo root (configured in `tsconfig.json`), so imports look like `@/components/themed-text` or `@/constants/theme`.
