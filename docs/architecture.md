# Architecture and maintenance notes

## Runtime boundaries

The Obsidian entry point is `main.ts`. It owns plugin lifecycle, commands, settings, the status bar, minute-aligned countdown updates, and notification scheduling. Startup network work is deferred until `workspace.onLayoutReady()`.

`main.ts` is a typed entry point. It owns plugin lifecycle, commands, settings, the status bar, minute-aligned countdown updates, and notification scheduling. Startup network work is deferred until `workspace.onLayoutReady()`. Portable logic belongs in `src/*`; keep `main.ts` focused on Obsidian/UI wiring. Saved settings are merged into `DEFAULTS` shallowly, so nested objects (Iqama rules, prayer offsets, notification rules) and arrays (custom times, notification history) are cloned or merged explicitly in `onload()`.

The settings tab overrides `getSettingDefinitions()` with an empty list and renders imperatively through `display()`. This keeps the dynamic Iqama rows and modal editors working while satisfying the official lint rule for Obsidian 1.13+; `display()` remains the fallback for older app versions.

Pure calculations are kept independent from Obsidian APIs so they can run under Node's test runner:

- `src/time.ts` parses, formats, and compares local clock times.
- `src/time-wheel.ts` defines the time-picker row geometry and exact scroll offsets.
- `src/hijri-date.ts` handles rollover policy, location-local dates, and shifted Gregorian conversion dates.
- `src/schedule-events.ts` combines prayer times, Iqama rules, and valid custom events.
- `src/calendar-data.ts` validates API date records, computes fasting/Jummah markers, and derives Islamic midnight and Last Third from Maghrib/Fajr.
- `src/prayer-times.ts` and `src/calendar.ts` make HTTP requests through Obsidian's `requestUrl()` API.

`src/location.ts` uses IP geolocation only when no coordinates are saved or when the user explicitly requests detection. It tries `ipwho.is`, then `ipapi.co`, with a 10-second timeout per provider so one stalled request cannot block startup or the fallback. `parseIpLocation()` in `src/coordinates.ts` accepts numbers or numeric strings, rejects missing/null/out-of-range values, and rejects `0,0` as a provider placeholder. `src/location-picker.ts` searches Open-Meteo and ignores stale responses when a newer query has been entered.

## Prayer and Hijri schedule

The AlAdhan API supplies the prayer times and Hijri date. The plugin sends the configured calculation method and coordinates. The plugin evaluates Maghrib using the saved location timezone. It requests Hijri conversion for the location-local Gregorian date shifted by the configured offset and optional post-Maghrib day. This avoids relying on the timings endpoint's `adjustment` query parameter (which returned the same Hijri date for -1, 0, and +1 in live checks) and preserves API-defined 29/30-day month transitions. Prayer timings remain from the unshifted local Gregorian date.

Sunset is not a separate prayer event in the schedule. Maghrib is the sunset prayer and is the only evening prayer/Iqama entry.

Islamic midnight is calculated halfway from Maghrib to the next Fajr, and Last Third is calculated two-thirds of the way through the same night. Both are derived locally, appear in the daily schedule and calendar details, and have no Iqama rule. Iqama rules can be disabled, fixed, or offset; Tahajjud Qiyam can use either Last Third or Fajr as its base.

## Calendar data flow

The calendar has two navigation modes. Gregorian mode requests one Gregorian month; Hijri mode requests one Hijri month. The API response contains both dates for each day and determines whether the Hijri month has 29 or 30 days. `mapCalendarDates()` preserves the returned day count and rejects impossible date values. The UI adds leading weekday blanks only; it never invents a 30th Hijri date.

The calendar cache is in memory, keyed by endpoint, month, coordinates, calculation method, and Hijri adjustment. It holds at most 24 month responses. The selected day shows Fajr, Sunrise, Dhuhr, Asr, Maghrib (sunset), Isha, Midnight, and Last Third. The current day gets the `salah-calendar-today` class plus `aria-current="date"`; its accent-tinted background, accent border, and brighter text keep it visible while fasting and Jummah markers remain independent.

Fasting and Jummah markers are independent. A day can show both a monthly-fast marker and a weekly-fast marker. Monday and Thursday use one marker style; Friday uses a separate style.

## Cross-platform behavior

