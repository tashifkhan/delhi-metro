# Installable web app

The web build installs to a home screen or a desktop dock. Everything it needs
lives in `public/`, which `expo export` copies into `dist/` untouched.

| File | Role |
| --- | --- |
| `public/index.html` | The HTML template Expo fills in. Links the manifest and the touch icon, stashes the install prompt, registers the worker. |
| `public/manifest.webmanifest` | Name, colours, icons, and the three shortcuts. |
| `public/sw.js` | Service worker. Makes the app installable and keeps it usable underground. |
| `public/icons/` | 192px and 512px icons, plus the 180px `apple-touch-icon`. |
| `src/hooks/usePwaInstall.ts` | Whether this browser can install, and how. |
| `src/components/web/GetTheApp.tsx` | The rows the user actually taps. |

## The template

Expo's Metro export writes the title, description, theme colour and bundle
script into an HTML template, and generates no manifest. `public/index.html` is
that template, which the exporter prefers over its own copy, so the manifest
link and the Apple meta tags are declared there by hand.

Keep `%WEB_TITLE%`, `%LANG_ISO_CODE%` and the `#root` element in it. Without
the first two the exporter has nothing to substitute. Without `#root` the page
loads and renders nothing.

## Installing

`beforeinstallprompt` fires before the app bundle has parsed, and the event
object is the only way to open the install dialog. An inline script in the
template catches it, cancels it, and stores it on `window`. `usePwaInstall`
reads that on mount and watches for later ones. Cancelling also hides Chrome's
own install bar, so the app's row is the only place that offers to install.

iOS has no such API. Safari installs only through its share sheet, so
`needsManualInstall` switches the iOS row's subtitle to the two taps that do
it. That row keeps saying a native build is still to come, because the
installed web app is not one.

## The service worker

A browser will not offer an install without a worker that handles fetches. This
one caches by what a response is worth offline.

- `/_expo/static/*`, `/assets/*` and `/icons/*` come from the cache first. They
  are content-hashed, so a hit is always the right file.
- Navigations go to the network first and fall back to the cached shell. Every
  client-side route is the same page, so one cached copy answers all of them.
- `/api/*` is never cached and never intercepted. A stale fare or a stale
  service alert in front of someone at a gate is worse than an error.

The template skips registration on Metro's dev ports (8081, 19006), because a
worker holding a dev bundle outlives the session that created it.
`bun run preview:web` serves the real export through Wrangler on 8787 and does
register, so test installing there.

Bump `CACHE` in `public/sw.js` when the caching rules change. The activate
handler deletes every cache whose name no longer matches.

## Icons

Generated from `assets/icon.png` and flattened onto the adaptive icon's
background colour, so no edge is transparent. Android crops a maskable icon to
its own shape, and transparent corners come out as notches. The train mark sits
inside the central 80% that every mask keeps.

## Verification

Run `node --test tests/pwa.test.cjs` from `app` for the manifest fields, the
icons it names, the template placeholders, the prompt hand-off between the
template and the hook, and the worker's caching rules. Then
`bun run preview:web` and check Application → Manifest and → Service Workers in
the browser's dev tools.
