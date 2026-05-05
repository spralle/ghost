"use client";

import type { FormApi } from "@formbar/core";
import type { SchemaFieldInfo } from "@formbar/from-schema";
import type { RendererRegistry, ResolvedFieldState } from "@formbar/react";
import { DEFAULT_FIELD_STATE } from "@formbar/react";
import { createContext, useContext } from "react";
import type { WidgetOverrides } from "./widget-overrides";

export interface SchemaFormContextValue {
  readonly form: FormApi<unknown, unknown>;
  readonly fields: readonly SchemaFieldInfo[];
  readonly overrides?: WidgetOverrides | undefined;
  readonly registry: RendererRegistry;
  readonly fieldStates?: ReadonlyMap<string, ResolvedFieldState> | undefined;
}

const SchemaFormContext = createContext<SchemaFormContextValue | null>(null);

export function SchemaFormProvider({
  value,
  children,
}: {
  readonly value: SchemaFormContextValue;
  readonly children: React.ReactNode;
}) {
  return <SchemaFormContext.Provider value={value}>{children}</SchemaFormContext.Provider>;
}

export function useSchemaFormContext(): SchemaFormContextValue {
  const ctx = useContext(SchemaFormContext);
  if (!ctx) {
    throw new Error("useSchemaFormContext must be used within a SchemaForm");
  }
  return ctx;
}

/** Convenience hook to get resolved field state for a specific path */
export function useFieldState(path: string): ResolvedFieldState {
  const { fieldStates } = useSchemaFormContext();
  return fieldStates?.get(path) ?? DEFAULT_FIELD_STATE;
}
