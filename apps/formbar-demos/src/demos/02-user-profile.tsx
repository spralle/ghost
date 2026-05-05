import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["firstName", "lastName", "email", "role"],
  properties: {
    firstName: { type: "string", title: "First Name" },
    lastName: { type: "string", title: "Last Name" },
    email: { type: "string", title: "Email", format: "email" },
    age: { type: "integer", title: "Age", minimum: 18, maximum: 120 },
    role: { type: "string", title: "Role", enum: ["Developer", "Designer", "Manager", "QA", "DevOps"] },
    department: {
      type: "string",
      title: "Department",
      enum: ["Engineering", "Product", "Marketing", "Sales", "HR", "Finance", "Legal", "Operations"],
    },
    bio: { type: "string", title: "Bio", maxLength: 500, description: "Tell us about yourself" },
    newsletter: { type: "boolean", title: "Subscribe to Newsletter", description: "Receive weekly updates" },
  },
};

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "personal",
      props: { title: "Personal Information", columns: 2 },
      children: [
        { type: "field", id: "f-firstName", path: "firstName" },
        { type: "field", id: "f-lastName", path: "lastName" },
        { type: "field", id: "f-email", path: "email" },
        { type: "field", id: "f-age", path: "age" },
      ],
    },
    {
      type: "section",
      id: "work",
      props: { title: "Work Details", columns: 2 },
      children: [
        { type: "field", id: "f-role", path: "role" },
        { type: "field", id: "f-department", path: "department" },
      ],
    },
    {
      type: "section",
      id: "preferences",
      props: { title: "Preferences" },
      children: [
        { type: "field", id: "f-bio", path: "bio" },
        { type: "field", id: "f-newsletter", path: "newsletter" },
      ],
    },
  ],
};

export function UserProfileDemo() {
  return (
    <DemoShell
      title="User Profile"
      description="Multi-column layout with enum fields (RadioGroup and Select), slider for age, textarea, and boolean switch."
      motivation="Demonstrates enum-to-widget mapping (radio groups, selects) and number constraints rendered as sliders. Shows how the system automatically chooses the right input based on schema metadata — no manual widget wiring."
      features={["2-Column Layout", "RadioGroup (≤5)", "Select (>5)", "Slider (Age)", "Textarea", "Switch"]}
      schema={schema}
      layout={layout}
    >
      <DemoFormRoot
        schema={schema}
        data={{}}
        layout={layout}
        onChange={(path, value) => console.log("change", path, value)}
        responsive
      />
    </DemoShell>
  );
}
