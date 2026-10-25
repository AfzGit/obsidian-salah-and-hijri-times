import { Notice, requestUrl } from "obsidian";
import type { Coordinates } from "./types";
import { parseIpLocation, validCoordinates } from "./coordinates";
export { validCoordinates as valid } from "./coordinates";

type Provider = {
  name: string;
  load: () => Promise<{ coordinates: Coordinates; name: string }>;
};

/** Per-provider budget; without this a stalled request blocks startup and fallback. */
const PROVIDER_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, provider: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${provider} timed out after ${PROVIDER_TIMEOUT_MS / 1000} seconds.`)),
      PROVIDER_TIMEOUT_MS,
    );
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * Detect a coarse location from the network's public IP address.
 * Uses Obsidian's native HTTP bridge for desktop/mobile CORS compatibility.
 */
export async function detectLocation(announceSuccess = true): Promise<{ coordinates: Coordinates; name: string }> {
  // Providers are tried sequentially so one provider's outage does not block the fallback.
  const providers: Provider[] = [
    {
      name: "ipwho.is",
      load: async () => {
        const response = await requestUrl({ url: "https://ipwho.is/", method: "GET" });
        if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}.`);
        const data = response.json;
        if (data?.success === false) throw new Error("ipwho.is could not locate this network.");
        return parseIpLocation(data);
      },
    },
    {
      name: "ipapi.co",
      load: async () => {
        const response = await requestUrl({ url: "https://ipapi.co/json/", method: "GET" });
        if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}.`);
        const data = response.json;
        if (data?.error) throw new Error(typeof data.reason === "string" ? data.reason : "ipapi.co could not locate this network.");
        return parseIpLocation(data);
      },
    },
  ];

  for (const provider of providers) {
    try {
      const result = await withTimeout(provider.load(), provider.name);
      if (announceSuccess) new Notice("Approximate location detected: " + result.name + ". Review it in settings.", 10_000);
      return result;
    } catch (error) {
      console.warn(`Salah & Hijri Times: ${provider.name} location lookup failed.`, error);
    }
  }

  new Notice("Automatic location detection failed. Enter latitude and longitude in plugin settings.", 10_000);
  throw new Error("No IP location provider returned valid coordinates.");
}
