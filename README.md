# Salah & Hijri Times

Obsidian plugin for prayer and Hijri times, customizable status bar output, daily custom events, and time notifications.

## Development install

Copy this folder to `.obsidian/plugins/salah-hijri-times`, run `npm install` and `npm run build`, then enable the plugin in Obsidian Community plugins. Use `npm run dev` while editing. Obsidian loads the compiled `main.js`.

## Location

On first launch, location detection tries two IP geolocation providers through Obsidian's native request API, which avoids renderer CORS errors. IP geolocation is approximate. If both providers fail, enter coordinates manually.

Coordinates are decimal degrees. New York City: latitude `40.7128`, longitude `-74.0060`. Look up locations on [Google Maps](https://www.google.com/maps) or [OpenStreetMap](https://www.openstreetmap.org); on Google Maps, right-click a location and select the coordinates to copy them.

## Status bar template

Tokens available in settings:

- `{next}`: next prayer, Iqama, or custom time name.
- `{time}`: event time.
- `{countdown}`: time remaining.
- `{hijri}` or `{hijri:dd/mm/yyyy}`: numeric Hijri date, for example `12/11/1448`.
- `{hijri:month}`: two-digit Hijri month number.
- `{hijri:long}`: Hijri date with month name.
- `{location}`: saved location name.

Default template: `{next}: {time} ({countdown}) · {hijri}`.

## Countdown colors

Configure the red threshold, the minute when the normal color starts, and each color. Defaults: red at 5 minutes or less, orange from 6 to 19 minutes, and normal color from 20 minutes. A blank normal color uses the Obsidian theme.

## Notifications and reminders

An Obsidian notice appears when a prayer, enabled Iqama, or custom daily event is reached. Notices stay on screen for 10 seconds. Pressing Detect location updates the settings fields without a success toast; first-run detection still reports the detected place. Notifications can be disabled; an optional locally generated sound can be enabled and its volume adjusted.

Set separate advance-notice lead times for prayer/custom events and Iqama events. Zero disables advance notices. Custom times support events such as midnight or personal daily reminders, use 24-hour `HH:mm`, and participate in the status bar, schedule, countdown, and notifications.

## Prayer and Iqama settings

Prayer times come from Aladhan using the selected named calculation method. For each prayer or Tahajjud, Iqama can be disabled, set to a fixed time, or offset from its prayer. Hijri date supports positive or negative day offsets and rollover after Maghrib or at midnight. Tahajjud is calculated at the beginning of the last third of the night.

## Data and privacy

Preferences, notification deduplication history, and coordinates are stored in Obsidian plugin data. Prayer timings use api.aladhan.com; approximate IP geolocation uses ipwho.is or ipapi.co through Obsidian's native network API.

## Modules

- `main.ts`: Obsidian lifecycle, notifications, status bar, settings, custom events, and schedule modal.
- `src/location.ts`: IP location fallback and coordinate validation.
- `src/prayer-times.ts`: prayer API, Hijri adjustment, Tahajjud, and Iqama/custom event construction.
- `src/status-template.ts`: status bar token rendering.
- `src/calculation-methods.ts`: labeled Aladhan method IDs.
- `src/time.ts`: clock math and countdown.
- `src/types.ts`: shared data types.
