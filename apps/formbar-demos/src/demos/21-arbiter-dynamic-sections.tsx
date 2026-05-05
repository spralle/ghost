import { useForm } from "@formbar/react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@ghost-shell/ui";
import { DemoShell } from "../renderers/DemoShell";

// NOTE: $ui entries are synced shallowly (top-level keys only).
// Use flat keys like '$ui.showField' rather than nested '$ui.section.field.visible'.

interface FormData {
  readonly coverageType: string;
  readonly make: string;
  readonly model: string;
  readonly year: number;
  readonly address: string;
  readonly sqft: number;
  readonly yearBuilt: number;
  readonly age: number;
  readonly smoker: boolean;
  readonly conditions: string;
}

interface UiState {
  readonly showAutoSection: boolean;
  readonly showHomeSection: boolean;
  readonly showLifeSection: boolean;
}

const arbiterRules = [
  {
    name: "autoSection",
    when: { coverageType: "auto" },
    then: [{ $set: { "$ui.showAutoSection": true, "$ui.showHomeSection": false, "$ui.showLifeSection": false } }],
  },
  {
    name: "homeSection",
    when: { coverageType: "home" },
    then: [{ $set: { "$ui.showAutoSection": false, "$ui.showHomeSection": true, "$ui.showLifeSection": false } }],
  },
  {
    name: "lifeSection",
    when: { coverageType: "life" },
    then: [{ $set: { "$ui.showAutoSection": false, "$ui.showHomeSection": false, "$ui.showLifeSection": true } }],
  },
  {
    name: "noSection",
    when: { coverageType: { $nin: ["auto", "home", "life"] } },
    then: [{ $set: { "$ui.showAutoSection": false, "$ui.showHomeSection": false, "$ui.showLifeSection": false } }],
  },
] as const;

const schema = {
  type: "object",
  properties: {
    coverageType: { type: "string", title: "Coverage Type", enum: ["auto", "home", "life"] },
  },
};

const inputClass = cn("rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground w-full");

function SectionWrapper({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 animate-in fade-in-0 slide-in-from-top-1 duration-200 border-t border-border-muted pt-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export function ArbiterDynamicSectionsDemo() {
  const form = useForm<FormData, UiState>({
    initialData: {
      coverageType: "",
      make: "",
      model: "",
      year: 0,
      address: "",
      sqft: 0,
      yearBuilt: 0,
      age: 0,
      smoker: false,
      conditions: "",
    },
    initialUiState: { showAutoSection: false, showHomeSection: false, showLifeSection: false },
    arbiterRules,
  });

  const { data, uiState } = form.getState();

  return (
    <DemoShell
      title="Arbiter: Dynamic Sections"
      description="An insurance quote form where selecting a coverage type reveals type-specific sections. Rules control which section is visible via $ui flags."
      motivation="Multi-section forms with mutually exclusive sections are common in enterprise apps. Arbiter rules make the visibility logic explicit and centralized — adding a new coverage type means adding one rule, not threading state through multiple components."
      features={["Arbiter Rules", "$ui Namespace", "Dynamic Sections", "Mutual Exclusion", "Insurance Form"]}
      schema={schema}
      codeBlocks={[{ title: "Arbiter Rules", code: arbiterRules as unknown as object, defaultOpen: true }]}
    >
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Insurance Quote</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Coverage Type</span>
            <select
              className={inputClass}
              value={data.coverageType}
              onChange={(e) => form.setValue("coverageType", e.target.value)}
            >
              <option value="">Select coverage...</option>
              <option value="auto">Auto</option>
              <option value="home">Home</option>
              <option value="life">Life</option>
            </select>
          </label>

          {uiState.showAutoSection && (
            <SectionWrapper title="Vehicle Information">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Make</span>
                <input
                  className={inputClass}
                  value={data.make}
                  onChange={(e) => form.setValue("make", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Model</span>
                <input
                  className={inputClass}
                  value={data.model}
                  onChange={(e) => form.setValue("model", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Year</span>
                <input
                  type="number"
                  className={inputClass}
                  value={data.year || ""}
                  onChange={(e) => form.setValue("year", Number(e.target.value) || 0)}
                />
              </label>
            </SectionWrapper>
          )}

          {uiState.showHomeSection && (
            <SectionWrapper title="Property Information">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Address</span>
                <input
                  className={inputClass}
                  value={data.address}
                  onChange={(e) => form.setValue("address", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Square Footage</span>
                <input
                  type="number"
                  className={inputClass}
                  value={data.sqft || ""}
                  onChange={(e) => form.setValue("sqft", Number(e.target.value) || 0)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Year Built</span>
                <input
                  type="number"
                  className={inputClass}
                  value={data.yearBuilt || ""}
                  onChange={(e) => form.setValue("yearBuilt", Number(e.target.value) || 0)}
                />
              </label>
            </SectionWrapper>
          )}

          {uiState.showLifeSection && (
            <SectionWrapper title="Health Information">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Age</span>
                <input
                  type="number"
                  className={inputClass}
                  value={data.age || ""}
                  onChange={(e) => form.setValue("age", Number(e.target.value) || 0)}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={data.smoker}
                  onChange={(e) => form.setValue("smoker", e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-xs text-muted-foreground">Smoker</span>
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">Pre-existing Conditions</span>
                <input
                  className={inputClass}
                  value={data.conditions}
                  onChange={(e) => form.setValue("conditions", e.target.value)}
                  placeholder="None, or describe..."
                />
              </label>
            </SectionWrapper>
          )}

          <div className="rounded-md bg-surface-inset border border-border-muted p-3 mt-2">
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
