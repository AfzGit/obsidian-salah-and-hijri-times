# Changelog

## 1.0.8

- Added a README gallery with screenshots of the calendar, commands, notifications, Iqama support, status bar customization, and countdown.
- Moved **Compatibility** and **Install for development** below the feature documentation and added `todo.md` to `.gitignore`. No plugin code changed in this release.

## 1.0.7

- Reworked the **Update Iqama times** editor into a fixed-layout table, so the prayer label, rule dropdown, time field, and buttons line up in the same columns on every row. Previously each dropdown sized itself to its selected option, which shifted the time field left or right.
- Renamed the Tahajjud offset option **Offset from dawn** to **Offset from Fajr**.
- Added the prayer names to the sentence-case lint brands so Fajr, Dhuhr, Asr, Maghrib, Isha, Sunrise, and Tahajjud keep their capitalization in UI text.

## 1.0.6

- Removed three CSS features that the community CSS lint reports as only partially supported: `scrollbar-width`, `mask-image`, and `display: contents`. The time picker fades its edge rows with gradient overlays, and the calendar day details use flex rows that keep every time right-aligned. Appearance and behaviour are unchanged.

## 1.0.5

- Restored the **Hijri** and **Iqama** capitalization in every user-facing label: the status-bar menu, prayer-times modal buttons, Iqama editor, settings, notices, and commands.
- Configured the official sentence-case lint rule to treat **Hijri**, **Iqama**, and **Salah** as proper nouns, so the project still passes with zero errors and zero warnings.

## 1.0.4

- Added **View calendar** to the prayer-times modal, alongside the existing Iqama and Hijri-offset actions.
- Added calculated **Midnight** (the midpoint between Maghrib and the next Fajr) to the daily schedule, status-bar tooltip, countdown events, and calendar day details. Midnight has no Iqama.
- Brightened the current day in the calendar with an accent-tinted background, accent border, and stronger text; it is also exposed as `aria-current="date"`.
- Hardened IP location detection: per-provider 10-second timeouts, explicit HTTP status checks, numeric-string coercion, rejection of missing/null/out-of-range and placeholder `0,0` coordinates, and a status-bar setup hint when detection fails.
- Added unit tests for midnight calculation and IP-location payload parsing.
- Rewrote the plugin entry point as fully typed TypeScript and added the official `eslint-plugin-obsidianmd` recommended configuration with `npm run lint:obsidian`. The project now passes with zero errors and zero warnings.
- Removed the two remaining `!important` declarations from `styles.css` in favour of scoped selectors, and added a tag-triggered GitHub Actions release workflow.
- Updated the README and architecture notes for the location flow, midnight, calendar highlighting, modal actions, and the automated checks.

## 1.0.3

- Added **Set Hijri offset** to the status-bar right-click menu, so all four quick actions now share the command registry.
- Rebuilt the prayer-times modal as a real table. The prayer-time column is right-aligned, so the Iqama brackets line up even when clock strings differ in length (`4:59 am` vs `12:00 pm`).
- Added **Update Iqama times** and **Set Hijri offset** buttons to the prayer-times modal. They execute the existing commands instead of duplicating modal logic.
- Updated the README and architecture notes for the new menu item, table layout, and modal buttons.

## 1.0.2

- Fixed the status-bar right-click menu. Obsidian's `onClickEvent()` binds both click and auxclick, so a right click previously opened the prayer-times modal before the context menu could appear. Non-primary buttons are now ignored by the click handler.
- Documented the `onClickEvent()`/`auxclick` quirk in the code and architecture notes.

## 1.0.1

- Fixed the time picker so the hour and minute wheels always rest on one of five aligned rows, with the selected value centred.
- Added a right-click menu to the status-bar countdown for updating Iqama times, viewing the calendar, and displaying prayer times.
- Documented the recovered-bundle entry point, nested settings merging, command delegation, and time-wheel geometry.
- Added unit tests for time-picker row geometry and padded Gregorian conversion dates.

## 1.0.0

- Initial Release
