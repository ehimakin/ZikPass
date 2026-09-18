import type { ReactNode } from "react";

/**
 * Minimal branded frame for 404 / error / offline pages. No nav - these are
 * dead-ends by nature; every one gives the reader a way back.
 */
export function StatusPage({
  emoji,
  title,
  children
}: {
  emoji: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="zk-surface flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--zk-canvas)] px-6 py-10 text-center">
      <div className="w-full max-w-[380px]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-none bg-ink text-[22px] text-[var(--zk-accent)]">
          <span aria-hidden="true">{emoji}</span>
        </div>
        <h1 className="mt-5 text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]">
          {title}
        </h1>
        <div className="mt-2 text-[14px] leading-relaxed text-[var(--zk-text-soft)]">{children}</div>
      </div>
    </main>
  );
}
