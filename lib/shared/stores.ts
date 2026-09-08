/**
 * Shared ZikPass store catalogue.
 *
 * This is the single source of truth for verification points, used by both the
 * customer store finder and the server session/verifier layer. Every store here
 * is a FICTIONAL demo location - the addresses, coordinates and opening hours
 * are invented for the prototype and do not represent real retail partners.
 *
 * Coordinates are real-world lat/lng for plausible London placement so that
 * straight-line distance and map rendering behave sensibly. They are not tied
 * to any real business at that address.
 */

export interface StoreHours {
  /** 0 = Sunday ... 6 = Saturday */
  day: number;
  /** Minutes past local midnight, e.g. 540 = 09:00. `null` open == closed all day. */
  open: number | null;
  close: number | null;
}

export interface ZikStore {
  id: string;
  name: string;
  /** Short area label for lists, e.g. "Central London". */
  area: string;
  addressLine: string;
  postcode: string;
  city: string;
  lat: number;
  lng: number;
  /** IANA timezone for open/closed calculation. */
  timezone: string;
  hours: StoreHours[];
  /** Services this location can perform for a customer. */
  services: Array<"physical_id_check" | "retail_card" | "device_extension">;
  /**
   * Operator/verifier identity that staffs this store in the demo. Each store
   * has its own clerk identity so a session created for one store cannot be
   * confirmed by staff scoped to another (enforced server-side).
   */
  operator: {
    verifierId: string;
    /** Kept uniform across demo stores so persisted sessions stay comparable. */
    locationId: "front-desk";
  };
}

const WEEKDAY_HOURS: StoreHours[] = [
  { day: 1, open: 9 * 60, close: 20 * 60 },
  { day: 2, open: 9 * 60, close: 20 * 60 },
  { day: 3, open: 9 * 60, close: 20 * 60 },
  { day: 4, open: 9 * 60, close: 21 * 60 },
  { day: 5, open: 9 * 60, close: 21 * 60 },
  { day: 6, open: 9 * 60, close: 19 * 60 },
  { day: 0, open: 11 * 60, close: 17 * 60 }
];

export const ZIK_STORES: ZikStore[] = [
  {
    id: "zik-london-001",
    name: "Zik Oxford Street",
    area: "Central London",
    addressLine: "128 Oxford Street",
    postcode: "W1D 1LT",
    city: "London",
    lat: 51.5163,
    lng: -0.1421,
    timezone: "Europe/London",
    hours: WEEKDAY_HOURS,
    services: ["physical_id_check", "retail_card", "device_extension"],
    // Historical demo identity - kept stable so existing regression tests hold.
    operator: { verifierId: "demo-clerk-terminal-001", locationId: "front-desk" }
  },
  {
    id: "zik-london-002",
    name: "Zik Camden",
    area: "North London",
    addressLine: "43 Camden High Street",
    postcode: "NW1 7JH",
    city: "London",
    lat: 51.5366,
    lng: -0.1406,
    timezone: "Europe/London",
    hours: WEEKDAY_HOURS,
    services: ["physical_id_check", "device_extension"],
    operator: { verifierId: "demo-clerk-camden", locationId: "front-desk" }
  },
  {
    id: "zik-london-003",
    name: "Zik Shoreditch",
    area: "East London",
    addressLine: "12 Old Street",
    postcode: "EC1V 9BE",
    city: "London",
    lat: 51.5255,
    lng: -0.0876,
    timezone: "Europe/London",
    hours: WEEKDAY_HOURS,
    services: ["physical_id_check", "retail_card", "device_extension"],
    operator: { verifierId: "demo-clerk-shoreditch", locationId: "front-desk" }
  },
  {
    id: "zik-london-004",
    name: "Zik Stratford",
    area: "East London",
    addressLine: "Montfichet Road, Westfield",
    postcode: "E20 1EJ",
    city: "London",
    lat: 51.5434,
    lng: -0.0038,
    timezone: "Europe/London",
    hours: WEEKDAY_HOURS,
    services: ["physical_id_check", "device_extension"],
    operator: { verifierId: "demo-clerk-stratford", locationId: "front-desk" }
  },
  {
    id: "zik-london-005",
    name: "Zik Brixton",
    area: "South London",
    addressLine: "7 Brixton Road",
    postcode: "SW9 6BU",
    city: "London",
    lat: 51.4626,
    lng: -0.1145,
    timezone: "Europe/London",
    hours: WEEKDAY_HOURS,
    services: ["physical_id_check", "retail_card"],
    operator: { verifierId: "demo-clerk-brixton", locationId: "front-desk" }
  }
];

