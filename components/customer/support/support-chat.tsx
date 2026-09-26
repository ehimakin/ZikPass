"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { ZikLogoMark } from "@/components/zik-logo";

// Local preview content only. Replace this layer with a server-backed provider
// integration when chat is enabled; provider credentials must stay server-side.
const TOPICS = [
  { title: "Recover my account", answer: "Lost your phone and Zik Card? If you saved your 24-word recovery phrase and enabled a backup, open the recovery screen on your replacement device. Only enter your words there. Support cannot retrieve them or decrypt your backup.", href: "/account-recovery/restore", action: "Open recovery" },
  { title: "Something isn’t working", answer: "Keep your Vault and browser storage intact. Note what happened, the steps you tried and any error reference, then create a private help ticket so the team can investigate.", href: "/help#contact-support", action: "Create a help ticket" },
  { title: "How support works", answer: "The Zik team can help through a private ticket. Save your ticket link and check it for replies. Automated chat and email notifications are not available yet.", href: "/help/policy", action: "Read the support policy" }
] as const;

function ChatIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5a9.5 9.5 0 0 1 19 0Z" /><path d="M7 10h10M7 14h6" /></svg>;
}

export function SupportChat() {
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [topic, setTopic] = useState<number | null>(null);
  const selected = topic === null ? null : TOPICS[topic];
  function close() { dialog.current?.close(); }

  return <>
    <button ref={launcher} type="button" aria-label="Open Zik support chat" aria-haspopup="dialog" aria-controls="zik-support-chat" onClick={() => { setTopic(null); dialog.current?.showModal(); }}
      className="fixed right-4 z-40 flex min-h-12 items-center gap-2 rounded-full border border-[#d9e8a1] bg-[#e9f5bc] px-4 text-sm font-bold text-[#173426] shadow-lg transition hover:bg-[#dceda0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--zk-focus)]"
      style={{ bottom: process.env.NODE_ENV === "development" ? "max(180px, calc(var(--zk-bottom-nav-height, 72px) + 12px))" : "calc(var(--zk-bottom-nav-height, 72px) + 12px)" }}>
      <ChatIcon className="h-5 w-5" /><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-1" : undefined}>Help</span>
    </button>
    <dialog key={pathname} ref={dialog} id="zik-support-chat" aria-labelledby="zik-chat-title" aria-describedby="zik-chat-description" onClose={() => launcher.current?.focus()} onClick={event => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[400px] overflow-y-auto rounded-3xl border border-[var(--zk-line)] bg-[var(--zk-canvas)] p-0 text-[var(--zk-text)] shadow-2xl backdrop:bg-black/30 sm:inset-auto sm:bottom-24 sm:right-6 sm:m-0">
      <header className="flex items-center gap-3 border-b border-[var(--zk-line)] bg-white px-5 py-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e9f5bc]"><ZikLogoMark padlock className="h-7 w-7" /></div>
        <div className="flex-1"><h2 id="zik-chat-title" className="text-base font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-2" : undefined}>Zik Support</h2><p className="mt-0.5 text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-3" : undefined}>Chat assistant · Coming soon</p></div>
        <button type="button" autoFocus onClick={close} aria-label="Close support chat" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[var(--zk-sunken)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zk-focus)]"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </header>
      <div className="space-y-4 p-5">
        <p id="zik-chat-description" className="text-xs leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-4" : undefined}>A preview of your future support assistant. These are saved help tips, not live chat. No messages are sent.</p>
        <div className="rounded-2xl rounded-tl-sm border border-[var(--zk-line)] bg-white p-4"><p className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-5" : undefined}>Hi, how can we help?</p><p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-6" : undefined}>Choose a topic below, or contact the Zik team through a private help ticket.</p></div>
        <div aria-label="Support topics" className="flex flex-wrap gap-2">{TOPICS.map((item, index) => <button key={item.title} type="button" aria-pressed={topic === index} onClick={() => setTopic(index)} className={`min-h-11 rounded-full border px-3 py-2 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zk-focus)] ${topic === index ? "border-[#bed47c] bg-[#e9f5bc] text-[#173426]" : "border-[var(--zk-line-strong)] bg-white hover:bg-[var(--zk-sunken)]"}`}>{item.title}</button>)}</div>
        <div aria-live="polite" aria-atomic="true">{selected ? <div className="rounded-2xl rounded-tl-sm border border-[var(--zk-line)] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-7" : undefined}>Saved help tip</p><p className="mt-2 text-sm leading-relaxed">{selected.answer}</p><Link href={selected.href as Route} onClick={close} className="mt-3 inline-flex min-h-11 items-center text-sm font-bold underline underline-offset-4">{selected.action} →</Link></div> : null}</div>
        <p className="text-xs leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-8" : undefined}>Never share recovery words, passphrases, PINs or ID images in chat or help tickets.</p>
        <Link href={"/help#contact-support" as Route} onClick={close} className="flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--zk-ink)] px-4 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zk-focus)]">Contact the support team</Link>
      </div>
      <footer className="border-t border-[var(--zk-line)] bg-white p-4"><label htmlFor="zik-chat-message" className="sr-only" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7725991f8aa6-9" : undefined}>Chat message (coming soon)</label><div className="flex items-center gap-2 rounded-2xl border border-[var(--zk-line)] bg-[var(--zk-sunken)] p-3"><input id="zik-chat-message" disabled placeholder="Messaging is coming soon…" className="min-w-0 flex-1 bg-transparent text-sm text-[var(--zk-text-soft)] disabled:cursor-not-allowed" /><button type="button" disabled aria-label="Send message (coming soon)" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e4e7dc] text-[#77816b] disabled:cursor-not-allowed"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m12 19 0-14M6 11l6-6 6 6" /></svg></button></div></footer>
    </dialog>
  </>;
}