The manifest sets `isDesktopOnly` to `false`. Runtime code avoids Node.js and Electron APIs. All external HTTP requests use `requestUrl()`, which is the Obsidian-supported path for desktop and mobile and avoids renderer CORS restrictions. Timers and audio use browser APIs; audio degrades quietly when the platform has no AudioContext implementation. Calendar layout and settings adapt to narrow screens.

`version-bump.mjs` uses Node's filesystem API, but it is a developer-only release script and is not bundled into `main.js`.

## Notifications and status bar

The status bar is rendered from the user template. Only the countdown span receives a dynamic CSS custom property for its configurable color. Countdown updates align to the next minute boundary; the slower schedule refresh uses the configured interval. Both timer handles are cleared when the plugin unloads.

Notification keys include the date, event kind, name, time, and reached/advance state. Saved keys prevent duplicate notices during refreshes. The key history is capped to the most recent 200 records.

Right-clicking the status bar opens a menu whose items call `commands.executeCommandById("<plugin-id>:<command-id>")` through `SalahPlugin.executeCommand()`. The menu offers **Update iqama times**, **Set date offset**, **View calendar**, and **Display prayer times**. The menu deliberately does not call modal methods directly, so keyboard shortcuts, the command palette, and the context menu all use the same command path. Obsidian's `onClickEvent()` helper binds both `"click"` and `"auxclick"`; the status-bar handler must ignore non-primary buttons, otherwise a right click opens the schedule modal first and the `"contextmenu"` event lands on the modal backdrop instead of the status bar.

The prayer-times modal reuses the same command executor for its **Update iqama times**, **Set date offset**, and **View calendar** buttons. The command modal opens over the schedule modal, matching how the time picker stacks over the Iqama editor. Because the buttons go through the command registry, a future change to any command automatically applies to the menu, the buttons, and the palette.

## Schedule modal layout

The prayer-times modal renders one `<table class="salah-schedule-table">` rather than one grid per row. Each row has four cells: prayer name (`<th scope="row">`), colon, prayer time, and Iqama time. The prayer-time cell is right-aligned, so `4:59 am` and `12:00 pm` end at the same x position and the Iqama brackets line up. Per-row grids could not do this: each row sized its own columns independently, so variable-length clock strings shifted the brackets. Custom daily times span the prayer-time and Iqama columns with `colspan="2"`. Midnight is a normal schedule row with `[—]` in the Iqama column because it has no Iqama.

## Time picker alignment

The time picker uses two native scroll containers. Five rows are visible at rest (up2, up1, middle, down1, down2) and there are two spacer rows above and below the values. With an odd visible-row count and `spacerRows = (visibleRows - 1) / 2`, the exact scroll offset for value `i` is `i * rowHeight` (38 px in the current CSS). `src/time-wheel.ts` owns that arithmetic and is unit-tested.

The modal does not centre rows by measuring `getBoundingClientRect()`: layout timing and sub-pixel scroll offsets previously left the wheel half a row off on open. Instead it waits for the first layout pass, assigns the exact `scrollTop`, and only then reveals the wheels (`is-ready`). CSS `scroll-snap-type: y mandatory`, `scroll-snap-align: center`, and a short settle debounce keep trackpad/touch scrolling on the same grid; intercepted mouse-wheel steps move by exactly one row. The row height, visible row count, and spacer count are written as CSS custom properties from the tested constants, with matching fallbacks in `styles.css`.

## Tests and builds

Run `npm test` for the pure unit tests. The suite covers time parsing and wraparound, countdown rounding, next-event selection, time-picker row geometry, Hijri rollover selection, 29/30-day month lengths, a 29-to-1 boundary, invalid dates, weekly/monthly fasting markers, midnight and Last Third calculations, IP-location payload parsing, and Iqama/custom event construction.

Run `npm run build` before release. This first runs `tsc --noEmit`, then creates the Obsidian `main.js` bundle. `main.js` is ignored by Git; the release workflow builds it from source.

Run `npm run lint:obsidian` to check the source against the official `eslint-plugin-obsidianmd` recommended rules. The configuration also enables the type-checked TypeScript rules, so new `any` leaks or untyped API payloads fail the check. The repository currently reports zero errors and zero warnings.

## Release process

`.github/workflows/release.yml` runs on any pushed tag. It installs dependencies with `npm ci`, runs the tests, builds the plugin, verifies that the tag matches `manifest.json`, creates a build-provenance attestation, and publishes a GitHub release with `main.js`, `manifest.json`, and `styles.css` attached. The tag must match the manifest version exactly (for example `1.0.4`, without a `v` prefix).
