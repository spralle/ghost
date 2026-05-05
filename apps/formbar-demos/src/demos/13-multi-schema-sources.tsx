import { cn } from "@ghost-shell/ui";
import { useState } from "react";
import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const minimalSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string", format: "email" },
    age: { type: "integer" },
    role: { type: "string", enum: ["Admin", "User", "Guest"] },
    active: { type: "boolean" },
  },
} as const;

const explicitSchema = {
  type: "object",
  required: ["name", "email", "role"],
  properties: {
    name: {
      type: "string",
      title: "Full Name",
      description: "Your complete name as it appears on official documents",
      minLength: 2,
      maxLength: 100,
    },
    email: { type: "string", title: "Email Address", format: "email", description: "Primary contact email" },
    age: { type: "integer", title: "Age", minimum: 0, maximum: 150, description: "Your age in years" },
    role: {
      type: "string",
      title: "User Role",
      enum: ["Admin", "User", "Guest"],
      description: "Access level in the system",
    },
    active: { type: "boolean", title: "Account Active", description: "Enable or disable this account" },
  },
} as const;

export function MultiSchemaSourcesDemo() {
  const [mode, setMode] = useState<"minimal" | "explicit">("minimal");
  const schema = mode === "minimal" ? minimalSchema : explicitSchema;

  return (
    <DemoShell
      title="Multiple Schema Sources"
      description="Formbar's ingestSchema() auto-detects multiple formats: JSON Schema, Zod v3/v4, Standard Schema v1. This demo shows minimal vs. explicit JSON Schema defining the same form — demonstrating flexible DX."
      motivation="Demonstrates schema ingestion from multiple input formats. Shows that formbar's adapter architecture means teams can bring their existing schemas — JSON Schema, Zod, or Standard Schema — without rewriting."
      features={["Auto-Detection", "JSON Schema", "Zod v3/v4", "Standard Schema v1", "Flexible DX"]}
      schema={schema}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("minimal")}
            className={cn(
              mode === "minimal" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            )}
          >
            Minimal Schema
          </button>
          <button
            type="button"
            onClick={() => setMode("explicit")}
            className={cn(
              mode === "explicit" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            )}
          >
            Explicit Schema
          </button>
        </div>
        <DemoFormRoot key={mode} schema={schema} data={{}} onChange={(p, v) => console.log(p, v)} responsive />
      </div>
    </DemoShell>
  );
}
