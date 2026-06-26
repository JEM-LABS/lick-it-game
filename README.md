# LICK IT

Milestone 1 is a mobile-first Phaser 3 + TypeScript + Vite physics prototype for testing a one-tap tongue launch mechanic.

## Run locally

```bash
npm install
npm run dev
```

Open the local Vite URL in a browser. The canvas is portrait-friendly for mobile and scales to desktop windows.

## Build

```bash
npm run build
```

## Controls

- Mobile: tap anywhere to launch or restart after game over.
- Desktop: click or press Space to launch or restart after game over.

## Prototype scope

This milestone intentionally includes only the core physics loop: one shot per target, arcing tongue tip collision, PERFECT/CLOSE/MISS judgments, score, streak, misses, and game over after 5 misses.
