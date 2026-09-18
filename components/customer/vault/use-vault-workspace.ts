"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadWalletState } from "@/lib/client/wallet-client";
import { AnalysisClient } from "@/lib/client/vault/analysis-client";
import type { AnalysisProgress } from "@/lib/client/vault/analysis-protocol";
import type { Selection } from "@/lib/client/vault/import-sources";
import { VaultV2 } from "@/lib/client/vault/session";
import { storageStatus, type StorageEstimate } from "@/lib/client/vault/store";
import { evaluateReadiness, type ReadinessResult } from "@/lib/shared/policy/zik-id-readiness";
import { getWalletStatusSnapshot } from "@/lib/shared/wallet-state";
import { PARSER_VERSION, type Claim, type ClaimField, type ClaimSource, type Observation, type Rotation, type VaultDocument, type VaultProfileV2 } from "@/lib/shared/vault/model";

export const CONSENT_POLICY_VERSION = "zik-vault-consent/1";

export type JobState = { id: string; name: string; stage: AnalysisProgress["stage"] | "queued" | "done"; page?: number; pages?: number; error?: string; unsupported?: boolean };

export type VaultWorkspaceState = {
  profile: VaultProfileV2 | undefined;
  documents: VaultDocument[];
  observations: Observation[];
  claims: Claim[];
  readiness: ReadinessResult | undefined;
  storage: StorageEstimate | undefined;
  jobs: JobState[];
  busy: boolean;
  error: string;
};

/**
 * Holds the unlocked Vault's state for the workspace screen.
 *
 * Analysis is driven from here rather than from a component so that locking the
 * Vault can stop the worker and raise its generation in one place: a job that was
 * already running finishes into a generation that no longer matches, and its result
 * is dropped instead of being written to a locked Vault.
 */
