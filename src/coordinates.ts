import type { Coordinates } from "./types";

/** Validate inclusive WGS84 latitude and longitude bounds. */
export function validCoordinates(coordinates: Coordinates): boolean {
  return Number.isFinite(coordinates.latitude) && coordinates.latitude >= -90 && coordinates.latitude <= 90 &&
    Number.isFinite(coordinates.longitude) && coordinates.longitude >= -180 && coordinates.longitude <= 180;
}
