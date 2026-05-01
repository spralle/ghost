/** Check if a value is serializable for cross-window RPC. */
export function isSerializable(value: unknown, seen: WeakSet<object> = new WeakSet()): boolean {
  if (value === null || value === undefined) return true;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return true;
  if (t === "function" || t === "symbol") return false;
  if (typeof Node !== "undefined" && value instanceof Node) return false;
  if (typeof Element !== "undefined" && value instanceof Element) return false;
  const obj = value as object;
  if (seen.has(obj)) return false;
  seen.add(obj);
  if (Array.isArray(value)) return value.every((v) => isSerializable(v, seen));
  if (t === "object") {
    return Object.values(value as Record<string, unknown>).every((v) => isSerializable(v, seen));
  }
  return false;
}

/** Assert all arguments are serializable. Throws descriptive error if not. */
export function assertSerializableArgs(
  serviceName: string,
  methodName: string,
  args: unknown[],
): void {
  for (let i = 0; i < args.length; i++) {
    if (!isSerializable(args[i])) {
      throw new Error(
        `Service "${serviceName}.${methodName}" received non-serializable argument at index ${i} (${typeof args[i]}). ` +
          `Cross-window auto-proxy requires serializable arguments. ` +
          `Consider adding an "activations" entry in your plugin manifest for secondary window behavior.`,
      );
    }
  }
}
