"use client";
import { useState } from 'react';
import { StoreLocationPicker } from './store-location-picker';
import { Card, StatusBadge } from './ui';
import { ZIK_STORES } from '@/lib/shared/stores';
const services = { physical_id_check: 'In-person ID checks', retail_card: 'Physical Zik Cards', device_extension: 'Device linking' };
export function FindStoreMap() {
  const [selected, setSelected] = useState(ZIK_STORES[0].id);
  const [query, setQuery] = useState('');
  const store = ZIK_STORES.find(item => item.id === selected)!;
  const matches = ZIK_STORES.filter(item => `${item.name} ${item.area} ${item.addressLine} ${item.postcode}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="space-y-5">
    <Card className="space-y-2 p-4"><StatusBadge>Demo locations</StatusBadge><p className="text-sm">Explore the map using our fictional demo stores. Confirmed participating stores will be added when available. These pins are not places to visit for Zik services yet.</p></Card>
    <StoreLocationPicker storeId={selected} onSelect={setSelected} audience="customer" />
    <section className="space-y-3" aria-label="Store directory">
      <label className="block text-sm font-semibold">Filter stores by name, postcode or area<input type="search" value={query} onChange={event => setQuery(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3" /></label>
      <ul className="space-y-2">{matches.map(item => <li key={item.id}><button type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className="w-full rounded-xl border border-[var(--zk-line-strong)] bg-[var(--zk-card)] p-4 text-left focus-visible:outline focus-visible:outline-2 aria-pressed:ring-2 aria-pressed:ring-ink"><span className="block font-bold">{item.name}</span><span className="text-sm text-[var(--zk-text-soft)]">{item.addressLine}, {item.postcode}</span></button></li>)}</ul>
      {matches.length === 0 && <p role="status" className="text-sm">No configured stores match. Try a different name or area, or search for a place on the map.</p>}
    </section>
    <section aria-label="Selected store" className="rounded-xl border border-[var(--zk-line)] bg-[var(--zk-card)] p-5">
      <h2 className="text-xl font-bold">{store.name}</h2><p className="mt-2 text-sm">{store.addressLine}, {store.city}, {store.postcode}</p>
      <p className="mt-3 text-sm font-semibold">Demo services</p><ul className="mt-2 list-inside list-disc text-sm">{store.services.map(service => <li key={service}>{services[service]}</li>)}</ul>
      <p className="mt-3 text-xs text-[var(--zk-text-soft)]">Distances are straight-line estimates, not journey times.</p>
    </section>
  </div>;
}
