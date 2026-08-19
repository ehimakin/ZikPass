import { randomId } from "@/lib/shared/utils";
import type { DeviceBindingAuthorization, DeviceBindingRecord, PaymentRecord } from "@/lib/shared/types";
import {
  insertDeviceBindingIfMissing,
  listDeviceBindings,
  runDeviceBindingTransaction
} from "@/lib/server/storage";
import { resolveStorePlan } from "@/lib/server/payments";

export class PaymentRequiredError extends Error {
  deviceLimit: number;
  activeCount: number;

  constructor(deviceLimit: number, activeCount: number) {
    super("An extension payment is required before this device can be added.");
    this.name = "PaymentRequiredError";
    this.deviceLimit = deviceLimit;
    this.activeCount = activeCount;
  }
}

function sameHolderPublicKey(left: JsonWebKey, right: JsonWebKey): boolean {
  return left.kty === right.kty && left.crv === right.crv && left.x === right.x;
}

/**
 * Called once, at the moment the first credential for an enrollment is
 * issued. That device (the one that completed onboarding) becomes the
 * primary binding — it cannot be revoked or displaced by "Extend pass".
 */
export async function createPrimaryDeviceBindingIfMissing(
  enrollmentId: string,
  holderPublicKey: JsonWebKey
): Promise<DeviceBindingRecord> {
  const existing = await listDeviceBindings(enrollmentId);
  const primary = existing.find((binding) => binding.is_primary);

  if (primary) {
    return primary;
  }

  const now = new Date().toISOString();
  return insertDeviceBindingIfMissing({
    binding_id: randomId("device"),
    enrollment_id: enrollmentId,
    holder_public_key: holderPublicKey,
    status: "active",
    is_primary: true,
    linked_at: now,
    last_seen_at: now
  });
}

/**
 * The policy gate for adding a device to a pass. Runs as a single
 * serialized transaction (see runDeviceBindingTransaction) so two
 * concurrent claims for the same enrollment cannot both slip past the
 * device limit — the second one always sees the first one's write.
 */
export async function authorizeDeviceBinding(input: {
  enrollmentId: string;
  holderPublicKey: JsonWebKey;
  storeId?: string;
}): Promise<DeviceBindingAuthorization> {
  const plan = await resolveStorePlan(input.storeId);

  return runDeviceBindingTransaction<DeviceBindingAuthorization>(({ bindings, payments }) => {
    const enrollmentBindings = bindings.filter((binding) => binding.enrollment_id === input.enrollmentId);
    const existing = enrollmentBindings.find(
      (binding) =>
        binding.status === "active" && sameHolderPublicKey(binding.holder_public_key, input.holderPublicKey)
    );

    if (existing) {
      const touched: DeviceBindingRecord = { ...existing, last_seen_at: new Date().toISOString() };
      return {
        result: { outcome: "existing", binding: touched },
        bindings: bindings.map((binding) => (binding.binding_id === touched.binding_id ? touched : binding))
      };
    }

    const activeCount = enrollmentBindings.filter((binding) => binding.status === "active").length;
    const now = new Date().toISOString();

    if (activeCount < plan.deviceLimit) {
      const binding: DeviceBindingRecord = {
        binding_id: randomId("device"),
        enrollment_id: input.enrollmentId,
        holder_public_key: input.holderPublicKey,
        status: "active",
        is_primary: false,
        linked_at: now,
        last_seen_at: now
      };

      return { result: { outcome: "authorized", binding }, bindings: [...bindings, binding] };
    }

    const availableEntitlement = payments.find(
      (payment) =>
        payment.enrollment_id === input.enrollmentId &&
        payment.purpose === "device_extension" &&
        payment.status === "confirmed" &&
        !payment.consumed_by_binding_id
    );

    if (!availableEntitlement) {
      return {
        result: { outcome: "payment_required", device_limit: plan.deviceLimit, active_count: activeCount }
      };
    }

    const binding: DeviceBindingRecord = {
      binding_id: randomId("device"),
      enrollment_id: input.enrollmentId,
      holder_public_key: input.holderPublicKey,
      status: "active",
      is_primary: false,
      linked_at: now,
      last_seen_at: now,
      entitlement_payment_id: availableEntitlement.payment_id
    };
    const consumedPayment: PaymentRecord = {
      ...availableEntitlement,
      consumed_by_binding_id: binding.binding_id
    };

    return {
      result: { outcome: "authorized_via_payment", binding },
      bindings: [...bindings, binding],
      payments: payments.map((payment) =>
        payment.payment_id === consumedPayment.payment_id ? consumedPayment : payment
      )
    };
  });
}

export async function authorizeDeviceBindingOrThrow(input: {
  enrollmentId: string;
  holderPublicKey: JsonWebKey;
  storeId?: string;
}): Promise<Exclude<DeviceBindingAuthorization, { outcome: "payment_required" }>> {
  const authorization = await authorizeDeviceBinding(input);

  if (authorization.outcome === "payment_required") {
    throw new PaymentRequiredError(authorization.device_limit, authorization.active_count);
  }

  return authorization;
}

export async function getDeviceBindings(enrollmentId: string): Promise<DeviceBindingRecord[]> {
  return listDeviceBindings(enrollmentId);
}
