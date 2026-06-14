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
- Desktop chocolate-chip cookie cursor with fading cocoa and sugar trails
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

## Vercel backend

This repository now contains both pieces:

- Vite builds the frontend preview on Vercel.
- TypeScript files in `api/` deploy as Vercel Functions.
- GitHub Pages remains the public frontend.
- Neon Postgres stores the recipe archive and up to 30 cloud revisions.
- Vercel Blob receives recipe images directly from the browser.

`vercel.json` declares the Vite framework, build command, output directory, and
Function duration. On Vercel's **New Project** screen use:

```text
Application Preset: Vite
Root Directory: ./
Build Command: leave inherited
Output Directory: leave inherited
Install Command: leave inherited
Environment Variables: leave empty for the first deployment
```

The values are inherited from `vercel.json`, so the disabled fields shown by
Vercel are expected. Click **Deploy**.

### Finish the Vercel project

After the first deployment:

1. Open the Vercel project and add a Postgres integration from **Storage** or
   **Marketplace**. Neon is recommended. It supplies `DATABASE_URL`.
2. Add a Vercel Blob store to the project. It supplies
   `BLOB_READ_WRITE_TOKEN`.
3. Generate an owner password hash locally:

   ```powershell
   npm run auth:hash
   ```

   The command asks for the password twice without displaying or storing it in
   shell history.

4. Generate a JWT signing secret locally:

   ```powershell
   npm run auth:secret
   ```

5. In **Project Settings → Environment Variables**, add:

   ```env
   OWNER_EMAIL=your-owner-email
   OWNER_NAME=Ali
   OWNER_PASSWORD_HASH=the-output-from-auth-hash
   JWT_SECRET=the-output-from-auth-secret
   ALLOWED_ORIGINS=https://aliomar0.github.io,http://127.0.0.1:5173
   ```

6. To enable the full Epicure Lab, add the private provider variables described
   in **Epicure Lab providers** below.
7. Redeploy the Vercel project so all variables are available to the Functions.
8. Visit `https://your-project.vercel.app/api/health`. Every service should be
   `true`.
9. Sign into `/studio` on the Vercel deployment. The first archive request
   creates the database tables automatically.

The Vercel-hosted frontend automatically connects to its same-origin API. Keep
GitHub Pages as the public frontend by setting this variable during the Pages
build:

```env
VITE_API_URL=https://your-vercel-project.vercel.app
```

After the backend is deployed, open the GitHub repository and go to
**Settings → Secrets and variables → Actions → Variables**. Create a repository
variable named `VITE_API_URL` with the production Vercel URL, then rerun the
**Deploy to GitHub Pages** workflow. The workflow already passes that variable
to the Vite build.

`VITE_API_URL` is public by design because it is embedded in the browser bundle.
Never put database credentials, Blob tokens, password hashes, or signing secrets
in a `VITE_*` variable.

The frontend uses these authenticated endpoints:

```text
POST /api/auth/login
  body: { email, password }
  returns: { token, user: { id, email, name? } }

GET /api/archive
  header: Authorization: Bearer <token>
  returns: { recipes, collections, version, updatedAt, initialized }

GET /api/public/archive
  public, read-only
  returns published recipes and enabled collections only

POST /api/uploads
  Vercel Blob client-upload token exchange
  header: Authorization: Bearer <token> during token generation

POST /api/archive/sync
  body: { recipes, collections }
  header: Authorization: Bearer <token>
  returns: { recipes, collections, version, updatedAt, initialized }

GET /api/ai/status
  authenticated provider-readiness check

POST /api/ai/pairings
  authenticated Epicure FlavorGraph pairing search

POST /api/ai/recipe
  authenticated recipe, nutrition, and thumbnail generation
```

The API already handles CORS for the GitHub Pages production origin, local
development, and the active Vercel deployment. Authentication secrets and
database credentials must stay on Vercel; never place them in `VITE_*`
variables.

Recommended private Vercel variables:

```env
DATABASE_URL=provided-by-your-postgres-integration
BLOB_READ_WRITE_TOKEN=provided-by-vercel-blob
JWT_SECRET=a-long-random-secret
ALLOWED_ORIGINS=https://aliomar0.github.io,http://127.0.0.1:5173
OWNER_EMAIL=your-owner-email
OWNER_NAME=Ali
OWNER_PASSWORD_HASH=an-argon2id-password-hash
```

### Epicure Lab providers

The Studio includes Epicure's official 1,790-ingredient vocabulary and calls its
public FlavorGraph MCP for pairing intelligence. The public Epicure service is
read-only and does not expose Epicure's private Gemini/Imagen recipe-generation
pipeline, so Loco for Cocoa uses separate providers for the rest:

- DeepSeek V4 Pro returns a structured, editable recipe draft.
- USDA FoodData Central calculates nutrition from approximate gram weights.
- Google Imagen 4 creates the editorial recipe thumbnail.
- Vercel Blob stores the generated image with the rest of the recipe media.

Add these variables in **Vercel → Project Settings → Environment Variables**:

```env
EPICURE_MCP_URL=https://epicure-mcp.kaikaku.ai/mcp
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-v4-pro
USDA_API_KEY=your-fooddata-central-api-key
GEMINI_API_KEY=your-google-ai-studio-api-key
```

`BLOB_READ_WRITE_TOKEN` is also required for generated thumbnails and is
normally supplied when the Blob store is connected. Set every private variable
for Production, Preview, and Development, then redeploy.

The Lab remains useful with partial configuration:

- Without `USDA_API_KEY`, nutrition is clearly labeled **AI estimate**.
- Without `GEMINI_API_KEY` or Blob, the recipe is generated without a thumbnail.
- Without `DEEPSEEK_API_KEY`, ingredient search and pairings work, but recipe
  generation is disabled by the API.

Generated recipes should still be reviewed before publishing. USDA values are
based on ingredient-name matching and approximate weights; they are not medical
or allergen advice.

The vendored Epicure ingredient list remains under its upstream MIT license;
see `src/data/EPICURE_LICENSE.txt`.

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
