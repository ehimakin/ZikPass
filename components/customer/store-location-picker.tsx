"use client";
import { useEffect, useRef, useState } from 'react';
import { loadPlaces } from '@/components/customer/support/google-business-search';
import { ZIK_STORES, straightLineDistanceKm, formatDistanceKm } from '@/lib/shared/stores';
import { Button } from '@/components/customer/ui';
type Point = { lat: number; lng: number };
type MapView = { panTo(point: Point): void; setZoom(zoom: number): void };
type StoreOverlay = {
  onAdd(): void; draw(): void; onRemove(): void; setMap(map: MapView | null): void;
  getPanes(): { overlayMouseTarget: HTMLElement } | null;
  getProjection(): { fromLatLngToDivPixel(point: Point): { x: number; y: number } | null };
};
type MapsLibrary = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => MapView;
  OverlayView: { new (): StoreOverlay; preventMapHitsAndGesturesFrom(element: HTMLElement): void };
};
type GoogleWindow = Window & { google?: { maps: { importLibrary(name: string): Promise<unknown> } } };

export function StoreLocationPicker({ storeId, onSelect, audience = "staff" }: { storeId: string; onSelect(id: string): void; audience?: "staff" | "customer" }) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const [origin, setOrigin] = useState<Point | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const searchHost = useRef<HTMLDivElement>(null);
  const map = useRef<MapView | null>(null);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  const currentStore = useRef(storeId);
  currentStore.current = storeId;
  const originRef = useRef(origin);
  originRef.current = origin;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    if (!enabled || !key) return;
    let active = true;
    let searchWidget: HTMLElement | undefined;
    let searchSequence = 0;
    const markers: StoreOverlay[] = [];
    setStatus('Loading store map…');
    void loadPlaces(key).then(async places => {
      const google = (window as GoogleWindow).google;
      if (!google) throw new Error();
      const maps = await google.maps.importLibrary('maps') as MapsLibrary;
      if (!active || !host.current) return;
      const selected = ZIK_STORES.find(store => store.id === currentStore.current) ?? ZIK_STORES[0];
      const view = new (maps as MapsLibrary).Map(host.current, {
        center: originRef.current ?? { lat: selected.lat, lng: selected.lng }, zoom: 11,
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false, gestureHandling: 'cooperative'
      });
      map.current = view;
      searchWidget = new places.PlaceAutocompleteElement({ requestedRegion: 'gb' });
      searchWidget.setAttribute('aria-label', 'Search for a place or address');
      searchWidget.style.colorScheme = 'light';
      searchWidget.style.width = '100%';
      searchWidget.addEventListener('gmp-error', () => {
        if (active) setStatus('Place search is unavailable. Use the map pins or store list.');
      });
      searchWidget.addEventListener('gmp-select', event => {
        const sequence = ++searchSequence;
        const place = (event as Event & { placePrediction: { toPlace(): { displayName?: string; location?: { lat(): number; lng(): number }; fetchFields(options: { fields: string[] }): Promise<unknown> } } }).placePrediction.toPlace();
        void place.fetchFields({ fields: ['displayName', 'location'] }).then(() => {
          if (!active || sequence !== searchSequence) return;
          if (!place.location) throw new Error('Location unavailable');
          const point = { lat: place.location.lat(), lng: place.location.lng() };
          setOrigin(point); view.panTo(point); view.setZoom(12);
          setStatus(`Showing configured stores nearest ${place.displayName ?? 'this place'}. Google search results are not necessarily Zik partners.`);
        }).catch(() => { if (active && sequence === searchSequence) setStatus('Could not locate that place. Try another result or use the store list.'); });
      });
      searchHost.current?.appendChild(searchWidget);
      // DOM overlays keep pins accessible without requiring a cloud Map ID.
      for (const store of ZIK_STORES) {
        const marker = new maps.OverlayView();
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = '●';
        button.title = store.name;
        button.setAttribute('aria-label', store.name);
        button.className = 'zik-store-map-pin';
        button.onclick = () => {
          selection.current(store.id);
          setStatus(`Selected ${store.name}.${audience === "staff" ? " Enter your staff code below." : " Store details are shown below."}`);
        };
        maps.OverlayView.preventMapHitsAndGesturesFrom(button);
        marker.onAdd = () => { marker.getPanes()?.overlayMouseTarget.appendChild(button); };
        marker.draw = () => {
          const point = marker.getProjection().fromLatLngToDivPixel({ lat: store.lat, lng: store.lng });
          if (!point) { button.hidden = true; return; }
          button.hidden = false;
          button.style.left = `${point.x}px`;
          button.style.top = `${point.y}px`;
        };
        marker.onRemove = () => { button.remove(); button.onclick = null; };
        markers.push(marker);
        marker.setMap(view);
      }
      setStatus('Select a store pin, or use your location to find nearby stores.');
    }).catch(() => { if (active) setStatus('The map could not load. You can still choose your store from the list below.'); });
    return () => { active = false; searchWidget?.remove(); markers.forEach(marker => marker.setMap(null)); map.current = null; };
  }, [enabled, key, audience]);
  useEffect(() => {
    const store = ZIK_STORES.find(item => item.id === storeId);
    if (store) map.current?.panTo({ lat: store.lat, lng: store.lng });
  }, [storeId]);
  function locate() {
    if (!navigator.geolocation) { setStatus('Location is unavailable. Choose a store from the list below.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setOrigin(point); setLocating(false);
      map.current?.panTo(point); map.current?.setZoom(12);
      setStatus('Nearby stores are listed below. Choose your store to continue.');
    }, error => {
      setLocating(false);
      setStatus(error.code === 1 ? 'Location permission was denied. You can still select a store manually.' : 'Could not get your location. Try again or choose a store manually.');
    }, { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false });
  }
  const nearby = origin ? ZIK_STORES.map(store => ({ store, distance: straightLineDistanceKm(origin, store) })).sort((a, b) => a.distance - b.distance).slice(0, 3) : [];
  return <section aria-label="Find your store" className="space-y-3 rounded-xl bg-[var(--zk-sunken)] p-4">
    <h2 className="font-bold">Find your store</h2>
    <div className="flex flex-wrap gap-2">{key && !enabled && <Button variant="secondary" onClick={() => setEnabled(true)}>Choose on map</Button>}<Button variant="secondary" loading={locating} onClick={locate}>Use my location</Button></div>
    <p className="text-xs text-[var(--zk-text-soft)]">Location is used only when requested. Opening the map shares map activity, place searches and its viewed location with Google. The current store pins are demo locations.</p>
    {enabled && <div ref={searchHost} className="min-w-0" />}
    {enabled && <div ref={host} className="h-72 w-full rounded-lg" aria-label="Store map" />}
    {!key && <p className="text-sm">Map unavailable. Use your location or the store list below.</p>}
    {status && <p role="status" className="text-sm">{status}</p>}
    {nearby.length > 0 && <ul className="space-y-2">{nearby.map(({ store, distance }) => <li key={store.id}><button type="button" aria-pressed={storeId === store.id} className="w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-left text-sm focus-visible:outline focus-visible:outline-2" onClick={() => onSelect(store.id)}>{store.name}<span className="block text-xs text-[var(--zk-text-soft)]">{formatDistanceKm(distance)}</span></button></li>)}</ul>}
  </section>;
}
