import type { DecodedShellState, UrlCodecState, UrlCodecStrategy } from "./codec-types.js";

const STATE_PARAM = "_s";
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeBase64(bytes: Uint8Array): string {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1] ?? 0;
    const third = bytes[index + 2] ?? 0;
    const bits = (first << 16) | (second << 8) | third;
    encoded += BASE64_ALPHABET[(bits >> 18) & 63];
    encoded += BASE64_ALPHABET[(bits >> 12) & 63];
    encoded += index + 1 < bytes.length ? BASE64_ALPHABET[(bits >> 6) & 63] : "=";
    encoded += index + 2 < bytes.length ? BASE64_ALPHABET[bits & 63] : "=";
  }
  return encoded;
}

function decodeBase64(encoded: string): Uint8Array | null {
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 4) {
    const values = [...encoded.slice(index, index + 4)].map((character) =>
      character === "=" ? 0 : BASE64_ALPHABET.indexOf(character),
    );
    if (values.some((value) => value < 0)) return null;
    const bits = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
    bytes.push((bits >> 16) & 255);
    if (encoded[index + 2] !== "=") bytes.push((bits >> 8) & 255);
    if (encoded[index + 3] !== "=") bytes.push(bits & 255);
  }
  return Uint8Array.from(bytes);
}

/** Base64url encode a string, resilient to missing `btoa`. */
function encodeBase64Url(data: string): string {
  try {
    const base64 = encodeBase64(new TextEncoder().encode(data));
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return "";
  }
}

/** Base64url decode a string, resilient to malformed input. */
function decodeBase64Url(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const bytes = decodeBase64(padded);
    return bytes ? new TextDecoder().decode(bytes) : null;
  } catch {
    return null;
  }
}

/**
 * Active-view URL codec: puts the active tab's view and params in a readable path.
 *
 * URL format: `/{definitionId}?{paramKey=paramValue}&_s={base64url compressed shell state}`
 *
 * The active tab's definition ID becomes the URL path, its args become query params,
 * and remaining shell state (other tabs, dock tree, workspace) is compressed into `_s`.
 *
 * @example
 * ```
 * /vessel-view?vesselId=v123&_route=vessel.detail&_s=eyJ0YWJz...
 * ```
 */
export function createActiveViewCodec(): UrlCodecStrategy {
  return {
    id: "active-view",
    name: "Active View",

    encode(state: UrlCodecState, baseUrl: URL): URL {
      if (!state.activeDefinitionId) {
        const url = new URL(`${baseUrl.origin}/`);
        const compressed = encodeCompressedState(state);
        if (compressed) url.searchParams.set(STATE_PARAM, compressed);
        return url;
      }

      const url = new URL(`${baseUrl.origin}/${state.activeDefinitionId}`);

      for (const [key, value] of Object.entries(state.activeArgs)) {
        url.searchParams.set(key, value);
      }

      const shellSummary = buildShellSummary(state);
      const compressed = encodeBase64Url(JSON.stringify(shellSummary));
      if (compressed) {
        url.searchParams.set(STATE_PARAM, compressed);
      }

      return url;
    },

    decode(url: URL): DecodedShellState | null {
      const definitionId = extractDefinitionId(url);
      const activeArgs: Record<string, string> = {};

      for (const [key, value] of url.searchParams.entries()) {
        if (key !== STATE_PARAM) {
          activeArgs[key] = value;
        }
      }

      const stateParam = url.searchParams.get(STATE_PARAM);
      let _fullState: DecodedShellState["fullState"] | undefined;
      let workspaceId: string | undefined;

      if (stateParam) {
        const json = decodeBase64Url(stateParam);
        if (json) {
          try {
            const parsed: unknown = JSON.parse(json);
            if (
              parsed &&
              typeof parsed === "object" &&
              "workspaceId" in parsed &&
              typeof parsed.workspaceId === "string"
            ) {
              workspaceId = parsed.workspaceId;
            }
          } catch {
            // Malformed state — continue without it
          }
        }
      }

      return {
        activeDefinitionId: definitionId ?? undefined,
        activeArgs: Object.keys(activeArgs).length > 0 ? activeArgs : undefined,
        workspaceId,
      };
    },

    canDecode(url: URL): boolean {
      const path = url.pathname.replace(/^\/+/, "");
      return path.length > 0;
    },
  };
}

/** Extract definition ID from the first pathname segment. */
function extractDefinitionId(url: URL): string | null {
  const path = url.pathname.replace(/^\/+/, "");
  return path.length > 0 ? path.split("/")[0]! : null;
}

/** Build a summary of non-active shell state for compression. */
function buildShellSummary(state: UrlCodecState): {
  tabs: ReadonlyArray<{ id: string; definitionId: string; args: Readonly<Record<string, string>> }>;
  dockTree: unknown;
  workspaceId: string;
} {
  const otherTabs = state.tabSummary.filter((t) => t.id !== state.activeTabId);
  return {
    tabs: otherTabs,
    dockTree: state.dockTreeSnapshot,
    workspaceId: state.workspaceId,
  };
}

/** Encode full state into a compressed base64url string. */
function encodeCompressedState(state: UrlCodecState): string {
  const summary = {
    tabs: state.tabSummary,
    dockTree: state.dockTreeSnapshot,
    workspaceId: state.workspaceId,
  };
  return encodeBase64Url(JSON.stringify(summary));
}
