# Vialbum Mobile

The Expo/React Native client for Vialbum, a mobile-first home for travel memories.

## Requirements

- Node.js 20+
- npm
- Expo Go on an iOS or Android device

## Setup

```bash
npm install
cp .env.example .env
npm start
```

Scan the terminal QR code with the iPhone Camera app (or Expo Go on Android). If the phone cannot reach the development machine over LAN, run `npm run start:tunnel`.

## Quality checks

```bash
npm run typecheck
npm run lint
```

The MVP currently uses local mock journey data. `EXPO_PUBLIC_API_URL` is reserved for API integration.
