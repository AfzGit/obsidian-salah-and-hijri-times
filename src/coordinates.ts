import type { Coordinates } from "./types";

/** Validate inclusive WGS84 latitude and longitude bounds. */
export function validCoordinates(coordinates: Coordinates): boolean {
  return Number.isFinite(coordinates.latitude) && coordinates.latitude >= -90 && coordinates.latitude <= 90 &&
    Number.isFinite(coordinates.longitude) && coordinates.longitude >= -180 && coordinates.longitude <= 180;
}

/** Fields used from the ipwho.is and ipapi.co responses. */
export interface IpLocationPayload {
  success?: boolean;
  error?: boolean | string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  city?: string;
  region?: string;
  country?: string;
  country_name?: string;
}

/**
 * Normalize either IP-location provider response.
 *
 * Missing/null coordinates must not become `0,0` (which is a valid WGS84 point
 * in the Gulf of Guinea), so only finite numbers or non-empty numeric strings
 * are accepted. `0,0` itself is treated as a provider placeholder.
 */
export function parseIpLocation(data: IpLocationPayload): { coordinates: Coordinates; name: string } {
  const toNumber = (value: unknown): number =>
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  const coordinates = { latitude: toNumber(data.latitude), longitude: toNumber(data.longitude) };
  if (!validCoordinates(coordinates)) throw new Error("The provider returned invalid coordinates.");
  if (coordinates.latitude === 0 && coordinates.longitude === 0) throw new Error("The provider returned a placeholder location.");
  const name = [data.city, data.region, data.country || data.country_name].filter(Boolean).join(", ");
  return { coordinates, name: name || "Approximate IP location" };
}
