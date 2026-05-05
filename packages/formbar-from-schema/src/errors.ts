export type FromSchemaErrorCode =
  | "FORMBAR_SCHEMA_UNSUPPORTED"
  | "FORMBAR_ZOD_XFORMBAR_FORBIDDEN"
  | "FORMBAR_SCHEMA_PARSE_FAILED"
  | "FORMBAR_META_CONFLICT"
  | "FORMBAR_UI_SCHEMA_REQUIRED"
  | "FORMBAR_LAYOUT_UNKNOWN_NODE_TYPE";

export class FromSchemaError extends Error {
  readonly code: FromSchemaErrorCode;

  constructor(code: FromSchemaErrorCode, message: string) {
    super(message);
    this.name = "FromSchemaError";
    this.code = code;
  }
}
