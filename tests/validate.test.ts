import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { canAttest, fingerprint, listRecords, saveRequest, transition, type ValidationRecord } from '@/lib/validate/model';
import { eligibility, isKnownPolicy, policies, resolvePolicy, verifiers, type PolicySnapshot, type RequirementContext } from '@/lib/validate/policy';

const context: RequirementContext = { recipientId: 'northstar', documentType: 'passport-copy', jurisdiction: 'GB-EAW' };
function policyFor(overrides: Partial<RequirementContext> = {}): PolicySnapshot {
  const result = resolvePolicy({ ...context, ...overrides }, 'Not sure');
  if (result.status !== 'matched') throw new Error(result.reason);
  return result.policy;
}
function request(overrides: Partial<ValidationRecord> = {}): ValidationRecord {
  const policy = policyFor();
  return {
    id: 'ZV-TEST', documentName: 'demo.pdf', documentHash: 'demo-hash',
    validationType: policy.validationType, validationStatement: policy.statement,
    customer: 'Demo', verifierId: 'maya', status: 'awaiting_verifier',
    createdAt: new Date().toISOString(), file: new Blob(['abc']), policy, ...overrides
  };
}
const decision = (policy = policyFor()) => ({ acknowledged: true, evidenceIds: policy.evidence.map(check => check.id) });
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

describe('fictional recipient policy resolution', () => {
  it('requires exact recipient, document and jurisdiction coverage', () => {
    for (const partial of [{ recipientId: '' }, { recipientId: 'unknown' }, { documentType: 'unknown' }, { jurisdiction: 'unknown' }]) {
      expect(resolvePolicy({ ...context, ...partial }, 'Not sure').status).toBe('needs_clarification');
    }
    expect(resolvePolicy({ ...context, recipientId: 'harbour', jurisdiction: 'GB-SCT' }, 'Not sure').status).toBe('needs_clarification');
    expect(resolvePolicy(context, 'Witness a signature').status).toBe('needs_clarification');
  });
  it('selects a context-specific requirement for Not sure, not a fixed certified copy', () => {
    expect(policyFor({ documentType: 'identity-photo' }).validationType).toBe('Identity / photograph confirmation');
    expect(policyFor({ documentType: 'consent-form' }).validationType).toBe('Witness a signature');
  });
  it('changes eligibility with the recipient and jurisdiction and checks standing', () => {
    const maya = verifiers.find(v => v.id === 'maya')!;
    const elena = verifiers.find(v => v.id === 'elena')!;
    expect(eligibility(policyFor(), maya).eligible).toBe(true);
    expect(eligibility(policyFor({ recipientId: 'harbour' }), maya).eligible).toBe(false);
    expect(eligibility(policyFor({ recipientId: 'harbour' }), elena).eligible).toBe(true);
    expect(eligibility(policyFor(), { ...maya, jurisdictions: ['GB-SCT'] }).eligible).toBe(false);
    expect(eligibility(policyFor(), { ...maya, professionalStatus: 'unverified' }).eligible).toBe(false);
    expect(eligibility(policyFor({ jurisdiction: 'GB-SCT' }), verifiers.find(v => v.id === 'alex')!).eligible).toBe(true);
  });
  it('pins independent snapshots and rejects unknown or modified versions', () => {
    const snapshot = policyFor();
    expect(isKnownPolicy(snapshot)).toBe(true);
    snapshot.evidence[0].label = 'Altered';
    expect(isKnownPolicy(snapshot)).toBe(false);
    expect(policyFor().evidence[0].label).not.toBe('Altered');
    expect(isKnownPolicy({ ...policyFor(), version: 99 })).toBe(false);
    expect(new Set(policies.map(p => `${p.id}@${p.version}`)).size).toBe(policies.length);
    for (const policy of policies) expect(new Set(policy.evidence.map(e => e.id)).size).toBe(policy.evidence.length);
  });
});

