import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["name", "email"],
  properties: {
    name: { type: "string", title: "Full Name" },
    email: { type: "string", title: "Email", format: "email" },
    homeAddress: {
      type: "object",
      title: "Home Address",
      properties: {
        street: { type: "string", title: "Street" },
        city: { type: "string", title: "City" },
        state: { type: "string", title: "State/Province" },
        zipCode: { type: "string", title: "Zip/Postal Code" },
        country: {
          type: "string",
          title: "Country",
          enum: ["United States", "Canada", "United Kingdom", "Germany", "France", "Australia", "Japan", "Other"],
        },
      },
    },
    workAddress: {
      type: "object",
      title: "Work Address",
      properties: {
        street: { type: "string", title: "Street" },
        city: { type: "string", title: "City" },
        state: { type: "string", title: "State/Province" },
        zipCode: { type: "string", title: "Zip/Postal Code" },
        country: {
          type: "string",
          title: "Country",
          enum: ["United States", "Canada", "United Kingdom", "Germany", "France", "Australia", "Japan", "Other"],
        },
      },
    },
  },
};

export function NestedAddressDemo() {
  return (
    <DemoShell
      title="Nested Address Form"
      description="Demonstrates auto-layout generation for nested JSON Schema objects. No manual layout override — the layout compiler groups nested fields automatically."
      motivation="Proves the engine handles nested object schemas with automatic grouping. Developers describe hierarchical data and get organized form sections without writing layout code."
      features={["Auto Layout", "Nested Objects", "Path Grouping", "Select (Country)"]}
      schema={schema}
    >
      <DemoFormRoot
        schema={schema}
        data={{}}
        onChange={(path, value) => console.log("change", path, value)}
        responsive
      />
    </DemoShell>
  );
}
