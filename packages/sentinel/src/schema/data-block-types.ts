import type { DotPaths } from "kuery";

export type SensitivityTier = "public" | "standard" | "restricted" | "controlled";

export interface AudienceOverride {
  readonly partyType: string;
  readonly tier: SensitivityTier;
}

export interface DataBlockConfig<T> {
  readonly fields: readonly DotPaths<T>[];
  readonly sensitivity?: {
    readonly tier: SensitivityTier;
    readonly audienceOverrides?: readonly AudienceOverride[];
  };
}
