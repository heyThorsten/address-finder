import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";

interface NominatimResponse {
  display_name?: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    pedestrian?: string;
    footway?: string;
    neighbourhood?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    postcode?: string;
    state?: string;
    country?: string;
  };
}

interface AddressSuggestion {
  address: string;
  details: string;
  coordinates: [number, number];
}

interface ProviderMapView {
  map: L.Map;
  marker: L.Marker;
}

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("The application root element was not found.");
}

function requireElement<T extends Element>(element: T | null, selector: string): T {
  if (!element) {
    throw new Error(`Required element ${selector} was not found.`);
  }
  return element;
}

app.innerHTML = `
  <main class="app">
    <header class="intro">
      <h1 id="page-title">Find an address</h1>
    </header>

    <section class="reader" aria-label="Address finder">
      <form id="coordinate-form" novalidate>
        <div class="coordinate-fields">
          <label class="field">
            <span class="field-label">LATITUDE</span>
            <span class="input-wrap">
              <span class="input-symbol" aria-hidden="true">↕</span>
              <input id="latitude" name="latitude" type="number" step="any" min="-90" max="90" placeholder="e.g. 48.8584" autocomplete="off" required />
              <span class="field-unit">°</span>
            </span>
          </label>
          <label class="field">
            <span class="field-label">LONGITUDE</span>
            <span class="input-wrap">
              <span class="input-symbol" aria-hidden="true">↔</span>
              <input id="longitude" name="longitude" type="number" step="any" min="-180" max="180" placeholder="e.g. 2.2945" autocomplete="off" required />
              <span class="field-unit">°</span>
            </span>
          </label>
        </div>

        <div class="source-controls">
          <button id="paste-coordinates" class="secondary-button" type="button">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7 5.5h-2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2M8 3.5h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            <span>Paste coordinates</span>
          </button>
          <button id="use-my-location" class="secondary-button location-button" type="button">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="5.5" stroke="currentColor" stroke-width="1.5" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /><path d="M10 1.5v2m0 13v2m8.5-8.5h-2m-13 0h-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
            <span>Use my location</span>
          </button>
        </div>
        <button class="search-button" type="submit">Find nearby addresses</button>
      </form>

      <div id="notice" class="notice" role="status" aria-live="polite" hidden></div>

      <section id="results" class="results" aria-labelledby="results-heading" hidden>
        <div class="section-heading results-heading">
          <div>
            <h2 id="results-heading">Address</h2>
          </div>
        </div>
        <div class="provider-results">
          <section class="provider-results-panel" aria-labelledby="nominatim-heading">
            <div class="provider-results-title">
              <h3 id="nominatim-heading">Closest match</h3>
            </div>
            <p id="nominatim-status" class="provider-result-status" role="status" aria-live="polite" hidden></p>
            <fieldset id="nominatim-suggestion-list" class="suggestion-list">
              <legend class="visually-hidden">Address suggestion</legend>
            </fieldset>
            <div class="provider-map">
              <div id="nominatim-map-canvas" class="provider-map-canvas" role="application" aria-label="Interactive map. Drag the marker or click the map to change coordinates."></div>
              <p id="nominatim-map-address" class="provider-map-address"></p>
            </div>
          </section>
        </div>
        <label class="field manual-field" for="manual-address">
          <span class="field-label">YOUR SELECTED ADDRESS</span>
          <input id="manual-address" name="address" type="text" placeholder="Select a suggestion or enter an address" autocomplete="street-address" />
        </label>
        <div id="selection-confirmation" class="selection-confirmation" hidden>
          <span class="confirmation-icon" aria-hidden="true">✓</span>
          <span><strong>Address selected</strong><span id="selected-summary"></span></span>
        </div>
      </section>

    </section>
  </main>
`;

