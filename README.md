# Swim Set Runner

Landscape set builder with independent lane clocks. Buildless static application.

## Use

- Save set / Save changes stores the selected lane's rounds, linked blocks, instructions and gap on this browser/device.
- Save as new creates another named set. Load fills that lane's builder; Ready to start opens the clock screen without starting a timer.
- Legacy saved settings migrate into the named-set library once.
- Running schedules use a monotonic clock. Checkpoints record the live schedule separately from builder edits, plus elapsed time and a wall-clock timestamp.
- A refresh restores running schedules including time spent away. Paused schedules remain frozen; a resume warning continues correctly. Ended sets remain complete.
- Sound is enabled automatically by Start and other page interactions. After a refresh, tap the page to restore sound. Keep the app visible and the iPad unlocked for bleeps and flashes.
- Device/browser clock changes while the app is closed can affect recovery. No missed bleeps are replayed.
- Local browser data must remain available; clearing it removes saved sets and checkpoints. The app reports failed storage writes.

## Offline / iPad

Open the HTTPS app online and wait for **Offline ready**. In Safari, Share → Add to Home Screen opens it as an app. Open that installed app online once too, and wait for its own Offline ready status. Test airplane mode on the actual iPad before relying on it poolside.

The service worker caches only the complete, validated app shell and assets. Login pages and authorization responses are not cached as the app. Online access-denied/sign-in responses remain respected; network failures can use the previously installed app. The existing ChatGPT-hosted test site remains private; publishing this repository with GitHub Pages would create a separate public address. App and data stay on this browser/device for offline use.

On releases changing the app shell or JS, bump the cache name in `sw.js`. Installation must fetch the full version before activation; older app caches are removed after successful activation. Sign-in/callback paths and unrelated requests are never intercepted.

## Validation

Run `node --test engine.test.cjs reliability.test.cjs offline.test.cjs`.

The offline tests exercise the worker with mocked network/cache APIs, including network loss and sign-in response handling. The local HTTP preview cannot install a service worker; actual airplane-mode and iPad Safari sound/wake-lock checks remain device tests.

## Run from this repository

The complete static app is at the repository root. No build or npm install is needed. Serve that folder locally with `python3 -m http.server 8000`, then open `http://localhost:8000`. Service workers require HTTPS or localhost.

For GitHub Pages, open Settings → Pages, select Deploy from a branch, choose main and /(root), then Save. No custom workflow or build is required. Browser storage belongs to each web address: saved sets on the ChatGPT-hosted site do not automatically appear on a GitHub Pages address.


## Builder and rotation

The setup page opens directly into Lane 1. Save its set, or choose Add Lane 2 at the end of that builder to reveal an independent blank builder underneath. Each lane has its own saved-set controls, rounds, blocks, instructions and gap. Remove lane removes Lane 2 from the draft setup; saved named sets remain available.

One Ready to start button at the bottom validates the visible lanes, then opens a full-width single clock or split two-lane clock screen. It never starts a timer. Each clock has its own Start / Pause / Stop. Edit sets returns to the setup page. Unchanged running sets return to their clocks without restarting; applying changed work asks before stopping current timers.

Every block has a labelled × delete button, including the last block. Incomplete drafts can be retained, but all visible lanes need valid work before Ready to start. Existing saved sets and timer checkpoints remain compatible. Live timer recovery retains the applied schedule separately from setup edits.

The app follows portrait/landscape rotation. Portrait places the master clock above five swimmer clocks and stacks two lanes vertically. Landscape preserves the wide poolside display.

## Poolside clock display

Start triggers an initial five-second countdown. Each swimmer's clock then counts up from their own departure in minutes, seconds and tenths, resetting at their next scheduled departure. The lead clock keeps counting up during the five-second warning before the next rep; the smaller next-start cue shows the countdown. Swimmers 2–5 have only their own start flash. Extra round rest counts down separately. At each swimmer's final scheduled turnaround end, their elapsed display freezes. These are running elapsed clocks, not recorded finish times.

Pause / Stop controls retain large touch targets after landscape scaling. Sound is always enabled by user interaction, with no separate sound toggle. Browser autoplay rules still require a tap after a reload before bleeps can resume.