export function useVaultWorkspace(vault: VaultV2, onLocked?: () => void) {
  const analysis = useRef(new AnalysisClient());
  const [state, setState] = useState<VaultWorkspaceState>({ profile: undefined, documents: [], observations: [], claims: [], readiness: undefined, storage: undefined, jobs: [], busy: false, error: "" });
  const [passActive, setPassActive] = useState(false);

  const refresh = useCallback(async () => {
    if (!vault.unlocked) return;
    const [profile, documents, observations, claims, storage] = await Promise.all([
      vault.readProfile(), vault.listDocuments(), vault.listObservations(), vault.listClaims(), storageStatus(),
    ]);
    setState(current => ({ ...current, profile, documents, observations, claims, storage }));
  }, [vault]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    void loadWalletState().then(wallet => { if (!cancelled) setPassActive(getWalletStatusSnapshot(wallet).credential_active); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const readiness = useMemo(() => (state.profile ? evaluateReadiness({
    documents: state.documents, observations: state.observations, claims: state.claims, pass: { active: passActive }, now: new Date(),
  }) : undefined), [passActive, state.claims, state.documents, state.observations, state.profile]);

  /** Locking stops every worker before any further write can be attempted. */
  const lock = useCallback(() => {
    analysis.current.stopAll();
    vault.lock();
    setState({ profile: undefined, documents: [], observations: [], claims: [], readiness: undefined, storage: undefined, jobs: [], busy: false, error: "" });
    onLocked?.();
  }, [onLocked, vault]);

  useEffect(() => () => { analysis.current.stopAll(); }, []);

  /**
   * Stores every chosen file, then analyses only if analysis was consented to.
   * Each file's outcome is reported on its own; a failure never hides behind a
   * batch-level "complete".
   */
  const importSelection = useCallback(async (selection: Selection, options: { analyse: boolean }) => {
    setState(current => ({ ...current, busy: true, error: "", jobs: selection.files.map(entry => ({ id: entry.path, name: entry.path, stage: "queued" as const })) }));
    try {
      await vault.recordConsent({
        scope: "store", purpose: "Keep these documents encrypted on this device.", policy_version: CONSENT_POLICY_VERSION,
        source_descriptor: selection.descriptor, source_fingerprint: selection.fingerprint, file_count: selection.files.length, granted_at: new Date().toISOString(),
      });
      if (options.analyse) {
        await vault.recordConsent({
          scope: "analyse", purpose: "Read these documents on this device to suggest details for review.", policy_version: CONSENT_POLICY_VERSION,
          source_descriptor: selection.descriptor, source_fingerprint: selection.fingerprint, file_count: selection.files.length, granted_at: new Date().toISOString(),
        });
      }

      for (const entry of selection.files) {
        if (!vault.unlocked) break;
        const bytes = new Uint8Array(await entry.file.arrayBuffer());
        const { document } = await vault.addDocument({ bytes, filename: entry.path, media_type: entry.file.type || "application/octet-stream", processing: options.analyse ? "queued" : "stored" });
        if (!options.analyse) { setState(current => ({ ...current, jobs: current.jobs.map(job => (job.id === entry.path ? { ...job, stage: "done" } : job)) })); continue; }
        await runAnalysis(document, bytes.slice().buffer, entry.path);
      }
      await refresh();
    } catch (error) {
      setState(current => ({ ...current, error: message(error) }));
    } finally {
      setState(current => ({ ...current, busy: false }));
    }

    async function runAnalysis(document: VaultDocument, bytes: ArrayBuffer, label: string) {
      const generation = analysis.current.generation;
      const outcome = await analysis.current.analyse({
        job_id: document.id, filename: document.filename, media_type: document.media_type, bytes, rotation: document.rotation,
        onProgress: progress => setState(current => ({ ...current, jobs: current.jobs.map(job => (job.id === label ? { ...job, stage: progress.stage, page: progress.page, pages: progress.pages } : job)) })),
      });
      if (!vault.unlocked || generation !== analysis.current.generation) return;
      if (outcome.status === "cancelled") { await vault.updateDocument(document.id, { processing: "cancelled" }).catch(() => undefined); return; }
      if (outcome.status === "failed") {
        await vault.updateDocument(document.id, { processing: outcome.unsupported ? "unsupported" : "failed", failure_reason: outcome.reason }).catch(() => undefined);
        setState(current => ({ ...current, jobs: current.jobs.map(job => (job.id === label ? { ...job, stage: "done", error: outcome.reason, unsupported: outcome.unsupported } : job)) }));
        return;
      }
      const result = outcome.result;
      await vault.saveAnalysis({
        document_id: document.id,
        generation: vault.epoch,
        classification: result.document_class,
        page_count: result.page_count,
        rotation: result.applied_rotation,
        analysis: { engine: `tesseract.js+pdfjs ${PARSER_VERSION}`, method: result.method, completed_at: new Date().toISOString(), recognition_quality: result.recognition_quality },
        observations: result.candidates.map(candidate => ({
          page: 1, field: candidate.field, raw_text: candidate.raw_text.slice(0, 2000), normalised: candidate.normalised,
          ambiguities: candidate.ambiguities, method: candidate.method, parser_version: candidate.parser_version,
          recognition_quality: result.recognition_quality, excerpt: candidate.excerpt.slice(0, 600),
        })),
        extracted_text: result.text,
        ...(result.thumbnail ? { thumbnail: new Uint8Array(result.thumbnail) } : {}),
      });
      setState(current => ({ ...current, jobs: current.jobs.map(job => (job.id === label ? { ...job, stage: "done" } : job)) }));
    }
  }, [refresh, vault]);

  const reanalyse = useCallback(async (document: VaultDocument, rotation: Rotation) => {
    setState(current => ({ ...current, busy: true, error: "", jobs: [{ id: document.id, name: document.label ?? document.filename, stage: "queued" }] }));
    try {
      const bytes = await vault.readDocumentBytes(document.id);
      await vault.updateDocument(document.id, { processing: "queued", rotation });
      const generation = analysis.current.generation;
      const outcome = await analysis.current.analyse({
        job_id: `${document.id}-retry`, filename: document.filename, media_type: document.media_type, bytes: bytes.slice().buffer, rotation,
        onProgress: progress => setState(current => ({ ...current, jobs: current.jobs.map(job => (job.id === document.id ? { ...job, stage: progress.stage, page: progress.page, pages: progress.pages } : job)) })),
      });
      if (!vault.unlocked || generation !== analysis.current.generation) return;
      if (outcome.status === "analysed") {
        const result = outcome.result;
        await vault.saveAnalysis({
          document_id: document.id, generation: vault.epoch, classification: result.document_class, page_count: result.page_count, rotation: result.applied_rotation,
          analysis: { engine: `tesseract.js+pdfjs ${PARSER_VERSION}`, method: result.method, completed_at: new Date().toISOString(), recognition_quality: result.recognition_quality },
          observations: result.candidates.map(candidate => ({
            page: 1, field: candidate.field, raw_text: candidate.raw_text.slice(0, 2000), normalised: candidate.normalised, ambiguities: candidate.ambiguities,
            method: candidate.method, parser_version: candidate.parser_version, recognition_quality: result.recognition_quality, excerpt: candidate.excerpt.slice(0, 600),
          })),
          extracted_text: result.text,
          ...(result.thumbnail ? { thumbnail: new Uint8Array(result.thumbnail) } : {}),
        });
      } else if (outcome.status === "failed") {
        await vault.updateDocument(document.id, { processing: outcome.unsupported ? "unsupported" : "failed", failure_reason: outcome.reason });
      } else {
        await vault.updateDocument(document.id, { processing: "cancelled" });
      }
      await refresh();
    } catch (error) {
      setState(current => ({ ...current, error: message(error) }));
    } finally {
      setState(current => ({ ...current, busy: false, jobs: [] }));
    }
  }, [refresh, vault]);

  const review = useCallback(async (observationId: string, decision: "accepted" | "rejected") => {
    await vault.reviewObservation(observationId, decision);
    await refresh();
  }, [refresh, vault]);

  const setClaim = useCallback(async (field: ClaimField, value: string, source: ClaimSource) => {
    await vault.setClaimValue(field, value, source);
    await refresh();
  }, [refresh, vault]);

  const removeDocument = useCallback(async (id: string) => {
    await vault.deleteDocument(id);
    await refresh();
  }, [refresh, vault]);

  const renameDocument = useCallback(async (id: string, label: string) => {
    await vault.updateDocument(id, { label });
    await refresh();
  }, [refresh, vault]);

  const cancelJob = useCallback((id: string) => { analysis.current.cancel(id); }, []);

  return { state: { ...state, readiness }, passActive, refresh, lock, importSelection, reanalyse, review, setClaim, removeDocument, renameDocument, cancelJob, vault };
}

function message(error: unknown): string {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "vault_storage_full") return "This device is out of space for your Vault. Remove a document and try again; nothing was changed.";
  if (reason === "vault_locked") return "Your Vault locked before that finished. Nothing was saved.";
  if (reason === "vault_unavailable") return "This browser cannot open your Vault storage.";
  return "That did not finish. Nothing was changed.";
}
