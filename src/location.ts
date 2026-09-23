import { Notice, requestUrl } from "obsidian";
import { Coordinates } from "./types";

type IpWhoResponse = {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country?: string;
};
type IpApiResponse = {
  error?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  region?: string;
  country_name?: string;
};

export function valid(coordinates: Coordinates): boolean {
  return Number.isFinite(coordinates.latitude) && coordinates.latitude >= -90 && coordinates.latitude <= 90 &&
    Number.isFinite(coordinates.longitude) && coordinates.longitude >= -180 && coordinates.longitude <= 180;
}

function asLocation(data: IpWhoResponse | IpApiResponse) {
  const coordinates = { latitude: data.latitude ?? NaN, longitude: data.longitude ?? NaN };
  if (!valid(coordinates)) throw new Error("The provider returned invalid coordinates.");
  const place = data as IpWhoResponse & IpApiResponse;
  const name = [place.city, place.region, place.country || place.country_name].filter(Boolean).join(", ");
  return { coordinates, name: name || "Approximate IP location" };
}

/** Use Obsidian's native HTTP API to bypass renderer CORS restrictions. */
export async function detectLocation(announceSuccess = true): Promise<{ coordinates: Coordinates; name: string }> {
  const providers: Array<() => Promise<{ coordinates: Coordinates; name: string }>> = [
    async () => {
      const response = await requestUrl({ url: "https://ipwho.is/", method: "GET" });
      const data = response.json as IpWhoResponse;
      if (data.success === false) throw new Error("IPWho could not locate this network.");
      return asLocation(data);
    },
    async () => {
      const response = await requestUrl({ url: "https://ipapi.co/json/", method: "GET" });
      const data = response.json as IpApiResponse;
      if (data.error) throw new Error("ipapi could not locate this network.");
      return asLocation(data);
    },
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (announceSuccess) new Notice("Approximate location detected: " + result.name + ". Review it in settings.", 10_000);
      return result;
    } catch (error) {
      console.warn("Salah & Hijri Times IP location provider failed.", error);
    }
  }

  new Notice("Automatic location detection failed. Enter latitude and longitude in plugin settings.", 10_000);
  throw new Error("No IP location provider returned valid coordinates.");
}
