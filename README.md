# Loco for Cocoa

A cinematic sweets recipe experience built with React, TypeScript, Three.js,
native WebGL/GLSL, Motion, Zustand, React Hook Form, Zod, and Vite PWA.

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
- Persisted Bake Mode progress, checked ingredients, timers, servings, and portion personality
- Recently viewed and Continue Baking rails stored on the visitor's device
- Emergency substitution roulette with dietary filters and reliable/joke outcomes
- Polite/realistic yields, chaotic unit conversion, and Kitchen Disaster ratings
- Voice commands and experimental FaceDetector-powered nod navigation for messy hands
- Squishy save/print interactions, completion confetti, haptics, and tiny audio feedback
- Comfort menu for text size, contrast, visual intensity, sounds, and cursor effects
- Desktop whisk cursor with fading cocoa and sugar trails
- Lazy interactive Three.js cocoa-bean loading scene and dropped-cake 404 page
- Recipe-driven GLSL palette and texture transitions
- Live serving scaling, method completion, print/share controls, and shared card-to-detail image transitions
- Responsive AVIF/WebP image delivery with focal-point and zoom support
- Interactive Flavor Lab that recommends recipes from three craving controls
- Interactive Field Notes with practical sensory baking cues
- Persistent mobile section dock for Recipes, Flavor Lab, and Field Notes
- Responsive layouts for desktop, tablet, and mobile

### Recipe studio

- Backend-ready owner authentication at `/studio`, with an explicit local preview mode until the API is connected
- Create, edit, publish, unpublish, duplicate, and delete recipes
- React Hook Form and Zod validation
- Dynamic ingredient and method fields with optional step timers
- Image focal-point and zoom editor with a live visitor-card preview
- Debounced local autosave for in-progress recipe drafts
- Revision history with one-click restore for recent manual saves
- Recipe quality checklist and publishing-readiness score
- Configurable recipe color accents
- Fully configurable homepage collection shelves, recipe lineups, order, visibility, and accents
- Direct image uploads with local browser fallback or cloud storage through the API adapter
- Dietary tags, realistic yields, and Kitchen Disaster editing
- Burnt-to-baked recipe readiness visual
- Persistent browser storage through Zustand
- Versioned archive import/export for both recipes and collections
- Optional authenticated cloud archive sync
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

The studio is at
[http://127.0.0.1:5173/studio](http://127.0.0.1:5173/studio). Until a backend
is configured, use **Open local preview**. Preview data remains in that browser.

## Vercel backend contract

Keep GitHub Pages as the frontend and set this environment variable during the
frontend build:

```env
VITE_API_URL=https://your-vercel-project.vercel.app
```

The frontend expects these authenticated endpoints:

```text
POST /api/auth/login
  body: { email, password }
  returns: { token, user: { id, email, name? } }

POST /api/uploads
  multipart field: image
  header: Authorization: Bearer <token>
  returns: { url }

POST /api/archive/sync
  body: { recipes, collections }
  header: Authorization: Bearer <token>
  returns: { recipes, collections }
```

The Vercel API should allow CORS only from the GitHub Pages production origin
and local development origin. Authentication secrets and database credentials
must stay on Vercel; never place them in `VITE_*` variables.

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
fallback so Studio and the custom 404 route work when opened directly. The
generated service worker and manifest make the visitor experience installable.

## Checks

```powershell
npm run lint
npm run build
npm run test:smoke
```

`npm run test:smoke` expects a Chromium-based browser running with a remote debugging port. It is used for local interaction and visual QA.

## Storage note

Visitor preferences, favorites, recipe history, and Bake Mode progress persist
locally. Studio recipes and collections also remain local when no API is
configured. Once the Vercel endpoints are available, owner auth, image uploads,
and archive sync use the backend adapter in `src/lib/backend.ts`.
