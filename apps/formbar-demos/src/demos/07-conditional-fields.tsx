import type { FormApi } from "@formbar/core";
import type { SchemaFieldInfo } from "@formbar/from-schema";
import { useSchemaForm } from "@formbar/react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@ghost-shell/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DemoFormField } from "../renderers/DemoFormField";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["employmentStatus"],
  properties: {
    employmentStatus: {
      type: "string",
      title: "Employment Status",
      enum: ["Employed", "Self-Employed", "Student", "Retired", "Unemployed"],
    },
    companyName: { type: "string", title: "Company Name", description: "Your employer" },
    jobTitle: { type: "string", title: "Job Title" },
    businessName: { type: "string", title: "Business Name" },
    businessType: {
      type: "string",
      title: "Business Type",
      enum: ["Sole Proprietorship", "LLC", "Corporation", "Partnership"],
    },
    schoolName: { type: "string", title: "School / University" },
    fieldOfStudy: { type: "string", title: "Field of Study" },
    annualIncome: { type: "number", title: "Annual Income", minimum: 0 },
    hasHealthInsurance: {
      type: "boolean",
      title: "Health Insurance",
      description: "Do you have health insurance?",
    },
  },
};

const VISIBILITY_RULES: Record<string, readonly string[]> = {
  Employed: ["companyName", "jobTitle", "annualIncome", "hasHealthInsurance"],
  "Self-Employed": ["businessName", "businessType", "annualIncome", "hasHealthInsurance"],
  Student: ["schoolName", "fieldOfStudy", "hasHealthInsurance"],
  Retired: ["annualIncome", "hasHealthInsurance"],
  Unemployed: ["hasHealthInsurance"],
};

function getSectionTitle(status: string): string {
  if (status === "Employed") return "Employment Details";
  if (status === "Self-Employed") return "Business Details";
  if (status === "Student") return "Education Details";
  return "Details";
}

function ConditionalForm({
  form,
  fieldMap,
  onChange,
  status,
}: {
  form: FormApi;
  fieldMap: Map<string, SchemaFieldInfo>;
  onChange: (path: string, value: unknown) => void;
  status: string;
}) {
  const visiblePaths = VISIBILITY_RULES[status] ?? [];
  const statusField = fieldMap.get("employmentStatus");

  return (
    <div className="flex flex-col gap-4">
      {statusField && <DemoFormField form={form} field={statusField} onChange={onChange} />}

      {status && (
        <div className="flex flex-col gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <h3 className="text-sm font-semibold text-foreground">{getSectionTitle(status)}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visiblePaths.map((path) => {
              const field = fieldMap.get(path);
              if (!field) return null;
              return <DemoFormField key={path} form={form} field={field} onChange={onChange} />;
            })}
          </div>
        </div>
      )}

      {!status && (
        <p
          className={cn(
            "text-sm text-muted-foreground italic p-4 rounded-md",
            "border border-border-muted bg-surface-inset",
          )}
        >
          Select an employment status to see relevant fields
        </p>
      )}
    </div>
  );
}

export function ConditionalFieldsDemo() {
  const { form, fields } = useSchemaForm(schema, { initialData: {} as Record<string, unknown> });
  const [status, setStatus] = useState("");

  const fieldMap = useMemo(() => {
    const map = new Map<string, SchemaFieldInfo>();
    for (const f of fields) map.set(f.path, f);
    return map;
  }, [fields]);

  const handleChange = useCallback((path: string, value: unknown) => {
    if (path === "employmentStatus") setStatus(String(value ?? ""));
    console.log("change", path, value);
  }, []);

  const [formData, setFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    return form.subscribe(() => {
      setFormData({ ...(form.getState().data as Record<string, unknown>) });
    });
  }, [form]);

  return (
    <DemoShell
      title="Conditional Fields"
      description="Sections dynamically show/hide based on the Employment Status selection. Only relevant fields appear for each status. This demonstrates UI-level visibility rules driven by form state."
      motivation="Shows dynamic form behavior — fields appear/disappear based on user selection. This is the most requested enterprise form feature: context-sensitive forms that don't overwhelm users with irrelevant fields."
      features={["Show/Hide Sections", "Dynamic Visibility", "RadioGroup", "Responsive Grid", "State-Driven UI"]}
      schema={schema}
    >
      <div className="flex flex-col gap-4">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Live Form</CardTitle>
          </CardHeader>
          <CardContent>
            <ConditionalForm form={form} fieldMap={fieldMap} onChange={handleChange} status={status} />
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">Form Data (JSON)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-surface-inset p-3 text-xs text-code-foreground overflow-auto max-h-48 border border-border-muted font-mono">
              {JSON.stringify(formData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </DemoShell>
  );
}
