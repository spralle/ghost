import type { WindowBridge } from "./window-bridge.js";

export const MIN_TTL_MS = 1_000;
const TERMINAL_TOMBSTONE_TTL_MS = 120_000;

export type SessionState = "start" | "consume";
export type TerminalState = "commit" | "abort" | "timeout";

export interface SessionEntry {
  payload: unknown;
  expiresAt: number;
  correlationId: string;
  ownerWindowId: string;
  consumedByWindowId: string | null;
  state: SessionState;
}

export function createCorrelationId(windowId: string, now: number): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `xfer-${windowId}-${now.toString(36)}-${random}`;
}

export function finalizeSession(
  sessions: Map<string, SessionEntry>,
  terminalSessions: Map<string, number>,
  bridge: WindowBridge,
  sourceWindowId: string,
  id: string,
  entry: SessionEntry,
  lifecycle: TerminalState,
  consumedByWindowId: string | null,
): void {
  sessions.delete(id);
  rememberTerminal(terminalSessions, id, Date.now());

  bridge.publish({
    type: "dnd-session-delete",
    id,
    correlationId: entry.correlationId,
    lifecycle,
    ownerWindowId: entry.ownerWindowId,
    consumedByWindowId: consumedByWindowId ?? undefined,
    sourceWindowId,
  });
}

export function pruneExpiredSessions(
  sessions: Map<string, SessionEntry>,
  terminalSessions: Map<string, number>,
  now: number,
  sourceWindowId: string,
  bridge: WindowBridge,
): number {
  let expiredCount = 0;
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt >= now) {
      continue;
    }

    expiredCount += 1;
    finalizeSession(
      sessions,
      terminalSessions,
      bridge,
      sourceWindowId,
      id,
      session,
      "timeout",
      session.consumedByWindowId,
    );
  }

  return expiredCount;
}

export function rememberTerminal(terminalSessions: Map<string, number>, id: string, now: number): void {
  terminalSessions.set(id, now + TERMINAL_TOMBSTONE_TTL_MS);
}

export function pruneTerminals(terminalSessions: Map<string, number>, now: number): void {
  for (const [id, expiresAt] of terminalSessions.entries()) {
    if (expiresAt >= now) {
      continue;
    }

    terminalSessions.delete(id);
  }
}

export function logProtocol(reason: string, detail: Record<string, unknown>): void {
  console.log("[shell:dnd:protocol]", {
    reason,
    ...detail,
  });
}
