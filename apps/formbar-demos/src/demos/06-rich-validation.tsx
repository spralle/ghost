import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["username", "email", "password", "age", "website"],
  properties: {
    username: {
      type: "string",
      title: "Username",
      minLength: 3,
      maxLength: 20,
      pattern: "^[a-zA-Z0-9_]+$",
      description: "3-20 characters, letters, numbers, and underscores only",
    },
    email: {
      type: "string",
      title: "Email Address",
      format: "email",
      description: "Must be a valid email address",
    },
    password: {
      type: "string",
      title: "Password",
      minLength: 8,
      description: "Minimum 8 characters",
    },
    age: {
      type: "integer",
      title: "Age",
      minimum: 13,
      maximum: 150,
      description: "Must be at least 13 years old",
    },
    website: {
      type: "string",
      title: "Website",
      format: "uri",
      description: "Your personal website URL",
    },
    score: {
      type: "number",
      title: "Satisfaction Score",
      minimum: 0,
      maximum: 10,
      description: "Rate your experience from 0 to 10",
    },
  },
};

export function RichValidationDemo() {
  return (
    <DemoShell
      title="Rich Validation Showcase"
      description="Demonstrates various JSON Schema validation constraints including min/max length, patterns, format validation, and number ranges."
      motivation="Exercises the full validation keyword surface: pattern, format, minLength, maxLength, minimum, maximum. Proves the extractor correctly passes all JSON Schema validation constraints to renderers."
      features={[
        "Required Fields",
        "Min/Max Length",
        "Pattern Validation",
        "Format (email/uri)",
        "Number Range",
        "Slider",
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
