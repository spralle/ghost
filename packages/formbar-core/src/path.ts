export type Namespace = "data" | "ui";
export type CanonicalSegment = string | number;

export interface CanonicalPath {
  readonly namespace: Namespace;
  readonly segments: readonly CanonicalSegment[];
}
