import { useSentinel } from "./sentinel-context.js";

export interface UseDataBlockResult {
  readonly granted: boolean;
  readonly fields: readonly string[];
}

export function useDataBlock(blockName: string): UseDataBlockResult {
  const { snapshot } = useSentinel();
  const fields = snapshot.redactionMap[blockName];

  if (fields) {
    return { granted: true, fields };
  }
  return { granted: false, fields: [] };
}
