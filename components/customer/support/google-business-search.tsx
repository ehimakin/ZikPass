"use client";

import { useEffect, useRef, useState } from 'react';

export type GoogleBusiness = { id: string; name: string; address: string };
type Place = { id: string; displayName?: string; formattedAddress?: string; fetchFields(options: { fields: string[] }): Promise<unknown> };
type PlacesLibrary = { PlaceAutocompleteElement: new (options: { requestedRegion: string }) => HTMLElement };
type MapsWindow = Window & { google?: { maps: { importLibrary(name: string): Promise<PlacesLibrary> } }; zikGoogleMapsReady?: () => void };
let loading: Promise<PlacesLibrary> | undefined;

export function loadPlaces(key: string) {
  if (loading) return loading;
  loading = new Promise<PlacesLibrary>((resolve, reject) => {
    const target = window as MapsWindow;
    if (target.google?.maps.importLibrary) {
      target.google.maps.importLibrary('places').then(resolve, reject);
      return;
    }
    const script = document.createElement('script');
    const timer = window.setTimeout(() => fail(), 15000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      delete target.zikGoogleMapsReady;
      reject(new Error('Google search could not load.'));
    }
    target.zikGoogleMapsReady = () => {
      window.clearTimeout(timer);
      delete target.zikGoogleMapsReady;
      if (!target.google) { fail(); return; }
      target.google.maps.importLibrary('places').then(resolve, reject);
    };
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, loading: 'async', v: 'weekly', callback: 'zikGoogleMapsReady' })}`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}

export function GoogleBusinessSearch({ onSelect }: { onSelect(business: GoogleBusiness): void }) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onSelect);
  callback.current = onSelect;
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState('');
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  useEffect(() => {
    if (!enabled || !key) return;
    let active = true;
    let sequence = 0;
    let widget: HTMLElement | undefined;
    setStatus('Loading Google business search…');
    void loadPlaces(key).then(library => {
      if (!active) return;
      widget = new library.PlaceAutocompleteElement({ requestedRegion: 'gb' });
      widget.setAttribute('aria-label', 'Search Google for your business');
      widget.style.width = '100%';
      widget.style.colorScheme = 'light';
      widget.addEventListener('gmp-error', () => {
        if (active) setStatus('Google search is unavailable. Enter your store details below.');
      });
      widget.addEventListener('gmp-select', event => {
        const current = ++sequence;
        const place = (event as Event & { placePrediction: { toPlace(): Place } }).placePrediction.toPlace();
        setStatus('Getting business details…');
        void place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress'] }).then(() => {
          if (!active || current !== sequence) return;
          if (!place.id || !place.displayName || !place.formattedAddress) throw new Error('Missing details');
          callback.current({ id: place.id, name: place.displayName, address: place.formattedAddress });
          setStatus('Business details added. Review and edit them below before sending.');
        }).catch(() => {
          if (active && current === sequence) setStatus('Could not get these business details. Try another result or enter them below.');
        });
      });
      host.current?.appendChild(widget);
      setStatus('');
    }).catch(() => {
      if (active) setStatus('Google search is unavailable. Enter your store details below.');
    });
    return () => { active = false; widget?.remove(); };
  }, [enabled, key]);

  return <div className="space-y-3 rounded-xl bg-[var(--zk-sunken)] p-4">
    <h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b51c9c2f1faa-1" : undefined}>Find your business on Google</h3>
    <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b51c9c2f1faa-2" : undefined}>Use your existing listing to fill in your business name and address. Choose the branch you want to register, then check the details below.</p>
    {key ? <>
      {!enabled ? <button type="button" className="rounded-xl border border-[var(--zk-line-strong)] bg-white px-4 py-3 text-sm font-semibold" onClick={() => setEnabled(true)} data-local-edit={process.env.NODE_ENV === "development" ? "ve-b51c9c2f1faa-3" : undefined}>Search with Google</button> : null}
      <div ref={host} className="min-w-0" />
      <p className="text-xs text-[var(--zk-text-soft)]">Searching sends your search text to Google. <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b51c9c2f1faa-4" : undefined}>Google Privacy Policy</a> · <a className="underline" href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noreferrer" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b51c9c2f1faa-5" : undefined}>Google Maps terms</a></p>
    </> : <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b51c9c2f1faa-6" : undefined}>Google search is currently unavailable. You can still enter your store details below.</p>}
    {status ? <p role="status" className="text-sm">{status}</p> : null}
    <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b51c9c2f1faa-7" : undefined}>Can’t find your business? Fill in the details manually. A Google listing does not verify ownership or approve your partnership.</p>
  </div>;
}
