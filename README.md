# Swim Set Runner

Landscape set builder with independent lane clocks. Buildless static application.

## Use

- Save set / Save changes stores the selected lane's rounds, linked blocks, instructions and gap on this browser/device.
- Save as new creates another named set. Load fills the selected lane's builder; Use set explicitly replaces the poolside schedules.
- Legacy saved settings migrate into the named-set library once.
- Running schedules use a monotonic clock. Checkpoints record the live schedule separately from builder edits, plus elapsed time and a wall-clock timestamp.
- A refresh restores running schedules including time spent away. Paused schedules remain frozen; a resume warning continues correctly. Ended sets remain complete.
- After a refresh, tap Enable sound. Keep the app visible and the iPad unlocked for bleeps and flashes.
- Device/browser clock changes while the app is closed can affect recovery. No missed bleeps are replayed.
- Local browser data must remain available; clearing it removes saved sets and checkpoints. The app reports failed storage writes.

## Offline / iPad

Open the HTTPS app online and wait for **Offline ready**. In Safari, Share → Add to Home Screen opens it as an app. Open that installed app online once too, and wait for its own Offline ready status. Test airplane mode on the actual iPad before relying on it poolside.

The service worker caches only the complete, validated app shell and assets. Login pages and authorization responses are not cached as the app. Online access-denied/sign-in responses remain respected; network failures can use the previously installed app. The existing ChatGPT-hosted test site remains private; publishing this repository with GitHub Pages would create a separate public address. App and data stay on this browser/device for offline use.

On releases changing the app shell or JS, bump the cache name in `dist/sw.js`. Installation must fetch the full version before activation; older app caches are removed after successful activation. Sign-in/callback paths and unrelated requests are never intercepted.

## Validation

Run `node --test engine.test.cjs reliability.test.cjs offline.test.cjs`.

The offline tests exercise the worker with mocked network/cache APIs, including network loss and sign-in response handling. The local HTTP preview cannot install a service worker; actual airplane-mode and iPad Safari sound/wake-lock checks remain device tests.

## Run from this repository

The complete static app is in `dist/`. No build or npm install is needed. Serve that folder locally with `python3 -m http.server 8000 --directory dist`, then open `http://localhost:8000`. Service workers require HTTPS or localhost.

For GitHub Pages, publish the contents of `dist/` using GitHub Actions. Committing the code alone does not enable Pages. Browser storage belongs to each web address: saved sets on the ChatGPT-hosted site do not automatically appear on a GitHub Pages address.
