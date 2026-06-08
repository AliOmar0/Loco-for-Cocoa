# Loco for Cocoa

A cinematic sweets recipe experience built with React, TypeScript, Three.js, custom GLSL shaders, Motion, Zustand, React Hook Form, and Zod.

## Features

### Visitor experience

- Pointer-reactive Three.js cocoa shader with a lightweight mobile art direction
- Auto-rotating hero carousel powered by the published recipe archive
- Motion-driven editorial recipe cards, layout transitions, and route loading
- Recipe filtering, favorites, command search (`Ctrl/Cmd + K`), and sweet roulette
- Live serving scaling, method completion, step timers, print/share controls, and screen-awake bake mode
- Interactive Flavor Lab that recommends recipes from three craving controls
- Interactive Field Notes with practical sensory baking cues
- Persistent mobile section dock for Recipes, Flavor Lab, and Field Notes
- Responsive layouts for desktop, tablet, and mobile

### Recipe studio

- PIN-gated owner route at `/studio`
- Create, edit, publish, unpublish, duplicate, and delete recipes
- React Hook Form and Zod validation
- Dynamic ingredient and method fields with optional step timers
- Live visitor-card preview and configurable recipe color accents
- Persistent browser storage through Zustand
- JSON import/export and starter-data reset
- Performance dashboard with category trends, archive health, and save rankings
- Searchable Community Saves dashboard with recipe status and engagement totals
- Fixed full-height desktop navigation rail

## Run locally

Install dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173).

The studio is at [http://127.0.0.1:5173/studio](http://127.0.0.1:5173/studio). The demo PIN is `0420`.

## Production

```powershell
npm run build
npm run preview
```

## Checks

```powershell
npm run lint
npm run build
npm run test:smoke
```

`npm run test:smoke` expects a Chromium-based browser running with a remote debugging port. It is used for local interaction and visual QA.

## Storage note

Recipes and favorites currently persist in the visitor's browser. For a deployed multi-device admin system, connect the Zustand actions to an authenticated database such as Supabase or PostgreSQL and replace the demo PIN with server-side authentication.