const form = requireElement(document.querySelector<HTMLFormElement>("#coordinate-form"), "#coordinate-form");
const latitudeInput = requireElement(document.querySelector<HTMLInputElement>("#latitude"), "#latitude");
const longitudeInput = requireElement(document.querySelector<HTMLInputElement>("#longitude"), "#longitude");
const pasteCoordinatesButton = requireElement(document.querySelector<HTMLButtonElement>("#paste-coordinates"), "#paste-coordinates");
const locationButton = requireElement(document.querySelector<HTMLButtonElement>("#use-my-location"), "#use-my-location");
const locationButtonText = requireElement(locationButton.querySelector<HTMLSpanElement>("span"), "#use-my-location span");
const notice = requireElement(document.querySelector<HTMLDivElement>("#notice"), "#notice");
const results = requireElement(document.querySelector<HTMLElement>("#results"), "#results");
const nominatimSuggestionList = requireElement(document.querySelector<HTMLFieldSetElement>("#nominatim-suggestion-list"), "#nominatim-suggestion-list");
const nominatimStatus = requireElement(document.querySelector<HTMLParagraphElement>("#nominatim-status"), "#nominatim-status");
const nominatimMap = requireElement(document.querySelector<HTMLDivElement>("#nominatim-map-canvas"), "#nominatim-map-canvas");
const nominatimMapAddress = requireElement(document.querySelector<HTMLParagraphElement>("#nominatim-map-address"), "#nominatim-map-address");
const manualAddress = requireElement(document.querySelector<HTMLInputElement>("#manual-address"), "#manual-address");
const confirmation = requireElement(document.querySelector<HTMLDivElement>("#selection-confirmation"), "#selection-confirmation");
const selectedSummary = requireElement(document.querySelector<HTMLSpanElement>("#selected-summary"), "#selected-summary");
let lastNominatimRequestAt = 0;
let nominatimMapView: ProviderMapView | null = null;

function getNominatimSuggestion(result: NominatimResponse): AddressSuggestion {
  const addressParts = result.address ?? {};
  const street = addressParts.road ?? addressParts.pedestrian ?? addressParts.footway;
  const title = [street, addressParts.house_number].filter(Boolean).join(" ")
    || addressParts.neighbourhood
    || addressParts.suburb
    || addressParts.city_district
    || addressParts.city
    || addressParts.town
    || addressParts.village
    || addressParts.hamlet
    || addressParts.county
    || result.display_name
    || "Unnamed location";
  const locality = addressParts.city
    ?? addressParts.town
    ?? addressParts.village
    ?? addressParts.hamlet
    ?? addressParts.county;
  const details = [
    addressParts.postcode,
    locality && locality !== title ? locality : undefined,
    addressParts.state,
    addressParts.country,
  ].filter((part): part is string => Boolean(part) && part !== title);

  return {
    address: title,
    details: details.join(", ") || (result.display_name && result.display_name !== title ? result.display_name : ""),
    coordinates: [Number(result.lon), Number(result.lat)],
  };
}

function clearNotice(): void {
  notice.hidden = true;
  notice.textContent = "";
  notice.className = "notice";
}

function showNotice(message: string, kind: "error" | "info"): void {
  notice.textContent = message;
  notice.className = `notice notice-${kind}`;
  notice.hidden = false;
}

function applyCoordinatePair(text: string): void {
  const values = text.split(",");
  const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const latitudeText = values[0]?.trim();
  const longitudeText = values[1]?.trim();

  if (
    values.length !== 2 ||
    !latitudeText ||
    !longitudeText ||
    !numberPattern.test(latitudeText) ||
    !numberPattern.test(longitudeText)
  ) {
    showNotice("Use the format latitude, longitude — for example: 50.933394, 6.923602.", "error");
    return;
  }

  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    showNotice("Latitude must be between −90 and 90, and longitude between −180 and 180.", "error");
    return;
  }

  latitudeInput.value = latitudeText;
  longitudeInput.value = longitudeText;
  results.hidden = true;
  confirmation.hidden = true;
  clearNotice();
}

function formatAddress(suggestion: AddressSuggestion): string {
  return suggestion.details
    ? `${suggestion.address}, ${suggestion.details}`
    : suggestion.address;
}

function setMapLocation(
  coordinates: [number, number],
  label: string,
): void {
  const [longitude, latitude] = coordinates;
  const mapView = nominatimMapView;
  if (!mapView) {
    return;
  }

  const location: L.LatLngExpression = [latitude, longitude];
  mapView.marker.setLatLng(location);
  mapView.map.panTo(location, { animate: false });
  nominatimMapAddress.textContent = label;
}

