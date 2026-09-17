function describe(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function schemaTypeMatches(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

function resolveReference(rootSchema, reference) {
  if (!reference.startsWith("#/$defs/")) throw new Error(`unsupported schema reference ${reference}`);
  const key = reference.slice("#/$defs/".length);
  const target = rootSchema.$defs?.[key];
  if (!target) throw new Error(`unresolved schema reference ${reference}`);
  return target;
}

function validateString(value, schema, path) {
  if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
    throw new Error(`${path} does not match ${schema.pattern}`);
  }
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    throw new Error(`${path} must contain at least ${schema.minLength} characters`);
  }
}

function validateArray(value, schema, context) {
  const { path, rootSchema } = context;
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    throw new Error(`${path} must contain at least ${schema.minItems} items`);
  }
  if (schema.uniqueItems) {
    const serialized = value.map((item) => JSON.stringify(item));
    if (new Set(serialized).size !== value.length) throw new Error(`${path} contains duplicate items`);
  }
  if (schema.items) {
    for (const [index, item] of value.entries()) {
      validateNode(item, schema.items, { path: `${path}[${index}]`, rootSchema });
    }
  }
}

function validateObject(value, schema, context) {
  const { path, rootSchema } = context;
  const properties = schema.properties ?? {};
  for (const key of schema.required ?? []) {
    if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required`);
  }
  if (schema.additionalProperties === false) {
    const unknown = Object.keys(value).find((key) => !Object.hasOwn(properties, key));
    if (unknown) throw new Error(`${path}.${unknown} is not allowed`);
  }
  for (const [key, child] of Object.entries(properties)) {
    if (Object.hasOwn(value, key)) validateNode(value[key], child, { path: `${path}.${key}`, rootSchema });
  }
}

function validateNode(value, sourceSchema, context) {
  const schema = sourceSchema.$ref ? resolveReference(context.rootSchema, sourceSchema.$ref) : sourceSchema;
  if (schema.const !== undefined && value !== schema.const)
    throw new Error(`${context.path} must equal ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${context.path} is not an allowed value`);
  if (schema.type && !schemaTypeMatches(value, schema.type)) {
    throw new Error(`${context.path} must be ${schema.type}, received ${describe(value)}`);
  }
  if (typeof value === "string") validateString(value, schema, context.path);
  if (Array.isArray(value)) validateArray(value, schema, context);
  if (schemaTypeMatches(value, "object")) validateObject(value, schema, context);
}

export function validateJsonSchema(value, schema, label = "document") {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) throw new Error(`${label} schema is malformed`);
  validateNode(value, schema, { path: label, rootSchema: schema });
}
