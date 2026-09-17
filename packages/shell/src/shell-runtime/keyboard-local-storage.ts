function hasLocalStorageGetItem(storage: unknown): storage is { getItem: (key: string) => string | null } {
  return (
    typeof storage === "object" && storage !== null && "getItem" in storage && typeof storage.getItem === "function"
  );
}

export function readLocalStorageItem(key: string): string | null {
  try {
    if (!("localStorage" in globalThis)) {
      return null;
    }

    const storage = globalThis.localStorage;

    if (!hasLocalStorageGetItem(storage)) {
      return null;
    }

    return storage.getItem(key);
  } catch {
    return null;
  }
}