describe('local validation attestation lifecycle', () => {
  it('hashes actual bytes', async () => {
    expect(await fingerprint(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('blocks creation without a matching policy and eligible verifier', async () => {
    await expect(saveRequest(request({ policy: undefined }))).rejects.toThrow('matching active');
    await expect(saveRequest(request({ policy: policyFor({ recipientId: 'harbour' }) }))).rejects.toThrow('eligible verifier');
    await expect(saveRequest(request({ validationStatement: 'Different statement' }))).rejects.toThrow();
    await expect(saveRequest(request({ status: 'validated' }))).rejects.toThrow('awaiting verifier');
    expect(await listRecords()).toHaveLength(0);
  });
  it('requires review, every unique evidence check and acknowledgement, then preserves a single terminal record', async () => {
    const record = request();
    await saveRequest(record);
    await expect(saveRequest(record)).rejects.toBeTruthy();
    await expect(transition(record.id, 'validated', decision())).rejects.toThrow('Review');
    await transition(record.id, 'under_review');
    await expect(transition(record.id, 'validated', { ...decision(), acknowledged: false })).rejects.toThrow('acknowledge');
    await expect(transition(record.id, 'validated', { acknowledged: true })).rejects.toThrow('every evidence');
    await expect(transition(record.id, 'validated', { ...decision(), evidenceIds: ['recipient-instructions', 'recipient-instructions', 'original-inspected'] })).rejects.toThrow('every evidence');
    await expect(transition(record.id, 'validated', { ...decision(), evidenceIds: [...decision().evidenceIds, 'unknown'] })).rejects.toThrow('every evidence');
    await Promise.all([transition(record.id, 'validated', decision()), transition(record.id, 'validated', decision())]);
    const completed = (await listRecords())[0];
    expect(completed.status).toBe('validated');
    expect(completed.evidence?.map(e => e.checkId)).toEqual(decision().evidenceIds);
    expect(completed.evidence?.every(e => e.confirmedAt === completed.validatedAt)).toBe(true);
    expect(completed.policy).toEqual(record.policy);
    expect(await completed.file.text()).toBe('abc');
    await transition(record.id, 'declined', { declineReason: 'cannot-attest' });
    expect((await listRecords())[0]).toEqual(completed);
    expect(await listRecords()).toHaveLength(1);
  });
  it('requires and retains a decline reason and does not validate a declined request', async () => {
    await saveRequest(request());
    await expect(transition('ZV-TEST', 'declined')).rejects.toThrow('reason');
    expect((await listRecords())[0].status).toBe('awaiting_verifier');
    await transition('ZV-TEST', 'declined', { declineReason: 'evidence-missing' });
    await transition('ZV-TEST', 'under_review');
    await transition('ZV-TEST', 'validated', decision());
    expect((await listRecords())[0]).toMatchObject({ status: 'declined', declineReason: 'evidence-missing', declinedAt: expect.any(String) });
  });
  it('does not silently assign a policy to old records', async () => {
    expect(canAttest(request({ policy: undefined }))).toBe(false);
    // Simulate an existing pre-policy IndexedDB row without passing new-request validation.
    await listRecords();
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('zik-validate-prototype', 1);
      open.onsuccess = () => {
        const tx = open.result.transaction('requests', 'readwrite');
        tx.objectStore('requests').add(request({ policy: undefined }));
        tx.oncomplete = () => { open.result.close(); resolve(); };
        tx.onabort = () => reject(tx.error);
      };
    });
    await transition('ZV-TEST', 'under_review');
    await expect(transition('ZV-TEST', 'validated', decision())).rejects.toThrow('defined check arrangements');
    expect((await listRecords())[0].policy).toBeUndefined();
    await transition('ZV-TEST', 'declined', { declineReason: 'requirements-unclear' });
    expect((await listRecords())[0].status).toBe('declined');
  });
});

describe('check arrangements', () => {
  it('separates a conflicting requirement from the method used for checks', () => {
    const result = resolvePolicy(context, 'Witness a signature');
    expect(result).toMatchObject({ status: 'needs_clarification', suggestedType: 'Certified copy' });
    expect(policyFor().checkMethod?.mode).toBe('in_person');
    expect(policyFor({ recipientId: 'harbour', documentType: 'professional-declaration' }).checkMethod?.mode).toBe('document_review');
  });
  it('requires explicit in-person witnessing confirmation, not just document review', async () => {
    const policy = policyFor({ documentType: 'consent-form' });
    const record = request({ policy, verifierId: 'alex', validationType: policy.validationType, validationStatement: policy.statement });
    await saveRequest(record);
    await transition(record.id, 'under_review');
    await expect(transition(record.id, 'validated', {
      acknowledged: true,
      evidenceIds: policy.evidence.filter(check => check.id !== 'in-person-appointment').map(check => check.id)
    })).rejects.toThrow('every evidence');
    expect((await listRecords())[0].status).toBe('under_review');
    await transition(record.id, 'validated', decision(policy));
    expect((await listRecords())[0].evidence).toContainEqual({ checkId: 'in-person-appointment', confirmedAt: expect.any(String) });
  });
  it('retains version 1 for history without allowing new or pending requests to bypass check arrangements', async () => {
    const previous = policies.find(p => p.id === 'northstar-consent-eaw' && p.version === 1)!;
    const { lifecycle, ...snapshot } = previous;
    expect(lifecycle).toBe('retired');
    expect(isKnownPolicy(snapshot)).toBe(true);
    expect(isKnownPolicy(snapshot, true)).toBe(false);
    const record = request({ policy: snapshot, verifierId: 'alex', validationType: snapshot.validationType, validationStatement: snapshot.statement });
    expect(canAttest(record)).toBe(false);
    await expect(saveRequest(record)).rejects.toThrow('active');
  });
});
