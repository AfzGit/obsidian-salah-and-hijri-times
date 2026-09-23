# Salah and Hijri Times

An Obsidian plugin for daily prayer times, Iqama, Hijri dates, a prayer calendar, and configurable reminders.

## Compatibility

The plugin supports Obsidian desktop and mobile. Runtime networking uses Obsidian's `requestUrl()` API; plugin runtime code does not use Node.js or Electron APIs. Calendar styles adapt to narrow screens. See [the architecture notes](docs/architecture.md) for implementation details.

## Install for development

Copy this folder to the Obsidian plugin folder `.obsidian/plugins/salah-hijri-times`, run **npm install** and **npm run build**, then enable the plugin in Obsidian. Run **npm run dev** to rebuild while editing. Obsidian loads the generated main.js file.

## Features

- Show the next prayer, Iqama, or custom event and its live countdown in the status bar.
- Open a prayer schedule with prayer and Iqama times, Hijri date, and location.
- Browse a calendar by Hijri month or Gregorian month, with a configurable default month style. Each day shows both dates; the 13th–15th Hijri days mark monthly fasting, Monday and Thursday mark weekly fasting, and Friday marks Jummah. Select a day to see its prayer times.
- Configure prayer calculations, Hijri offset and rollover, Iqama rules, custom daily times, countdown colors, and notifications.
- Search for a location or use approximate IP location detection.

## Location

On first launch, the plugin tries two IP geolocation services through Obsidian's native request API. IP geolocation is approximate. If both services fail, set coordinates in settings or use **Set manual location** to search for a city or postal code.

Location search uses Open-Meteo's [Geocoding API](https://open-meteo.com/en/docs/geocoding-api). Coordinates are decimal degrees. New York City: latitude `40.7128`, longitude `-74.0060`. Find coordinates on [Google Maps](https://www.google.com/maps) or [OpenStreetMap](https://www.openstreetmap.org).

## Commands

- **Set manual location**: search for and select a location.
- **Refresh all prayer and Hijri times now**: fetch a new schedule immediately.
- **Set Hijri offset**: add or subtract days from the calculated Hijri date.
- **Update Iqama times**: edit all Iqama rules in one modal.
- **Display prayer times**: open today's schedule.
- **Open prayer calendar**: browse Hijri- or Gregorian-month calendar views and view a selected day's prayer times.
- **Toggle status bar visibility**: show or hide the status bar item.

## Status bar template

Default: `{next}: {time} ({countdown}) · {hijri}`.

Available tokens:

- `{next}`: next prayer, Iqama, or custom event name.
- `{time}`: event time.
- `{countdown}`: time remaining.
- `{hijri}` or `{hijri:dd/mm/yyyy}`: numeric Hijri date, such as `12/11/1448`.
- `{hijri:month}`: two-digit Hijri month number.
- `{hijri:long}`: Hijri date with month name.
- `{location}`: saved location name.

## Notifications and reminders

An Obsidian notice can appear when a prayer, enabled Iqama, or custom event is reached. Notices stay visible for 10 seconds. Optional sound is generated locally. Set separate advance reminders for prayer/custom events and Iqama; each event's reached-time and advance notices can be enabled or disabled individually.

Custom daily times and fixed Iqama entries accept 24-hour `HH:mm` values or the adjacent time picker. The picker supports 12- and 24-hour display.

## Prayer and Hijri calculations

Prayer times and calendar dates are provided by the [AlAdhan API](https://aladhan.com/prayer-times-api), using the selected calculation method and saved coordinates. Hijri rollover compares Maghrib with the saved location's local clock and requests the corresponding location-local Gregorian date, so it remains correct when the device timezone differs from the prayer location. For offsets and post-Maghrib rollover, the plugin requests the service conversion for the shifted Gregorian day, preserving its actual Hijri month lengths. The calendar displays the service's Hijri dates with the configured day offset. Hijri rollover in the daily schedule can occur after Maghrib or at midnight.

Sunset is represented by Maghrib in the prayer schedule. A separate Sunset Iqama rule remains available and uses Maghrib as its base time.

## Development checks

Run **npm test** to execute the unit test suite. Run **npm run build** to type-check the full TypeScript project and create the main.js bundle.

The tests cover clock math, rollover and location timezones, Gregorian date shifting, calendar month lengths and boundaries, fasting markers, Iqama rules, custom times, and coordinates.

## Data and privacy

Settings, coordinates, and notification deduplication history are stored in Obsidian plugin data. The plugin sends requests to:

- `api.aladhan.com` for prayer times and calendar data.
- `ipwho.is` and `ipapi.co` for approximate IP-based location detection when no location is saved.
- `geocoding-api.open-meteo.com` for location search when the user searches for a place.

The plugin does not use client-side telemetry. Requests include location coordinates when fetching schedules or calendar data.

## License

This plugin is distributed under the MIT License. See [LICENSE](LICENSE).

## Source modules

- `main.ts`: Obsidian lifecycle, commands, notifications, status bar, settings, and schedule modal.
- `src/calendar.ts`: Hijri/Gregorian calendar, API loading, and selected-day prayer times.
- `src/calendar-data.ts`: validated calendar records and fasting/Jummah markers.
- `src/hijri-date.ts`: Hijri rollover policy and location-local clock/date helpers.
- `src/schedule-events.ts`: Iqama and custom event construction.
- `src/location.ts` and `src/location-picker.ts`: IP location fallback and place search.
- `src/coordinates.ts`: shared WGS84 coordinate validation.
- `src/prayer-times.ts`: prayer API loading, date adjustment, and Last Third calculation.
- `src/status-template.ts`: status bar token rendering.
- `src/calculation-methods.ts`: labeled AlAdhan method IDs.
- `src/time.ts`: clock math and countdown.
- `src/types.ts`: shared data types.
- `tests/plugin.test.ts`: Node test-runner coverage for platform-independent business logic.
- `docs/architecture.md`: lifecycle, data flow, cross-platform choices, and release notes.
