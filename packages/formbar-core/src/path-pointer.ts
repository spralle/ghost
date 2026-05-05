import { FormbarError } from "./errors.js";
import type { CanonicalPath, CanonicalSegment } from "./path.js";
import type { NamespaceConfig } from "./path-parser.js";

export function parsePointer(input: string, namespaces: readonly NamespaceConfig[]): CanonicalPath {
  const parts = input.split("/");
  const rawSegments = parts.slice(1);

  if (rawSegments.length > 0) {
    const matched = namespaces.find((ns) => rawSegments[0] === ns.prefix);
    if (matched) {
      const nsSegments = rawSegments.slice(1).map(decodePointerSegment);
      return { namespace: matched.namespace, segments: nsSegments };
    }
  }

  const segments: CanonicalSegment[] = rawSegments.map(decodePointerSegment);
  return { namespace: "data", segments };
}

function decodePointerSegment(raw: string): CanonicalSegment {
  validatePointerEscapes(raw);
  return raw.replace(/~1/g, "/").replace(/~0/g, "~");
}

function validatePointerEscapes(raw: string): void {
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "~") {
      const next = raw[i + 1];
      if (next !== "0" && next !== "1") {
        throw new FormbarError(
          "FORMBAR_PATH_INVALID_POINTER_ESCAPE",
          `Invalid JSON Pointer escape sequence ~${next ?? ""} at index ${i}`,
        );
      }
    }
  }
}
