// Re-export from schema-core for backward compatibility
export {
  dereferenceSchema,
  extractFromJsonSchema,
  extractFromZod,
  extractFromZodV4,
  type JsonSchema,
} from "@ghost-shell/schema-core";

// Local exports
export {
  createJsonSchemaValidator,
  isJsonSchema,
  validateFormatDate,
  validateFormatDateTime,
} from "./json-schema-validator.js";
