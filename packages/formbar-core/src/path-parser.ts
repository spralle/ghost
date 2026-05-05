import { FormbarError } from "./errors.js";
import type { CanonicalPath, CanonicalSegment, Namespace } from "./path.js";
import { parseDot } from "./path-dot.js";
import { parsePointer } from "./path-pointer.js";

const DOT_SAFE_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;
const NUMERIC_INDEX_RE = /^(?:0|[1-9]\d*)$/;

const DEFAULT_NAMESPACES: readonly NamespaceConfig[] = [{ prefix: "$ui", namespace: "ui" }];

const PATH_CACHE_MAX = 1000;
const pathCache = new Map<string, CanonicalPath>();

export interface NamespaceConfig {
  /** The prefix string used in paths (e.g. '$ui') */
  readonly prefix: string;
  /** The namespace value it maps to */
  readonly namespace: Namespace;
}

export interface ParsePathOptions {
  /** Recognized namespace prefixes. Defaults to [{ prefix: '$ui', namespace: 'ui' }] */
  readonly namespaces?: readonly NamespaceConfig[];
}

/**
 * Parse a supported path notation into a CanonicalPath.
 * Accepts dot paths, namespace dot paths, and JSON Pointers (RFC 6901).
 * Results are cached by input string for repeated lookups.
 */
export function parsePath(input: string, options?: ParsePathOptions): CanonicalPath {
  const cached = pathCache.get(input);
  if (cached) return cached;

  if (input === "") {
    throw new FormbarError("FORMBAR_PATH_EMPTY", "Path must not be empty");
  }

  const namespaces = options?.namespaces ?? DEFAULT_NAMESPACES;

  // Reject mixed namespace forms like $ui/...
  for (const ns of namespaces) {
    if (input.startsWith(`${ns.prefix}/`)) {
      throw new FormbarError(
        "FORMBAR_PATH_MIXED_NAMESPACE",
        `Mixed namespace form ${ns.prefix}/... is not allowed; use ${ns.prefix}. dot notation`,
      );
    }
  }

  let result: CanonicalPath;
  if (input.startsWith("/")) {
    result = parsePointer(input, namespaces);
  } else {
    result = parseDot(input, namespaces);
  }

  if (pathCache.size >= PATH_CACHE_MAX) {
    pathCache.clear();
  }
  pathCache.set(input, result);
  return result;
}

/**
 * Serialize a canonical data-namespace path to JSON Pointer (RFC 6901).
 */
export function toPointer(path: CanonicalPath): string {
  if (path.namespace === "ui") {
    throw new FormbarError("FORMBAR_PATH_MIXED_NAMESPACE", "Cannot convert ui-namespace path to JSON Pointer");
  }
  return `/${path.segments.map(encodePointerSegment).join("/")}`;
}

function encodePointerSegment(seg: CanonicalSegment): string {
  const s = String(seg);
  return s.replace(/~/g, "~0").replace(/\//g, "~1");
}

/**
 * Serialize a canonical path to dot notation.
 * Throws FORMBAR_PATH_NOT_DOT_SAFE if a segment contains characters
 * that cannot be represented unambiguously in dot notation.
 */
export function toDot(path: CanonicalPath): string {
  for (const seg of path.segments) {
    const s = String(seg);
    if (!DOT_SAFE_SEGMENT_RE.test(s)) {
      throw new FormbarError(
        "FORMBAR_PATH_NOT_DOT_SAFE",
        `Segment "${s}" contains characters not representable in dot notation`,
      );
    }
    if (typeof seg === "string" && NUMERIC_INDEX_RE.test(seg)) {
      throw new FormbarError(
        "FORMBAR_PATH_NOT_DOT_SAFE",
        `String segment "${seg}" is ambiguous in dot notation (looks numeric)`,
      );
    }
  }

  const dotPath = path.segments.map(String).join(".");
  return path.namespace === "ui" ? `$ui.${dotPath}` : dotPath;
}