function selectSuggestion(suggestion: AddressSuggestion): void {
  const address = suggestion.details
    ? `${suggestion.address}, ${suggestion.details}`
    : suggestion.address;
  manualAddress.value = address;
  selectedSummary.textContent = address;
  confirmation.hidden = !address.trim();
  latitudeInput.value = suggestion.coordinates[1].toFixed(6);
  longitudeInput.value = suggestion.coordinates[0].toFixed(6);
  setMapLocation(suggestion.coordinates, formatAddress(suggestion));
}

function ensureMap(
  coordinates: [number, number],
): ProviderMapView {
  const existingMap = nominatimMapView;
  if (existingMap) {
    return existingMap;
  }

  const [longitude, latitude] = coordinates;
  const map = L.map(nominatimMap, { scrollWheelZoom: false }).setView(
    [Math.max(-85.05112878, Math.min(85.05112878, latitude)), longitude],
    16,
  );
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const marker = L.marker([latitude, longitude], {
    draggable: true,
    icon: L.divIcon({
      className: "location-marker",
      html: '<span class="location-marker-dot"></span>',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    }),
    title: "Drag to choose a location",
  }).addTo(map);

  const mapView = { map, marker };
  nominatimMapView = mapView;

  map.on("click", ({ latlng }) => {
    marker.setLatLng(latlng);
    selectMapLocation(latlng.lat, latlng.lng);
  });
  marker.on("dragend", () => {
    const location = marker.getLatLng();
    selectMapLocation(location.lat, location.lng);
  });

  return mapView;
}

function selectMapLocation(latitudeValue: number, longitudeValue: number): void {
  const latitude = Number(latitudeValue.toFixed(6));
  const longitude = Number(longitudeValue.toFixed(6));
  const coordinates: [number, number] = [longitude, latitude];
  const label = `Map location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  latitudeInput.value = String(latitude);
  longitudeInput.value = String(longitude);
  nominatimSuggestionList.replaceChildren();
  nominatimStatus.classList.remove("provider-result-error");
  nominatimStatus.textContent = "Search again to update the address.";
  nominatimStatus.hidden = false;
  manualAddress.value = "";
  selectedSummary.textContent = "";
  confirmation.hidden = true;
  setMapLocation(coordinates, label);
  showNotice("Coordinates updated. Search again to update the address.", "info");
}

function renderSuggestions(
  suggestions: AddressSuggestion[],
  container: HTMLFieldSetElement,
): void {
  container.replaceChildren();

  suggestions.forEach((suggestion, index) => {
    const label = document.createElement("label");
    label.className = "suggestion";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "address-suggestion";
    input.checked = index === 0;
    input.addEventListener("change", () => {
      selectSuggestion(suggestion);
    });

    const marker = document.createElement("span");
    marker.className = "suggestion-marker";
    marker.setAttribute("aria-hidden", "true");

    const content = document.createElement("span");
    content.className = "suggestion-content";

    const title = document.createElement("span");
    title.className = "suggestion-title";
    title.textContent = suggestion.address;

    const details = document.createElement("span");
    details.className = "suggestion-details";
    details.textContent = suggestion.details || "Address details unavailable";

    const distance = document.createElement("span");
    distance.className = "suggestion-coordinate";
    distance.textContent = `${suggestion.coordinates[1].toFixed(5)}, ${suggestion.coordinates[0].toFixed(5)}`;

    content.append(title, details);
    label.append(input, marker, content, distance);
    container.append(label);
  });

}

async function lookupNominatim(latitude: number, longitude: number): Promise<AddressSuggestion[]> {
  const waitTime = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
  if (waitTime > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, waitTime));
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  lastNominatimRequestAt = Date.now();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Nominatim address lookup failed (HTTP ${response.status}).`);
  }

  const data: NominatimResponse = await response.json();
  if (typeof data.lat !== "string" || typeof data.lon !== "string") {
    throw new Error("Nominatim returned an unexpected response.");
  }

  return [getNominatimSuggestion(data)];
}

for (const input of [latitudeInput, longitudeInput]) {
  input.addEventListener("paste", (event: ClipboardEvent) => {
    const text = event.clipboardData?.getData("text");
    if (!text?.includes(",")) {
      return;
    }

    event.preventDefault();
    applyCoordinatePair(text);
  });
}

