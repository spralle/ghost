import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_MOTION_CONFIG } from "../config-defaults.js";
import { clearMotionPreference, loadMotionPreference, saveMotionPreference } from "../motion-persistence.js";

// Mock localStorage for test environment
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
};

beforeEach(() => {
  store.clear();
  globalThis.localStorage = mockLocalStorage as unknown as Storage;
});

describe("motion-persistence", () => {
  it("round-trip: save then load returns identical config", () => {
    saveMotionPreference(DEFAULT_MOTION_CONFIG);
    const loaded = loadMotionPreference();
    expect(loaded).toEqual(DEFAULT_MOTION_CONFIG);
  });

  it("load returns null when nothing saved", () => {
    expect(loadMotionPreference()).toBeNull();
  });

  it("clear removes the stored preference", () => {
    saveMotionPreference(DEFAULT_MOTION_CONFIG);
    clearMotionPreference();
    expect(loadMotionPreference()).toBeNull();
  });

  it("load returns null on corrupted JSON", () => {
    store.set("ghost-shell-motion-preference", "{not valid json");
    expect(loadMotionPreference()).toBeNull();
  });
});
