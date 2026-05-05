import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["firstName", "lastName"],
  properties: {
    firstName: { type: "string", title: "First Name" },
    lastName: { type: "string", title: "Last Name" },
    dateOfBirth: { type: "string", title: "Date of Birth", description: "YYYY-MM-DD format" },
    gender: { type: "string", title: "Gender", enum: ["Male", "Female", "Non-Binary", "Prefer not to say"] },
    nationality: { type: "string", title: "Nationality" },
    passportNumber: { type: "string", title: "Passport Number" },
    emergencyContactName: { type: "string", title: "Emergency Contact Name" },
    emergencyContactPhone: { type: "string", title: "Emergency Contact Phone" },
    emergencyRelationship: {
      type: "string",
      title: "Relationship",
      enum: ["Spouse", "Parent", "Sibling", "Friend", "Other"],
    },
    medicalConditions: {
      type: "string",
      title: "Medical Conditions",
      "x-formbar": { widget: "textarea" },
      description: "List any relevant medical conditions",
    },
    dietaryRequirements: {
      type: "string",
      title: "Dietary Requirements",
      enum: ["None", "Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-Free"],
    },
    agreesToTerms: { type: "boolean", title: "I agree to the terms and conditions" },
  },
};

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "personal",
      props: { title: "Personal Details", columns: 2 },
      children: [
        { type: "field", id: "f-first", path: "firstName" },
        { type: "field", id: "f-last", path: "lastName" },
        { type: "field", id: "f-dob", path: "dateOfBirth" },
        { type: "field", id: "f-gender", path: "gender" },
        { type: "field", id: "f-nationality", path: "nationality" },
        { type: "field", id: "f-passport", path: "passportNumber" },
      ],
    },
    {
      type: "section",
      id: "emergency",
      props: { title: "Emergency Contact", columns: 2 },
      children: [
        { type: "field", id: "f-ecName", path: "emergencyContactName" },
        { type: "field", id: "f-ecPhone", path: "emergencyContactPhone" },
        { type: "field", id: "f-ecRel", path: "emergencyRelationship" },
      ],
    },
    {
      type: "section",
      id: "health",
      props: { title: "Health & Preferences" },
      children: [
        { type: "field", id: "f-medical", path: "medicalConditions" },
        { type: "field", id: "f-dietary", path: "dietaryRequirements" },
      ],
    },
    {
      type: "section",
      id: "agreement",
      props: { title: "Agreement" },
      children: [{ type: "field", id: "f-terms", path: "agreesToTerms" }],
    },
  ],
} as const;

export function MultiSectionResponsiveDemo() {
  return (
    <DemoShell
      title="Multi-Section Responsive Form"
      description="A comprehensive passenger registration form with responsive multi-section layout. The 2-column grid gracefully collapses to single-column on smaller viewports, demonstrating formbar's responsive capabilities."
      motivation="Shows responsive multi-column layouts that collapse gracefully on mobile. Demonstrates that the layout system produces real responsive UIs, not just desktop-only forms."
      features={["Responsive Grid", "Multi-Section", "2-Column Collapse", "RadioGroup", "Select", "Textarea", "Switch"]}
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
