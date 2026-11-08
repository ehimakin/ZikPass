import { createServer, type Socket } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
it("submits an actual MIME email with a calendar invitation to a local development SMTP server", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "zik-smtp-")); const sockets = new Set<Socket>(); let message = "";
  const server = createServer(socket => {
    sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.write("220 localhost ESMTP ready\r\n");
    let buffer = ""; let data = false;
    socket.on("data", chunk => {
      buffer += chunk.toString();
      while (buffer.includes("\r\n")) {
        const index = buffer.indexOf("\r\n"); const line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
        if (data) { if (line === ".") { data = false; socket.write("250 queued locally\r\n"); } else message += line + "\r\n"; }
        else if (/^EHLO|^HELO/.test(line)) socket.write("250 localhost\r\n");
        else if (line === "DATA") { data = true; socket.write("354 End with dot\r\n"); }
        else if (line === "QUIT") { socket.end("221 bye\r\n"); }
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("ZIK_RUNTIME_DATA_DIR", directory); vi.stubEnv("ZIK_SMTP_HOST", "127.0.0.1"); vi.stubEnv("ZIK_SMTP_PORT", String((server.address() as { port: number }).port)); vi.stubEnv("ZIK_SMTP_USER", ""); vi.stubEnv("ZIK_SMTP_PASSWORD", ""); vi.stubEnv("ZIK_SMTP_FROM", "sender@example.com"); vi.stubEnv("ZIK_ONBOARDING_EMAIL", "agent@example.com"); vi.stubEnv("ZIK_ONBOARDING_PUBLIC_URL", "https://dev.example.com");
    const { createRegistration } = await import("@/lib/server/affiliate-onboarding"); const { requestBooking } = await import("@/lib/server/affiliate-booking");
    const setup = createRegistration("SMTP test", "http://localhost:3003", "http://localhost:3003/api/zik/callback");
    const result = await requestBooking(setup.registration.id, setup.token, "client@example.com", new Date(Date.now() + 86400000).toISOString());
    expect(result.registration.booking?.delivery).toBe("sent"); expect(message).toContain("To: agent@example.com, client@example.com"); expect(message).toContain("text/calendar"); expect(message).toContain("method=REQUEST"); expect(message).toContain("zik-onboarding.ics"); expect(message).not.toContain(setup.token);
  } finally { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); }
});
