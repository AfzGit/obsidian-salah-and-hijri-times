# Architecture and maintenance notes

## Runtime boundaries

The Obsidian entry point is `main.ts`. It owns plugin lifecycle, commands, settings, the status bar, minute-aligned countdown updates, and notification scheduling. Startup network work is deferred until `workspace.onLayoutReady()`.

`main.ts` was recovered from the last complete bundle. It keeps bundle-style class declarations, the generated `import_obsidian5` namespace alias, and `@ts-nocheck`. Portable logic belongs in `src/*`; treat `main.ts` as Obsidian/UI wiring and avoid moving typed calculations back into it. Saved settings are merged into `DEFAULTS` shallowly, so nested objects (Iqama rules, prayer offsets, notification rules) need explicit merging in `onload()`.

Pure calculations are kept independent from Obsidian APIs so they can run under Node's test runner:

- `src/time.ts` parses, formats, and compares local clock times.
- `src/time-wheel.ts` defines the time-picker row geometry and exact scroll offsets.
- `src/hijri-date.ts` handles rollover policy, location-local dates, and shifted Gregorian conversion dates.
- `src/schedule-events.ts` combines prayer times, Iqama rules, and valid custom events.
- `src/calendar-data.ts` validates API date records and computes fasting/Jummah markers.
- `src/prayer-times.ts` and `src/calendar.ts` make HTTP requests through Obsidian's `requestUrl()` API.

`src/location.ts` uses IP geolocation only when no coordinates are saved or when the user explicitly requests detection. `src/location-picker.ts` searches Open-Meteo and ignores stale responses when a newer query has been entered.

## Prayer and Hijri schedule

The AlAdhan API supplies the prayer times and Hijri date. The plugin sends the configured calculation method and coordinates. The plugin evaluates Maghrib using the saved location timezone. It requests Hijri conversion for the location-local Gregorian date shifted by the configured offset and optional post-Maghrib day. This avoids relying on the timings endpoint's `adjustment` query parameter (which returned the same Hijri date for -1, 0, and +1 in live checks) and preserves API-defined 29/30-day month transitions. Prayer timings remain from the unshifted local Gregorian date.

Sunset is not a separate prayer event in the schedule. Maghrib is the sunset prayer and is the only evening prayer/Iqama entry.

Last Third is calculated two-thirds of the way from Maghrib to the next Fajr. Iqama rules can be disabled, fixed, or offset; Tahajjud Qiyam can use either Last Third or Fajr as its base.

## Calendar data flow

The calendar has two navigation modes. Gregorian mode requests one Gregorian month; Hijri mode requests one Hijri month. The API response contains both dates for each day and determines whether the Hijri month has 29 or 30 days. `mapCalendarDates()` preserves the returned day count and rejects impossible date values. The UI adds leading weekday blanks only; it never invents a 30th Hijri date.

The calendar cache is in memory, keyed by endpoint, month, coordinates, calculation method, and Hijri adjustment. It holds at most 24 month responses. The selected day shows Fajr, Sunrise, Dhuhr, Asr, Maghrib (sunset), Isha, and Last Third.

Fasting and Jummah markers are independent. A day can show both a monthly-fast marker and a weekly-fast marker. Monday and Thursday use one marker style; Friday uses a separate style.

## Cross-platform behavior

The manifest sets `isDesktopOnly` to `false`. Runtime code avoids Node.js and Electron APIs. All external HTTP requests use `requestUrl()`, which is the Obsidian-supported path for desktop and mobile and avoids renderer CORS restrictions. Timers and audio use browser APIs; audio degrades quietly when the platform has no AudioContext implementation. Calendar layout and settings adapt to narrow screens.

`version-bump.mjs` uses Node's filesystem API, but it is a developer-only release script and is not bundled into `main.js`.

## Notifications and status bar

The status bar is rendered from the user template. Only the countdown span receives a dynamic CSS custom property for its configurable color. Countdown updates align to the next minute boundary; the slower schedule refresh uses the configured interval. Both timer handles are cleared when the plugin unloads.

Notification keys include the date, event kind, name, time, and reached/advance state. Saved keys prevent duplicate notices during refreshes. The key history is capped to the most recent 200 records.

Right-clicking the status bar opens a menu whose items call `commands.executeCommandById("<plugin-id>:<command-id>")`. The menu deliberately does not call modal methods directly, so keyboard shortcuts, the command palette, and the context menu all use the same command path.

## Time picker alignment

The time picker uses two native scroll containers. Five rows are visible at rest (up2, up1, middle, down1, down2) and there are two spacer rows above and below the values. With an odd visible-row count and `spacerRows = (visibleRows - 1) / 2`, the exact scroll offset for value `i` is `i * rowHeight` (38 px in the current CSS). `src/time-wheel.ts` owns that arithmetic and is unit-tested.

The modal does not centre rows by measuring `getBoundingClientRect()`: layout timing and sub-pixel scroll offsets previously left the wheel half a row off on open. Instead it waits for the first layout pass, assigns the exact `scrollTop`, and only then reveals the wheels (`is-ready`). CSS `scroll-snap-type: y mandatory`, `scroll-snap-align: center`, and a short settle debounce keep trackpad/touch scrolling on the same grid; intercepted mouse-wheel steps move by exactly one row. The row height, visible row count, and spacer count are written as CSS custom properties from the tested constants, with matching fallbacks in `styles.css`.

## Tests and builds

Run `npm test` for the pure unit tests. The suite covers time parsing and wraparound, countdown rounding, next-event selection, time-picker row geometry, Hijri rollover selection, 29/30-day month lengths, a 29-to-1 boundary, invalid dates, weekly/monthly fasting markers, and Iqama/custom event construction.

Run `npm run build` before release. This first runs `tsc --noEmit`, then creates the Obsidian `main.js` bundle. The release bundle is generated locally and is ignored by Git; attach `main.js`, `manifest.json`, and `styles.css` to the GitHub release for the matching manifest version.
