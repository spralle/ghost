import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["textField", "emailField", "selectSmall", "selectLarge"],
  properties: {
    textField: { type: "string", title: "Text Input", description: "Standard text field" },
    emailField: { type: "string", title: "Email Input", format: "email", description: "Email format validation" },
    urlField: { type: "string", title: "URL Input", format: "uri", description: "URL format validation" },
    textareaField: {
      type: "string",
      title: "Textarea",
      "x-formbar": { widget: "textarea" },
      description: "Multi-line text via x-formbar widget hint",
    },
    longTextField: {
      type: "string",
      title: "Auto Textarea",
      maxLength: 500,
      description: "Becomes textarea when maxLength > 200",
    },
    numberField: { type: "number", title: "Number Input", description: "Free-form number" },
    integerField: { type: "integer", title: "Integer Input", description: "Whole numbers only" },
    sliderField: {
      type: "integer",
      title: "Slider",
      minimum: 0,
      maximum: 100,
      description: "Number with min/max renders as slider",
    },
    switchField: { type: "boolean", title: "Switch Toggle", description: "Boolean field renders as switch" },
    selectSmall: {
      type: "string",
      title: "RadioGroup (≤5 options)",
      enum: ["Option A", "Option B", "Option C"],
      description: "Small enums render as radio group",
    },
    selectLarge: {
      type: "string",
      title: "Select (>5 options)",
      enum: ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"],
      description: "Larger enums render as select dropdown",
    },
    requiredField: { type: "string", title: "Required Field", description: "Shows 'Required' badge" },
    withDefault: { type: "string", title: "With Default Value", description: "Pre-populated from initial data" },
  },
} as const;

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "text-inputs",
      props: { title: "Text Inputs", columns: 2 },
      children: [
        { type: "field", id: "f-text", path: "textField" },
        { type: "field", id: "f-email", path: "emailField" },
        { type: "field", id: "f-url", path: "urlField" },
        { type: "field", id: "f-required", path: "requiredField" },
      ],
    },
    {
      type: "section",
      id: "textarea-inputs",
      props: { title: "Textarea Variants" },
      children: [
        { type: "field", id: "f-textarea", path: "textareaField" },
        { type: "field", id: "f-longtext", path: "longTextField" },
      ],
    },
    {
      type: "section",
      id: "number-inputs",
      props: { title: "Number Inputs", columns: 2 },
      children: [
        { type: "field", id: "f-number", path: "numberField" },
        { type: "field", id: "f-integer", path: "integerField" },
        { type: "field", id: "f-slider", path: "sliderField" },
        { type: "field", id: "f-with-default", path: "withDefault" },
      ],
    },
    {
      type: "section",
      id: "selection-inputs",
      props: { title: "Selection Controls" },
      children: [
        { type: "field", id: "f-radio", path: "selectSmall" },
        { type: "field", id: "f-select", path: "selectLarge" },
      ],
    },
    {
      type: "section",
      id: "boolean-inputs",
      props: { title: "Boolean Controls" },
      children: [{ type: "field", id: "f-switch", path: "switchField" }],
    },
  ],
} as const;

const data = { withDefault: "Hello, ARB!" };

export function KitchenSinkDemo() {
  return (
    <DemoShell
      title="Kitchen Sink"
      description="Every supported field type and layout feature in one form. This is the complete showcase of formbar's schema-to-form rendering capabilities with the shadcn component library."
      motivation="Every field type and feature in one form. This is the stress test — if the system handles this, it handles anything. Shows the complete widget palette available out of the box."
      features={[
        "All Field Types",
        "Text Input",
        "Email/URL",
        "Textarea",
        "Number",
        "Slider",
        "Switch",
        "RadioGroup",
        "Select",
        "Required Badge",
        "Default Values",
        "Multi-Column",
        "Sections",
      ]}
      schema={schema}
      layout={layout}
    >
      <DemoFormRoot schema={schema} data={data} layout={layout} onChange={(p, v) => console.log(p, v)} responsive />
    </DemoShell>
  );
}
