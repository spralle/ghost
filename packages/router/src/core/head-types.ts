/** Meta tag descriptor. */
export interface MetaTag {
  readonly name?: string;
  readonly property?: string;
  readonly content: string;
}

/** Link tag descriptor. */
export interface LinkTag {
  readonly rel: string;
  readonly href: string;
  readonly type?: string;
}

/** Head configuration for a route. */
export interface HeadConfig {
  /** Document title (last wins in nested merge). */
  readonly title?: string;
  /** Meta tags (merged by name/property key). */
  readonly meta?: readonly MetaTag[];
  /** Link tags (merged by rel+type key). */
  readonly link?: readonly LinkTag[];
}

/** Options for the head manager. */
export interface HeadManagerOptions {
  /** Title template from workspace config. Use {title} as placeholder. */
  readonly titleTemplate?: string;
  /** Default head config (applied when no route-specific config). */
  readonly defaults?: HeadConfig;
}
