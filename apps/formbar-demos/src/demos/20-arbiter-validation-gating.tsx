import { useForm } from "@formbar/react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@ghost-shell/ui";
import { useState } from "react";
import { DemoShell } from "../renderers/DemoShell";

// NOTE: $ui entries are synced shallowly (top-level keys only).
// Use flat keys like '$ui.showField' rather than nested '$ui.section.field.visible'.

interface FormData {
  readonly name: string;
  readonly email: string;
  readonly age: number;
  readonly agreeToTerms: boolean;
}

interface UiState {
  readonly canSubmit: boolean;
}

const arbiterRules = [
  { name: "canSubmit", when: { agreeToTerms: true }, then: [{ $set: { "$ui.canSubmit": true } }] },
  { name: "cannotSubmit", when: { agreeToTerms: { $ne: true } }, then: [{ $set: { "$ui.canSubmit": false } }] },
] as const;

const schema = {
  type: "object",
  properties: {
    name: { type: "string", title: "Full Name" },
    email: { type: "string", title: "Email", format: "email" },
    age: { type: "number", title: "Age", minimum: 18 },
    agreeToTerms: { type: "boolean", title: "I agree to the Terms of Service" },
  },
};

export function ArbiterValidationGatingDemo() {
  const form = useForm<FormData, UiState>({
    initialData: { name: "", email: "", age: 0, agreeToTerms: false },
    initialUiState: { canSubmit: false },
    arbiterRules,
  });

  const { data, uiState } = form.getState();
  const [submitted, setSubmitted] = useState(false);

  return (
    <DemoShell
      title="Arbiter: Validation Gating"
      description="Rules control whether the submit button is enabled via $ui.canSubmit. The 'agree to terms' checkbox drives the rule, gating form submission declaratively."
      motivation="Instead of scattering disabled-state logic across event handlers, a single rule declares the invariant: 'submit is allowed when terms are accepted.' This is auditable, testable, and trivial to extend with more conditions."
      features={["Arbiter Rules", "$ui Namespace", "Submit Gating", "Declarative Validation"]}
      schema={schema}
      codeBlocks={[{ title: "Arbiter Rules", code: arbiterRules as unknown as object, defaultOpen: true }]}
    >
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Signup Form</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Full Name</span>
            <input
              className={cn("rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground")}
              value={data.name}
              onChange={(e) => form.setValue("name", e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Email</span>
            <input
              type="email"
              className={cn("rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground")}
              value={data.email}
              onChange={(e) => form.setValue("email", e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Age</span>
            <input
              type="number"
              min={0}
              className={cn("rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground")}
              value={data.age || ""}
              onChange={(e) => form.setValue("age", Number(e.target.value) || 0)}
            />
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.agreeToTerms}
              onChange={(e) => form.setValue("agreeToTerms", e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">I agree to the Terms of Service</span>
          </label>

          <button
            type="button"
            disabled={!uiState.canSubmit}
            onClick={() => setSubmitted(true)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              uiState.canSubmit
                ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            {uiState.canSubmit ? "Submit" : "Accept terms to continue"}
          </button>

          {submitted && (
            <p className="text-sm text-green-600 font-medium animate-in fade-in-0 duration-200">
              ✓ Form submitted successfully!
            </p>
          )}

          <div className="rounded-md bg-surface-inset border border-border-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Form Data</p>
            <pre className="text-xs text-code-foreground font-mono">{JSON.stringify(data, null, 2)}</pre>
          </div>
          <div className="rounded-md bg-surface-inset border border-border-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">UI State</p>
            <pre className="text-xs text-code-foreground font-mono">{JSON.stringify(uiState, null, 2)}</pre>
          </div>
        </CardContent>
      </Card>
    </DemoShell>
  );
}