pasteCoordinatesButton.addEventListener("click", async () => {
  if (!navigator.clipboard?.readText) {
    showNotice("Clipboard access isn’t available here. Click a coordinate field and paste with Ctrl+V or Cmd+V.", "error");
    return;
  }

  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showNotice("The clipboard is empty. Copy a latitude, longitude pair and try again.", "info");
      return;
    }
    applyCoordinatePair(text);
  } catch (error) {
    const reason = error instanceof Error ? ` ${error.message}` : "";
    showNotice(`Couldn’t read the clipboard.${reason} You can also paste directly into either coordinate field with Ctrl+V or Cmd+V.`, "error");
  }
});

locationButton.addEventListener("click", () => {
  if (!window.isSecureContext) {
    showNotice("Phone location requires HTTPS. Open this app using a trusted HTTPS address on your local network; plain HTTP addresses are blocked by the browser.", "error");
    return;
  }

  if (!navigator.geolocation) {
    showNotice("This browser does not support location access.", "error");
    return;
  }

  locationButton.disabled = true;
  locationButtonText.textContent = "Getting your location…";

  try {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        latitudeInput.value = coords.latitude.toFixed(6);
        longitudeInput.value = coords.longitude.toFixed(6);
        locationButton.disabled = false;
        locationButtonText.textContent = "Use my location";
        showNotice("Phone location found. Searching for nearby addresses…", "info");
        form.requestSubmit();
      },
      (error) => {
        locationButton.disabled = false;
        locationButtonText.textContent = "Use my location";
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied. Allow location access in your browser settings and try again."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Phone location is unavailable. Check that location services are enabled and try again."
            : "The location request timed out. Try again where your phone has a clearer GPS signal.";
        showNotice(message, "error");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    );
  } catch (error) {
    locationButton.disabled = false;
    locationButtonText.textContent = "Use my location";
    showNotice(
      error instanceof Error ? `Could not request phone location: ${error.message}` : "Could not request phone location.",
      "error",
    );
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (form.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled) {
    return;
  }
  clearNotice();
  results.hidden = true;
  confirmation.hidden = true;
  manualAddress.value = "";
  selectedSummary.textContent = "";

  const latitude = Number(latitudeInput.value);
  const longitude = Number(longitudeInput.value);

  if (
    latitudeInput.value.trim() === "" ||
    longitudeInput.value.trim() === "" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    showNotice("Enter both latitude and longitude as valid numbers.", "error");
    return;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    showNotice("Latitude must be between −90 and 90, and longitude between −180 and 180.", "error");
    return;
  }

  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!button) {
    throw new Error("The address search button could not be found.");
  }

  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = "Finding nearby addresses…";
  showNotice("Finding an address…", "info");

  try {
    const suggestions = await lookupNominatim(latitude, longitude);
    renderSuggestions(suggestions, nominatimSuggestionList);
    nominatimStatus.hidden = true;
    results.hidden = false;
    const suggestion = suggestions[0];
    const coordinates: [number, number] = suggestion?.coordinates ?? [longitude, latitude];
    ensureMap(coordinates);
    setMapLocation(
      coordinates,
      suggestion ? formatAddress(suggestion) : "Search coordinates",
    );
    requestAnimationFrame(() => {
      nominatimMapView?.map.invalidateSize();
    });

    if (suggestion) {
      selectSuggestion(suggestion);
    }

    clearNotice();
    if (!suggestion) {
      showNotice("No nearby address found. Enter an address below.", "info");
    }
  } catch (error) {
    results.hidden = false;
    nominatimSuggestionList.replaceChildren();
    nominatimStatus.hidden = true;
    const coordinates: [number, number] = [longitude, latitude];
    ensureMap(coordinates);
    setMapLocation(coordinates, "Search coordinates");
    requestAnimationFrame(() => nominatimMapView?.map.invalidateSize());
    showNotice(error instanceof Error ? error.message : "Address lookup failed.", "error");
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = "Find nearby addresses";
  }
});

manualAddress.addEventListener("input", () => {
  const address = manualAddress.value.trim();
  selectedSummary.textContent = address;
  confirmation.hidden = !address;
});
