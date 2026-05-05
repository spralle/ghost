import { FormbarError } from "./errors.js";
import type { CanonicalPath, CanonicalSegment, Namespace } from "./path.js";
import type { NamespaceConfig } from "./path-parser.js";

const NUMERIC_INDEX_RE = /^(?:0|[1-9]\d*)$/;

export function findMatchingNamespace(
  input: string,
  namespaces: readonly NamespaceConfig[],
): NamespaceConfig | undefined {
  return namespaces.find((ns) => input.startsWith(`${ns.prefix}.`) || input === ns.prefix);
}

export function parseDot(input: string, namespaces: readonly NamespaceConfig[]): CanonicalPath {
  let namespace: Namespace = "data";
  let raw = input;

  const matched = findMatchingNamespace(input, namespaces);
  if (matched) {
    if (raw === matched.prefix) {
      throw new FormbarError(
        "FORMBAR_PATH_INVALID_DOT",
        `${matched.prefix} alone is not a valid path; at least one segment is required after ${matched.prefix}.`,
      );
    }
    namespace = matched.namespace;
    raw = raw.slice(matched.prefix.length + 1);
  }

  validateDotRaw(raw);

  const segments = raw.split(".").map(toDotSegment);
  return { namespace, segments };
}

function validateDotRaw(raw: string): void {
  if (raw === "") {
    throw new FormbarError("FORMBAR_PATH_INVALID_DOT", "Path has no segments after prefix");
  }
  if (raw.startsWith(".")) {
    throw new FormbarError("FORMBAR_PATH_INVALID_DOT", "Path must not start with a dot");
  }
  if (raw.endsWith(".")) {
    throw new FormbarError("FORMBAR_PATH_INVALID_DOT", "Path must not end with a dot");
  }
  if (raw.includes("..")) {
    throw new FormbarError("FORMBAR_PATH_INVALID_DOT", "Path must not contain consecutive dots");
  }
}

function toDotSegment(seg: string): CanonicalSegment {
  return NUMERIC_INDEX_RE.test(seg) ? Number(seg) : seg;
}
