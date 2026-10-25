# Changelog

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