export function getStoreById(id: string | null | undefined): ZikStore | undefined {
  if (!id) return undefined;
  return ZIK_STORES.find((store) => store.id === id);
}

/** Haversine straight-line distance in kilometres. */
export function straightLineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatDistanceKm(km: number): string {
  if (km < 0.1) return "Nearby";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  return `${km.toFixed(1)} km away`;
}

export interface StoreOpenState {
  open: boolean;
  /** Human label, e.g. "Open until 20:00" or "Closed - opens 09:00 Mon". */
  label: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getStoreOpenState(store: ZikStore, now: Date = new Date()): StoreOpenState {
  // Compute local wall-clock time in the store timezone.
  const local = new Date(now.toLocaleString("en-US", { timeZone: store.timezone }));
  const day = local.getDay();
  const minutes = local.getHours() * 60 + local.getMinutes();
  const today = store.hours.find((h) => h.day === day);

  if (today && today.open !== null && today.close !== null) {
    if (minutes >= today.open && minutes < today.close) {
      return { open: true, label: `Open until ${formatMinutes(today.close)}` };
    }
    if (minutes < today.open) {
      return { open: false, label: `Closed - opens ${formatMinutes(today.open)}` };
    }
  }

  // Find the next day with opening hours.
  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDay = (day + offset) % 7;
    const slot = store.hours.find((h) => h.day === nextDay && h.open !== null);
    if (slot && slot.open !== null) {
      const dayLabel = offset === 1 ? "tomorrow" : DAY_LABELS[nextDay];
      return { open: false, label: `Closed - opens ${formatMinutes(slot.open)} ${dayLabel}` };
    }
  }

  return { open: false, label: "Closed" };
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Deterministic fictional London postcode/area anchors for the demo search.
 * Real geocoding is an optional later provider; this keeps search working
 * offline without shipping a geocoding dependency.
 */
export const DEMO_AREA_ANCHORS: Array<{ query: string; label: string; lat: number; lng: number }> = [
  { query: "w1", label: "Oxford Circus, W1", lat: 51.5152, lng: -0.1419 },
  { query: "wc2", label: "Covent Garden, WC2", lat: 51.5129, lng: -0.124 },
  { query: "nw1", label: "Camden Town, NW1", lat: 51.5392, lng: -0.1426 },
  { query: "ec1", label: "Old Street, EC1", lat: 51.5255, lng: -0.0876 },
  { query: "ec2", label: "Liverpool Street, EC2", lat: 51.5175, lng: -0.0827 },
  { query: "e1", label: "Whitechapel, E1", lat: 51.5165, lng: -0.0616 },
  { query: "e20", label: "Stratford, E20", lat: 51.5434, lng: -0.0038 },
  { query: "sw9", label: "Brixton, SW9", lat: 51.4626, lng: -0.1145 },
  { query: "se1", label: "Waterloo, SE1", lat: 51.5033, lng: -0.1145 },
  { query: "n1", label: "Islington, N1", lat: 51.5362, lng: -0.1033 },
  { query: "london", label: "Central London", lat: 51.5145, lng: -0.1265 }
];

export function resolveAreaAnchor(raw: string): { label: string; lat: number; lng: number } | null {
  const q = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!q) return null;
  // Exact prefix match on the outward postcode or area name.
  const direct = DEMO_AREA_ANCHORS.find(
    (anchor) => q.startsWith(anchor.query) || anchor.query.startsWith(q)
  );
  if (direct) return { label: direct.label, lat: direct.lat, lng: direct.lng };
  const byLabel = DEMO_AREA_ANCHORS.find((anchor) => anchor.label.toLowerCase().includes(q));
  if (byLabel) return { label: byLabel.label, lat: byLabel.lat, lng: byLabel.lng };
  return null;
}
