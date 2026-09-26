import { declineReasons, eligibility, isKnownPolicy, verifiers, type DeclineReason, type PolicySnapshot, type ValidationType } from './policy';
export { requirements, verifiers, type ValidationType } from './policy';

export class ValidationPolicyError extends Error {}

export interface ValidationRecord {
  id: string;
  documentName: string;
  documentHash: string;
  validationType: ValidationType;
  validationStatement: string;
  customer: string;
  verifierId: string;
  status: 'awaiting_verifier' | 'under_review' | 'validated' | 'declined';
  createdAt: string;
  validatedAt?: string;
  file: Blob;
  // Optional only for pre-policy records already stored in this browser.
  policy?: PolicySnapshot;
  evidence?: { checkId: string; confirmedAt: string }[];
  declinedAt?: string;
  declineReason?: DeclineReason;
}
export interface ReviewDecision {
  acknowledged?: boolean;
  evidenceIds?: string[];
  declineReason?: DeclineReason;
}

export function canAttest(record: ValidationRecord): boolean {
  const verifier = verifiers.find(v => v.id === record.verifierId);
  return !!record.policy?.checkMethod && isKnownPolicy(record.policy) && !!verifier &&
    eligibility(record.policy, verifier).eligible &&
    record.validationType === record.policy.validationType &&
    record.validationStatement === record.policy.statement;

}
export async function fingerprint(file: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('zik-validate-prototype', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('requests', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function listRecords(): Promise<ValidationRecord[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('requests', 'readonly');
    const query = tx.objectStore('requests').getAll();
    tx.oncomplete = () => { db.close(); resolve((query.result as ValidationRecord[]).sort((a,b) => b.createdAt.localeCompare(a.createdAt))); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
export async function saveRequest(record: ValidationRecord) {
  if (!record.policy || !isKnownPolicy(record.policy, true) || !canAttest(record)) {
    throw new ValidationPolicyError('A matching active recipient policy and eligible verifier are required.');
  }
  if (record.status !== 'awaiting_verifier' || record.validatedAt || record.evidence || record.declinedAt || record.declineReason) {
    throw new ValidationPolicyError('New requests must start awaiting verifier review.');
  }
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('requests', 'readwrite');
    tx.objectStore('requests').add(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}
// Read + transition in one transaction: repeated clicks/tabs cannot re-attest a terminal request.
export async function transition(id: string, status: ValidationRecord['status'], decision: ReviewDecision = {}) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('requests', 'readwrite');
    const store = tx.objectStore('requests');
    const query = store.get(id);
    let failure: Error | undefined;
    query.onsuccess = () => {
      const record = query.result as ValidationRecord | undefined;
      if (!record) { failure = new ValidationPolicyError('Request not found.'); tx.abort(); return; }
      if (record.status === 'validated' || record.status === 'declined') return;
      const timestamp = new Date().toISOString();
      try {
        if (status === 'under_review') {
          store.put({ ...record, status });
        } else if (status === 'declined') {
          if (!decision.declineReason || !Object.prototype.hasOwnProperty.call(declineReasons, decision.declineReason)) {
            throw new ValidationPolicyError('Choose a reason for declining this request.');
          }
          store.put({ ...record, status, declineReason: decision.declineReason, declinedAt: timestamp });
        } else if (status === 'validated') {
          if (record.status !== 'under_review' || !decision.acknowledged) {
            throw new ValidationPolicyError('Review the document and acknowledge the attestation first.');
          }
          if (!canAttest(record)) {
            throw new ValidationPolicyError('This request has no applicable policy with defined check arrangements. Create a new request with the recipient’s requirements.');
          }
          const required = record.policy!.evidence.map(check => check.id);
          const supplied = decision.evidenceIds ?? [];
          if (supplied.length !== required.length || new Set(supplied).size !== supplied.length || !required.every(id => supplied.includes(id))) {
            throw new ValidationPolicyError('Complete every evidence check required by this policy.');
          }
          store.put({ ...record, status, validatedAt: timestamp, evidence: required.map(checkId => ({ checkId, confirmedAt: timestamp })) });
        } else {
          throw new ValidationPolicyError('This request cannot return to an earlier state.');
        }
      } catch (error) {
        failure = error as Error;
        tx.abort();
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(failure ?? tx.error); };
  });
}
