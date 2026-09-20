"use client";

import { useRef, useState } from "react";
import { recordCardDemoCheckout } from "@/lib/client/wallet-client";
import { Button, ButtonLink } from "./ui";

const designs = [
  { id: "lime", name: "Original Lime", colour: "#d6ef66", detail: "The original. Bright, simple, unmistakably Zik." },
  { id: "gold", name: "Vault Gold", colour: "#cbb95b", detail: "Warm gold with a clean, understated finish." },
  { id: "sand", name: "Soft Sand", colour: "#dfcfb2", detail: "A quiet neutral, designed to go everywhere." },
  { id: "tracker", name: "Zik Card Tracker", colour: "#18251b", detail: "Super-premium concept / demo · Price to be confirmed. Not available to order." },
  { id: "custom", name: "Make it yours", colour: "#d6ef66", detail: "Choose a colour and add your own short label." }
] as const;
const colours = [{ name: "Lime", value: "#d6ef66" }, { name: "Gold", value: "#cbb95b" }, { name: "Sand", value: "#dfcfb2" }, { name: "Sky", value: "#b9dce8" }];

export function CardShop() {
  const [selected, setSelected] = useState<string>("lime");
  const [colour, setColour] = useState("#d6ef66");
  const [label, setLabel] = useState("");
  const [network, setNetwork] = useState<"Apple Find My" | "Google Find Hub">("Apple Find My");
  const [review, setReview] = useState(false);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const design = designs.find(item => item.id === selected)!;
  const tracker = selected === "tracker";
  const custom = selected === "custom";
  function resetReview() { setReview(false); setComplete(false); setError(""); }
  async function completeCheckout() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (!tracker) await recordCardDemoCheckout();
      setComplete(true);
    } catch {
      setError("Couldn’t save your demo card to Wallet. Please try again.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <div className="space-y-7 py-6">
    <header className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-1" : undefined}>The physical collection</p>
      <h1 className="text-4xl font-extrabold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-2" : undefined}>A little more you.</h1>
      <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-3" : undefined}>Designer and custom Zik Cards, plus a super-premium tracker concept. Choose a look you want to keep.</p>
      <p className="border-l-4 border-[#cbb95b] bg-[var(--zk-sunken)] p-3 text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-4" : undefined}>Shop preview · Designer and custom cards: illustrative £1.99 pricing. Tracker concept: Price to be confirmed. No payment is taken and no physical card is ordered.</p>
    </header>

    <div role="img" aria-label={`${design.name} card preview${tracker ? `, concept / demo, intended network: ${network}` : ""}${custom && label.trim() ? `, labelled ${label.trim()}` : ""}`} className="relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl p-7 text-[#18251b] shadow-lg" style={{ backgroundColor: custom ? colour : design.colour, color: tracker ? "#f0df9c" : "#18251b", backgroundImage: tracker ? "linear-gradient(125deg, #111b17, #304638 60%, #111b17)" : undefined }}>
      <span aria-hidden="true" className="absolute -right-12 -top-12 h-64 w-64 rounded-full border-[28px] border-white/40" />
      <div className="relative flex items-start justify-between"><span className="text-5xl font-extrabold tracking-tighter" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-5" : undefined}>Zik.</span><span className="text-xs font-bold uppercase tracking-widest">{tracker ? "Super-premium concept" : "Card"}</span></div>
      <div className="relative space-y-2"><p className="break-words text-xl font-bold">{custom ? label.trim() || "Your own kind of Zik." : design.name}</p>{tracker ? <p className="text-sm font-semibold">Intended network: {network}</p> : null}<p className="text-xs font-semibold uppercase tracking-widest">{tracker ? "Concept / demo · Not available or certified" : "Design preview · Not a credential"}</p></div>
    </div>

    <fieldset disabled={saving}>
      <legend className="mb-3 text-xl font-bold">Choose your card</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{designs.map(item => <label key={item.id} className={`flex cursor-pointer gap-3 border p-4 ${selected === item.id ? "border-[#28623c] bg-[#28623c]/5" : "border-[var(--zk-line)]"}`}>
        <input type="radio" name="design" value={item.id} checked={selected === item.id} onChange={() => { setSelected(item.id); resetReview(); }} className="mt-1 h-4 w-4 accent-[#28623c]" />
        <span><span className="block font-bold">{item.name}</span><span className="mt-1 block text-sm text-[var(--zk-text-soft)]">{item.detail}</span></span>
      </label>)}</div>
    </fieldset>

    {tracker ? <section aria-label="Tracker concept details" className="space-y-4 border border-[#cbb95b] bg-[var(--zk-sunken)] p-5">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-6" : undefined}>Super-premium · Concept / demo</p><h2 className="mt-2 text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-7" : undefined}>Zik Card Tracker</h2></div>
      <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-8" : undefined}>A proposed tracker card, not an available or certified product. Hardware support and certification are still to be confirmed.</p>
      <fieldset aria-describedby="tracker-network-hint">
        <legend className="mb-3 font-bold">Intended finding network</legend>
        <div className="grid gap-3 sm:grid-cols-2">{(["Apple Find My", "Google Find Hub"] as const).map(option => <label key={option} className={`flex min-h-11 cursor-pointer items-center gap-3 border p-3 ${network === option ? "border-[#28623c] bg-[#28623c]/5" : "border-[var(--zk-line)]"}`}>
          <input type="radio" name="tracker-network" value={option} checked={network === option} onChange={() => { setNetwork(option); resetReview(); }} className="h-4 w-4 accent-[#28623c]" />
          <span className="font-semibold">{option}</span>
        </label>)}</div>
      </fieldset>
      <p id="tracker-network-hint" className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-9" : undefined}>Each choice represents a separate proposed hardware variant for one intended network. One card would not support both networks or switch networks after purchase.</p>
      <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-10" : undefined}>This demo only previews your selection. No tracking, pairing, payment or order is available.</p>
    </section> : null}

    {custom ? <section aria-label="Customise your card" className="space-y-4 border border-[var(--zk-line)] p-4">
      <label className="block font-semibold" htmlFor="card-label" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-11" : undefined}>Your label <span className="text-sm font-normal">(optional)</span></label>
      <input id="card-label" type="text" value={label} maxLength={24} onChange={event => { setLabel(event.target.value); resetReview(); }} placeholder="Keep it yours" className="min-h-11 w-full rounded-none border border-[var(--zk-line)] bg-transparent p-3" aria-describedby="label-hint" />
      <p id="label-hint" className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-12" : undefined}>Up to 24 characters. Avoid private information. Preview stays on this page.</p>
      <fieldset disabled={saving}><legend className="mb-2 font-semibold">Colour</legend><div className="flex flex-wrap gap-3">{colours.map(item => <label key={item.name} className="flex min-h-11 cursor-pointer items-center gap-2 border border-[var(--zk-line)] px-3"><input type="radio" name="colour" checked={colour === item.value} onChange={() => { setColour(item.value); resetReview(); }} /><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: item.value }} aria-hidden="true" />{item.name}</label>)}</div></fieldset>
    </section> : null}

    <section aria-label="Purchase summary" className="space-y-4 border-t border-[var(--zk-line)] pt-5">
      <div className="flex justify-between gap-3"><h2 className="font-bold">{design.name}</h2><p className="font-bold">{tracker ? "Price to be confirmed" : <>£1.99 <span className="text-xs font-normal" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-13" : undefined}>demo price</span></>}</p></div>
      {tracker ? <p className="text-sm">Concept / demo · Intended network: {network}. Not available or certified. Hardware support and certification are still to be confirmed.</p> : <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-14" : undefined}>A separate physical card purchase. Buying a card does not verify your age or activate a Pass. Delivery and collection options are not available yet.</p>}
      <Button size="lg" disabled={saving} onClick={() => { setReview(true); setComplete(false); }}>{tracker ? "Review tracker demo" : "Review demo purchase"}</Button>
      {review ? <div role="region" aria-label="Demo checkout" className="space-y-3 bg-[var(--zk-sunken)] p-4">
        <h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-15" : undefined}>Review your selection</h3>
        {tracker ? <><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-16" : undefined}>Zik Card Tracker · Concept / demo</p><p>Proposed hardware variant: {network}</p><p className="font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-17" : undefined}>Price to be confirmed</p><p className="text-sm">Not available or certified. Hardware support and certification are still to be confirmed. This proposed variant is intended only for {network}; it would not support both networks or switch networks after purchase.</p></> : <p>{design.name}{custom && label.trim() ? ` · ${label.trim()}` : ""} · £1.99 illustrative total</p>}
        <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2bcf8ff18514-18" : undefined}>This demonstrates checkout only. No payment details, delivery address or order will be collected.</p>
        <Button disabled={complete || saving} onClick={() => void completeCheckout()}>{saving ? "Saving demo selection…" : "Complete demo checkout"}</Button>
        {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
        <div role="status">{complete ? <p className="font-semibold">Demo complete. No charge or order was made. {tracker ? "Your wallet is unchanged." : "Wallet now shows a demo card awaiting receipt and activation. No card will be shipped."}</p> : null}</div>
      </div> : null}
    </section>
    <ButtonLink href="/wallet" variant="ghost">Back to Wallet</ButtonLink>
  </div>;
}
