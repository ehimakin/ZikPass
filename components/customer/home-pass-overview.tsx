"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { EnrollmentRecord, WalletState } from "@/lib/shared/types";
import { VerificationSeal } from "@/components/customer/verification-seal";
import { PassIcon } from "@/components/customer/icons";
import { ZikLogoMark } from "@/components/zik-logo";

export function HomePassOverview({ wallet, failed }: { wallet: WalletState | null; failed: boolean }) {
  const [enrollment, setEnrollment] = useState<EnrollmentRecord | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      if (!wallet?.enrollmentId) return;
      try {
        const response = await fetch(`/api/enrollment/${encodeURIComponent(wallet.enrollmentId)}`, { signal: controller.signal });
        if (response.ok) setEnrollment(await response.json() as EnrollmentRecord);
      } catch { /* Keep the local device summary available offline. */ }
    };
    setEnrollment(null);
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [wallet?.enrollmentId]);

  if (wallet?.credential) return <VerificationSeal credential={wallet.credential} href={"/pass" as Route} />;
  let title = "Your pass will appear here";
  let detail = "No pass saved on this device yet. One check in store gets you started.";
  let badge = "No pass yet";
  let action = "Get your pass";
  let href = "/find";

  if (failed) {
    title = "Let’s check your pass";
    detail = "We couldn’t read this device’s status. Open My Pass to try again.";
    badge = "Unavailable";
    action = "Open My Pass";
    href = "/pass";
  } else if (!wallet) {
    title = "Checking this device…";
    detail = "Looking for your saved pass and application.";
    badge = "Checking";
    action = "Open My Pass";
    href = "/pass";
  } else if (wallet.enrollmentId) {
    const status = enrollment?.status;
    badge = "Application";
    title = "Pick up where you left off";
    detail = "An application is saved on this device. Continue to check your next step.";
    action = "Continue application";
    href = "/get-pass";
    if (status === "physical_verification_pending") {
      title = "Ready for your store visit";
      detail = "Your application is waiting for an in-person ID check.";
    } else if (status === "device_auth_pending") {
      title = "Linking this device";
      detail = "Complete the device check to continue adding your pass.";
    } else if (status?.startsWith("declined_")) {
      badge = "Needs attention";
      title = "Your application wasn’t approved";
      detail = "Review your application for the outcome and available next steps.";
      action = "Review application";
    } else if (status === "verification_session_expired" || status === "retry_provider_failure") {
      badge = "Needs attention";
      detail = "Your verification needs another attempt. Continue to review the next step.";
    } else if (["manual_review_required", "approved_pending_review"].includes(status ?? "")) {
      title = "Your application is in review";
      detail = "A review is needed before your pass can be issued.";
    } else if (["approved_with_cooling_off", "credential_pending_issuance"].includes(status ?? "")) {
      title = "Your pass is being prepared";
      detail = "Your application is approved and waiting for issuance.";
    } else if (status === "issued") {
      title = "Your pass is ready to collect";
      detail = "Open My Pass to save your issued pass on this device.";
      action = "Open My Pass";
      href = "/pass";
    }
  }

  return (
    <div className="zk-verification-seal-wrap">
      <section aria-label="Pass overview for this device" className="zk-verification-seal zk-verification-seal--pending">
        <Link href={"/pass" as Route} className="zk-verification-seal-home-link" aria-label="Open My Pass" />
        <div className="zk-verification-seal-heading">
          <p className="flex items-center gap-1.5"><PassIcon className="h-[1.25em] w-[1.25em]" /> My Pass</p>
          <span className="zk-verification-seal-status"><i />{badge}</span>
        </div>

        <div className="zk-verification-seal-pending-copy">
          <ZikLogoMark className="zk-verification-seal-pending-logo" />
          <p>This device</p>
          <h2>{title}</h2>
          <p className="sr-only">{detail}</p>
        </div>

        <div className="zk-verification-seal-actions">
          <Link href={href as Route}>{action} <span aria-hidden="true">↗</span></Link>
          <Link href={"/pass" as Route} aria-label={wallet?.credential ? "Device options" : "Pass on another device?"}>Devices</Link>
        </div>
      </section>
    </div>
  );
}
