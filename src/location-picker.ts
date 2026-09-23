import { App, requestUrl, SuggestModal } from "obsidian";

export interface GeocodedPlace {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
  country_code?: string;
}

type GeocodingResponse = { results?: GeocodedPlace[] };

/** Search Open-Meteo's GeoNames-backed geocoding service and return selectable places. */
/** Searchable place picker; sequence numbers discard stale results after newer input. */
export class LocationSearchModal extends SuggestModal<GeocodedPlace> {
  private searchVersion = 0;

  constructor(app: App, private readonly onChoose: (place: GeocodedPlace) => void) {
    super(app);
    this.setPlaceholder("Search for a city, town, or postal code");
    this.emptyStateText = "Type at least two characters to search.";
  }

  /** Debounce the remote search, then validate its results before displaying them. */
  async getSuggestions(query: string): Promise<GeocodedPlace[]> {
    const term = query.trim();
    const version = ++this.searchVersion;
    if (term.length < 2) return [];

    await new Promise(resolve => window.setTimeout(resolve, 250));
    if (version !== this.searchVersion) return [];

    const params = new URLSearchParams({ name: term, count: "12", language: "en", format: "json" });
    try {
      const response = await requestUrl({
        url: "https://geocoding-api.open-meteo.com/v1/search?" + params.toString(),
        method: "GET",
      });
      if (version !== this.searchVersion) return [];
      const result = response.json as GeocodingResponse;
      return (result.results || []).filter(place =>
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
      );
    } catch (error) {
      console.warn("Location search failed.", error);
      return [];
    }
  }

  renderSuggestion(place: GeocodedPlace, element: HTMLElement) {
    element.createEl("div", { text: place.name });
    const context = [place.admin1, place.country].filter(Boolean).join(", ");
    if (context) element.createEl("small", { text: context });
  }

  onChooseSuggestion(place: GeocodedPlace) {
    this.onChoose(place);
  }
}
