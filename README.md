# Mess-Monster 🎮

A fun React Native app built with Expo where players can manage and care for virtual monsters (Nilly and Luna). Featuring customizable homes, music, subscription tiers, and optional ads.

## Features (In Development)

- 🏠 **Nilly and Luna's Homes** - Customize and decorate monster homes
- 🎵 **Background Music** - Immersive audio experience
- 💳 **Subscription Tiers** - Free and premium features
- 📺 **Ad Support** - Optional ads on free tier

## Tech Stack

- **Framework**: Expo with React Native
- **Language**: TypeScript
- **State Management**: Zustand
- **Navigation**: Expo Router (file-based routing)
- **Styling**: React Native built-in
- **Icons**: Expo Vector Icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g expo-cli`

### Installation

```bash
# Install dependencies
npm install

# Start the app
npm start
```

Then choose your platform:

- **iOS**: Press `i`
- **Android**: Press `a`
- **Web**: Press `w`
- **Expo Go**: Scan QR code

### Development Scripts

```bash
npm run ios          # Run on iOS simulator
npm run android      # Run on Android emulator
npm run web          # Run on web
npm run lint         # Check code quality
npm run build        # Build for production
npm run reset-project # Reset to blank state
```

## Project Structure

```
mess-monster/
├── app/                   # Expo Router pages and layouts
├── assets/               # Images, fonts, icons
├── stores/              # Zustand state management
├── components/          # Reusable React components
├── utils/              # Helper functions & error handling
├── __tests__/          # Jest test files
├── app.json            # Expo configuration
├── package.json        # Dependencies
└── tsconfig.json       # TypeScript configuration
```

## State Management

The app uses **Zustand** for global state with separate stores for:

- `monsterStore` - Monster state (Nilly & Luna)
- `userStore` - User profile & preferences
- `subscriptionStore` - Subscription & monetization
- `settingsStore` - App settings

See `stores/` directory for implementation.

## Testing

Run tests with:

```bash
npm test
```

Tests are located in `__tests__/` directory.

## Roadmap

- [ ] Implement Nilly and Luna's homes feature
- [ ] Add background music system
- [ ] Build subscription tier system
- [ ] Integrate ad network for free tier

See [Issues](https://github.com/sibbettkyla91-a1191kilo91/Mess-Monster/issues) for detailed feature specs.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

Private project
