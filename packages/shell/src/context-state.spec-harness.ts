import { expect, it } from "vitest";

export interface SpecHarness {
	test: (name: string, run: () => void | Promise<void>) => void;
	assertEqual: (actual: unknown, expected: unknown, message: string) => void;
	assertTruthy: (value: unknown, message: string) => void;
}

export class MemoryStorage {
	private readonly map = new Map<string, string>();

	getItem(key: string): string | null {
		return this.map.has(key) ? (this.map.get(key) ?? null) : null;
	}

	setItem(key: string, value: string): void {
		this.map.set(key, value);
	}
}

/**
 * Creates a spec harness that bridges to vitest primitives.
 * Each `test()` call registers a vitest `it()`, and assertions use `expect()`.
 */
export function createSpecHarness(): SpecHarness {
	return {
		test: it,
		assertEqual(actual, expected, _message) {
			expect(actual).toBe(expected);
		},
		assertTruthy(value, _message) {
			expect(value).toBeTruthy();
		},
	};
}
