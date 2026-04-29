/**
 * Rewrites the publicPath in Module Federation manifests to an absolute URL.
 *
 * The gateway is the single source of truth for origin/port/pluginId,
 * so rewriting happens here rather than coupling plugins to env vars.
 *
 * Only publicPath is rewritten — asset paths in shared[] and exposes[]
 * remain relative because the federation runtime resolves them against
 * publicPath automatically. Prefixing both causes doubled URLs.
 */

interface MfManifest {
  metaData?: { publicPath?: string };
  shared?: MfEntry[];
  exposes?: MfEntry[];
  [key: string]: unknown;
}

interface MfEntry {
  assets?: {
    js?: { sync?: string[]; async?: string[] };
    css?: { sync?: string[]; async?: string[] };
  };
  [key: string]: unknown;
}

/**
 * Deep-clones an MF manifest and sets `metaData.publicPath` to the given
 * absolute base URL. Asset paths remain relative — the federation runtime
 * resolves them against publicPath at load time.
 */
export function rewriteManifestPublicPath(
  manifest: Record<string, unknown>,
  absoluteBase: string,
): Record<string, unknown> {
  const rewritten = JSON.parse(JSON.stringify(manifest)) as MfManifest;

  if (rewritten.metaData) {
    rewritten.metaData.publicPath = absoluteBase;
  }

  return rewritten as Record<string, unknown>;
}