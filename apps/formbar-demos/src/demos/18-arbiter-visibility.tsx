import { useForm } from "@formbar/react";
import { Card, CardContent, CardHeader, CardTitle, cn } from "@ghost-shell/ui";
import { DemoShell } from "../renderers/DemoShell";

// NOTE: $ui entries are synced shallowly (top-level keys only).
// Use flat keys like '$ui.showField' rather than nested '$ui.section.field.visible'.

interface FormData {
  readonly country: string;
  readonly state: string;
  readonly province: string;
  readonly region: string;
}

interface UiState {
  readonly showState: boolean;
  readonly showProvince: boolean;
}

const arbiterRules = [
  {
    name: "showUSState",
    when: { country: "US" },
    then: [{ $set: { "$ui.showState": true, "$ui.showProvince": false } }],
  },
  {
    name: "showCAProvince",
    when: { country: "CA" },
    then: [{ $set: { "$ui.showState": false, "$ui.showProvince": true } }],
  },
  {
    name: "hideRegional",
    when: { country: { $nin: ["US", "CA"] } },
    then: [{ $set: { "$ui.showState": false, "$ui.showProvince": false } }],
  },
] as const;

const schema = {
  type: "object",
  properties: {
    country: { type: "string", title: "Country", enum: ["US", "CA", "UK", "DE"] },
    state: { type: "string", title: "State" },
    province: { type: "string", title: "Province" },
    region: { type: "string", title: "Region" },
  },
};

const US_STATES = ["California", "New York", "Texas", "Florida"];
const CA_PROVINCES = ["Ontario", "Quebec", "British Columbia", "Alberta"];

export function ArbiterVisibilityDemo() {
  const form = useForm<FormData, UiState>({
    initialData: { country: "", state: "", province: "", region: "" },
    initialUiState: { showState: false, showProvince: false },
    arbiterRules,
  });

  const { data, uiState } = form.getState();

  return (
    <DemoShell
      title="Arbiter: Conditional Visibility"
      description="Rules drive field visibility via $ui state. Selecting a country triggers arbiter rules that set $ui.showState or $ui.showProvince, replacing complex useEffect chains."
      motivation="Arbiter rules declaratively express visibility logic. Instead of imperative useEffect chains that grow tangled, rules are self-contained, testable, and composable."
      features={["Arbiter Rules", "$ui Namespace", "Conditional Visibility", "Declarative Logic"]}
      schema={schema}
      codeBlocks={[{ title: "Arbiter Rules", code: arbiterRules as unknown as object, defaultOpen: true }]}
    >
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Country Selector</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Country</span>
            <select
              className={cn("rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground")}
              value={data.country}
              onChange={(e) => form.setValue("country", e.target.value)}
            >
              <option value="">Select country...</option>
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="UK">United Kingdom</option>
              <option value="DE">Germany</option>
            </select>
          </label>

          {uiState.showState && (
            <label className="flex flex-col gap-1 animate-in fade-in-0 duration-200">
              <span className="text-sm font-medium text-foreground">State</span>
              <select
                className={cn("rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground")}
                value={data.state}
                onChange={(e) => form.setValue("state", e.target.value)}
              >
                <option value="">Select state...</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          {uiState.showProvince && (
            <label className="flex flex-col gap-1 animate-in fade-in-0 duration-200">
              <span className="text-sm font-medium text-foreground">Province</span>
              <select
                className={cn("rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground")}
                value={data.province}
                onChange={(e) => form.setValue("province", e.target.value)}
              >
                <option value="">Select province...</option>
                {CA_PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!uiState.showState && !uiState.showProvince && data.country && (
            <label className="flex flex-col gap-1 animate-in fade-in-0 duration-200">
              <span className="text-sm font-medium text-foreground">Region</span>
              <input
                className={cn("rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground")}
                value={data.region}
                onChange={(e) => form.setValue("region", e.target.value)}
                placeholder="Enter region..."
              />
            </label>
          )}

          <div className="mt-4 rounded-md bg-surface-inset border border-border-muted p-3">
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
