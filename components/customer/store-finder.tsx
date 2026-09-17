"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ZIK_STORES,
  formatDistanceKm,
  getStoreOpenState,
  resolveAreaAnchor,
  straightLineDistanceKm,
  type ZikStore
} from "@/lib/shared/stores";
import { Alert, Button, Card, StatusBadge } from "@/components/customer/ui";
import { ClockIcon, LocateIcon, PinIcon, SearchIcon } from "@/components/customer/icons";

type Origin = { label: string; lat: number; lng: number } | null;
type GeoState = "idle" | "locating" | "denied" | "unavailable" | "timeout";

// London bounding box used only to project coordinates onto the schematic.
const BOUNDS = { minLat: 51.44, maxLat: 51.56, minLng: -0.16, maxLng: 0.02 };

function project(store: ZikStore): { x: number; y: number } {
  const x = ((store.lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = (1 - (store.lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(6, Math.min(94, y)) };
}

export function StoreFinder({ selectMode = false }: { selectMode?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<Origin>(null);
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const now = new Date();

  const stores = useMemo(() => {
    const withMeta = ZIK_STORES.map((store) => ({
      store,
      open: getStoreOpenState(store, now),
      distanceKm: origin ? straightLineDistanceKm(origin, store) : null
    }));
    if (origin) {
      withMeta.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }
    return withMeta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin]);

  function runSearch(raw: string) {
    setQuery(raw);
    const anchor = resolveAreaAnchor(raw);
    if (raw.trim() === "") {
      setOrigin(null);
      setSearchNote(null);
      return;
    }
    if (anchor) {
      setOrigin(anchor);
      setSearchNote(`Showing stores near ${anchor.label}`);
      setGeoState("idle");
    } else {
      setSearchNote(
        "No match for that postcode or area in the demo catalogue. Try W1, EC1, NW1, E20 or SW9."
      );
    }
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoState("unavailable");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          label: "your location",
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGeoState("idle");
        setSearchNote("Showing stores near your location");
        setQuery("");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setGeoState("denied");
        else if (error.code === error.TIMEOUT) setGeoState("timeout");
        else setGeoState("unavailable");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }

  function choose(store: ZikStore) {
    setConfirming(true);
    // Persist selection so it survives refresh / back navigation, then carry
    // it into the physical onboarding flow which creates the server session.
    try {
      window.localStorage.setItem("zikpass-selected-store", store.id);
    } catch {
      /* storage may be unavailable; selection still passes via the URL */
    }
    router.push(`/get-pass?store_id=${encodeURIComponent(store.id)}` as never);
  }

  const geoMessage: Record<Exclude<GeoState, "idle" | "locating">, string> = {
    denied:
      "Location permission was declined. Search by postcode or area instead - every store below still works.",
    unavailable: "Your device did not return a location. Use postcode or area search instead.",
    timeout: "Locating took too long. Try again, or search by postcode or area."
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <label htmlFor="store-search" className="sr-only" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4a0f3c6e1731-1" : undefined}>
          Search by postcode or area
        </label>
        <div className="flex items-center gap-2 rounded-[var(--zk-r-md)] border border-[var(--zk-line-strong)] bg-[var(--zk-card)] px-3.5 focus-within:border-[var(--zk-focus)]">
          <SearchIcon className="h-[18px] w-[18px] text-[var(--zk-text-faint)]" />
          <input
            id="store-search"
            value={query}
            onChange={(event) => runSearch(event.target.value)}
            inputMode="text"
            autoComplete="postal-code"
            placeholder="Postcode or area, e.g. EC1"
            className="h-12 w-full bg-transparent text-[15px] text-[var(--zk-text)] placeholder:text-[var(--zk-text-faint)] focus:outline-none"
          />
        </div>
        <button
          onClick={useMyLocation}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--zk-line-strong)] bg-[var(--zk-card)] px-3.5 py-2 text-[13px] font-semibold text-[var(--zk-text)] hover:bg-[var(--zk-sunken)]"
        >
          <LocateIcon className="h-4 w-4" />
          {geoState === "locating" ? "Locating..." : "Use my location"}
        </button>
      </div>

      {geoState !== "idle" && geoState !== "locating" ? (
        <Alert tone="caution">{geoMessage[geoState]}</Alert>
      ) : null}
      {searchNote ? (
        <p className="px-1 text-[13px] text-[var(--zk-text-soft)]">{searchNote}</p>
      ) : null}

      {/* Schematic map: coordinate-plotted pins, not real map tiles. */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--zk-line)] px-3.5 py-2">
          <span className="text-[12px] font-semibold text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4a0f3c6e1731-2" : undefined}>Schematic map</span>
          <StatusBadge tone="neutral">Demo locations</StatusBadge>
        </div>
        <div
          className="relative aspect-[3/2] w-full bg-[var(--zk-sunken)]"
          style={{
            backgroundImage:
              "linear-gradient(var(--zk-line) 1px, transparent 1px), linear-gradient(90deg, var(--zk-line) 1px, transparent 1px)",
            backgroundSize: "28px 28px"
          }}
        >
          {origin ? (
            <Dot
              x={project({ ...ZIK_STORES[0], lat: origin.lat, lng: origin.lng }).x}
              y={project({ ...ZIK_STORES[0], lat: origin.lat, lng: origin.lng }).y}
              label={origin.label}
            />
          ) : null}
          {stores.map(({ store }) => {
            const p = project(store);
            return (
              <button
                key={store.id}
                onClick={() => setSelectedId(store.id)}
                aria-label={`${store.name}, ${store.area}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                <span
                  className={
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 transition " +
                    (selectedId === store.id
                      ? "border-ink bg-[var(--zk-accent)] scale-110"
                      : "border-[var(--zk-card)] bg-ink")
                  }
                >
                  <PinIcon
                    className={
                      "h-4 w-4 " +
                      (selectedId === store.id ? "text-ink" : "text-[var(--zk-accent)]")
                    }
                  />
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <ul className="space-y-2.5">
        {stores.map(({ store, open, distanceKm }) => (
          <li key={store.id}>
            <Card
              className={
                "p-4 transition " +
                (selectedId === store.id ? "ring-2 ring-ink" : "")
              }
            >
              <button
                data-testid="store-card"
                data-store-id={store.id}
                className="flex w-full items-start gap-3 text-left"
                onClick={() => setSelectedId(selectedId === store.id ? null : store.id)}
                aria-expanded={selectedId === store.id}
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--zk-sunken)]">
                  <PinIcon className="h-[18px] w-[18px] text-[var(--zk-text-soft)]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-bold text-[var(--zk-text)]">
                      {store.name}
                    </span>
                    {distanceKm !== null ? (
                      <span className="shrink-0 text-[12px] font-semibold text-[var(--zk-text-faint)]">
                        {formatDistanceKm(distanceKm)}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-[var(--zk-text-soft)]">
                    {store.addressLine}, {store.postcode}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5">
                    <ClockIcon
                      className={
                        "h-3.5 w-3.5 " + (open.open ? "text-[var(--zk-positive)]" : "text-[var(--zk-caution)]")
                      }
                    />
                    <span
                      className={
                        "text-[12px] font-semibold " +
                        (open.open ? "text-[var(--zk-positive)]" : "text-[var(--zk-caution)]")
                      }
                    >
                      {open.label}
                    </span>
                  </span>
                </span>
              </button>

              {selectedId === store.id ? (
                <div className="mt-3 border-t border-[var(--zk-line)] pt-3">
                  <p className="text-[13px] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4a0f3c6e1731-3" : undefined}>
                    Bring photo ID (passport, UK/EU driving licence, or PASS-accredited card).
                    A clerk checks it in person - it is not scanned or stored.
                  </p>
                  {selectMode ? (
                    <Button
                      className="mt-3 w-full"
                      loading={confirming}
                      onClick={() => choose(store)}
                    >
                      Choose this store
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="mt-3 w-full"
                      onClick={() => choose(store)}
                    >
                      Get a pass here
                    </Button>
                  )}
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      <p className="px-1 pb-2 text-[12px] leading-relaxed text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-4a0f3c6e1731-4" : undefined}>
        All locations shown are fictional demo sites for this prototype and are not real
        retail partners. Distances are straight-line estimates, not walking times.
      </p>
    </div>
  );
}

function Dot({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <span
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
      aria-label={label}
    >
      <span className="block h-3.5 w-3.5 rounded-full border-2 border-[var(--zk-card)] bg-[var(--zk-focus)] shadow" />
    </span>
  );
}
