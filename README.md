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

Set `EXPO_PUBLIC_API_URL` to the backend URL reachable from the physical device. Authentication,
journeys, private photo uploads, album galleries, and journey covers use the real API. Selected
photos remain private and are displayed through short-lived access URLs returned by the backend.
