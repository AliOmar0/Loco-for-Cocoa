# Loco for Cocoa

A cinematic sweets recipe experience built with React, TypeScript, native WebGL, custom GLSL shaders, Motion, Zustand, React Hook Form, and Zod.

[View the live site](https://aliomar0.github.io/Loco-for-Cocoa/)

## Features

### Visitor experience

- Pointer-reactive native WebGL cocoa shader with a lightweight mobile art direction
- Auto-rotating hero carousel powered by the published recipe archive
- Motion-driven editorial recipe cards, layout transitions, and route loading
- Recipe filtering, favorites, command search (`Ctrl/Cmd + K`), and sweet roulette
- Curated One bowl, No oven, 15 minutes, and Weekend project shelves
- Pantry matcher that ranks recipes by ingredients already on hand
- Guided mobile Bake Mode with ingredient checks, sticky step controls, timers, and screen wake lock
- Live serving scaling, method completion, print/share controls, and shared card-to-detail image transitions
- Responsive AVIF/WebP image delivery with focal-point and zoom support
- Interactive Flavor Lab that recommends recipes from three craving controls
- Interactive Field Notes with practical sensory baking cues
- Persistent mobile section dock for Recipes, Flavor Lab, and Field Notes
- Responsive layouts for desktop, tablet, and mobile

### Recipe studio

- PIN-gated owner route at `/studio`
- Create, edit, publish, unpublish, duplicate, and delete recipes
- React Hook Form and Zod validation
- Dynamic ingredient and method fields with optional step timers
- Image focal-point and zoom editor with a live visitor-card preview
- Debounced local autosave for in-progress recipe drafts
- Revision history with one-click restore for recent manual saves
- Recipe quality checklist and publishing-readiness score
- Configurable recipe color accents
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

## GitHub Pages

Pushes to `main` automatically build and deploy through
`.github/workflows/deploy-pages.yml`.

```powershell
npm run build:pages
```

The deployed site uses the `/Loco-for-Cocoa/` base path and includes a Pages
fallback so the Studio route works when opened directly.

## Checks

```powershell
npm run lint
npm run build
npm run test:smoke
```

`npm run test:smoke` expects a Chromium-based browser running with a remote debugging port. It is used for local interaction and visual QA.

## Storage note

Recipes and favorites currently persist in the visitor's browser. For a deployed multi-device admin system, connect the Zustand actions to an authenticated database such as Supabase or PostgreSQL and replace the demo PIN with server-side authentication.
