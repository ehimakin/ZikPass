export class PhysicalSessionError extends Error {
  constructor(public readonly code: "session_not_found" | "session_expired", message: string) {
    super(message);
    this.name = "PhysicalSessionError";
  }
}
