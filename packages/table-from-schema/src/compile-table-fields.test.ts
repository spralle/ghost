import type { SchemaFieldInfo, SchemaFieldMetadata } from "@scheman/core";
import { describe, expect, it } from "vitest";
import { compileTableFields } from "./compile-table-fields.js";

function fieldWithMetadata(metadata: SchemaFieldMetadata): SchemaFieldInfo {
  return {
    path: "displayName",
    type: "string",
    required: false,
    metadata,
  };
}

describe("compileTableFields table annotations", () => {
  it("reads table annotations from Scheman metadata.extensions.table", () => {
    const [field] = compileTableFields([
      fieldWithMetadata({
        extensions: {
          table: {
            cell: "badge",
            cellProps: { tone: "success" },
            filterable: false,
            hidden: true,
            label: "Display name",
            pinned: "left",
            sortable: false,
          },
        },
      }),
    ]);

    expect(field).toMatchObject({
      field: "displayName",
      label: "Display name",
      visible: false,
      format: "badge",
      formatOptions: { tone: "success" },
      sortable: false,
      pinned: "left",
    });
    expect(field.filter).toBeUndefined();
  });

  it("falls back to legacy metadata.extra.table annotations", () => {
    const [field] = compileTableFields([
      fieldWithMetadata({
        extra: {
          table: {
            filterVariant: "select",
            label: "Legacy display name",
          },
        },
      }),
    ]);

    expect(field).toMatchObject({
      field: "displayName",
      label: "Legacy display name",
      filter: "select",
    });
  });

  it("prefers Scheman metadata.extensions.table over legacy extra annotations", () => {
    const [field] = compileTableFields([
      fieldWithMetadata({
        extensions: { table: { label: "Extensions label" } },
        extra: { table: { label: "Legacy label" } },
      }),
    ]);

    expect(field.label).toBe("Extensions label");
  });
});
