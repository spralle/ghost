import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["projectName"],
  properties: {
    projectName: { type: "string", title: "Project Name" },
    description: { type: "string", title: "Description", "x-formbar": { widget: "textarea" } },
    priority: { type: "string", title: "Priority", enum: ["Low", "Medium", "High", "Critical"] },
    tags: {
      type: "array",
      title: "Tags",
      items: { type: "string" },
    },
    teamMembers: {
      type: "array",
      title: "Team Members",
      items: {
        type: "object",
        properties: {
          name: { type: "string", title: "Name" },
          role: { type: "string", title: "Role", enum: ["Lead", "Developer", "Designer", "QA"] },
          email: { type: "string", title: "Email" },
        },
      },
    },
    addresses: {
      type: "array",
      title: "Office Locations",
      items: {
        type: "object",
        properties: {
          label: { type: "string", title: "Label", enum: ["HQ", "Branch", "Remote", "Warehouse"] },
          street: { type: "string", title: "Street Address" },
          city: { type: "string", title: "City" },
          state: { type: "string", title: "State/Province" },
          postalCode: { type: "string", title: "Postal Code" },
          country: { type: "string", title: "Country" },
          isPrimary: { type: "boolean", title: "Primary Location" },
        },
      },
    },
    milestones: {
      type: "array",
      title: "Milestones",
      items: {
        type: "object",
        properties: {
          title: { type: "string", title: "Milestone" },
          dueDate: { type: "string", title: "Due Date" },
          completed: { type: "boolean", title: "Completed" },
        },
      },
    },
    isPublic: { type: "boolean", title: "Public Project", description: "Visible to all organization members" },
  },
};

export function ArrayItemsDemo() {
  return (
    <DemoShell
      title="Array/Repeatable Items"
      description="Shows how formbar handles array fields in JSON Schema. Simple arrays, object arrays, and nested structures are all supported. Array items render with schema-aware controls including enums, booleans, and text inputs."
      motivation="Demonstrates repeatable field groups with add/remove controls. Covers primitive arrays (tags), object arrays (team members, addresses), and mixed field types within items. Critical for order entry, configuration lists, and any variable-length data."
      features={[
        "Array Fields",
        "Primitive Arrays",
        "Object Arrays",
        "Address Arrays",
        "Enum in Arrays",
        "Boolean in Arrays",
        "Mixed Types",
      ]}
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
