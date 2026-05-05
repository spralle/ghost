import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["satisfaction", "recommend"],
  properties: {
    satisfaction: {
      type: "string",
      title: "Overall Satisfaction",
      enum: ["Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied"],
      description: "How satisfied are you with our service?",
    },
    recommend: {
      type: "string",
      title: "Would You Recommend Us?",
      enum: ["Definitely", "Probably", "Not Sure", "Probably Not", "Definitely Not"],
    },
    npsScore: {
      type: "integer",
      title: "Net Promoter Score",
      minimum: 0,
      maximum: 10,
      description: "How likely are you to recommend us? (0 = Not at all, 10 = Extremely likely)",
    },
    bestFeature: {
      type: "string",
      title: "Best Feature",
      enum: ["Performance", "Ease of Use", "Design", "Reliability", "Support"],
      description: "What do you value most?",
    },
    improvementArea: {
      type: "string",
      title: "Area for Improvement",
      enum: ["Performance", "Documentation", "Onboarding", "Pricing", "Mobile Experience"],
      description: "Where should we focus?",
    },
    usageFrequency: {
      type: "string",
      title: "How Often Do You Use Our Product?",
      enum: ["Daily", "Weekly", "Monthly", "Rarely"],
    },
    feedback: {
      type: "string",
      title: "Additional Feedback",
      maxLength: 2000,
      description: "Share any additional thoughts or suggestions",
    },
    contactForFollowUp: {
      type: "boolean",
      title: "May We Contact You?",
      description: "We may reach out to discuss your feedback",
    },
    email: { type: "string", title: "Email (optional)", format: "email" },
  },
} as const;

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "ratings",
      props: { title: "Ratings" },
      children: [
        { type: "field", id: "f-satisfaction", path: "satisfaction" },
        { type: "field", id: "f-recommend", path: "recommend" },
        { type: "field", id: "f-nps", path: "npsScore" },
      ],
    },
    {
      type: "section",
      id: "features",
      props: { title: "Product Feedback", columns: 2 },
      children: [
        { type: "field", id: "f-best", path: "bestFeature" },
        { type: "field", id: "f-improve", path: "improvementArea" },
        { type: "field", id: "f-usage", path: "usageFrequency" },
      ],
    },
    {
      type: "section",
      id: "comments",
      props: { title: "Comments" },
      children: [{ type: "field", id: "f-feedback", path: "feedback" }],
    },
    {
      type: "section",
      id: "contact",
      props: { title: "Follow-Up", columns: 2 },
      children: [
        { type: "field", id: "f-contactOk", path: "contactForFollowUp" },
        { type: "field", id: "f-email", path: "email" },
      ],
    },
  ],
} as const;

export function SurveyQuestionnaireDemo() {
  return (
    <DemoShell
      title="Survey / Questionnaire"
      description="A customer satisfaction survey demonstrating radio groups for small enums, a slider for NPS scoring, and auto-detected textarea for long-form feedback."
      motivation="Radio groups, rating scales, and open-ended text in a questionnaire format. Shows the system handles read-heavy forms where the schema describes choices, not just data types."
      features={[
        "RadioGroup (≤5)",
        "Slider (NPS)",
        "Textarea (Auto)",
        "Multi-Section",
        "Rich Descriptions",
        "Survey Pattern",
      ]}
      schema={schema}
      layout={layout}
    >
      <DemoFormRoot schema={schema} data={{}} layout={layout} onChange={(p, v) => console.log(p, v)} responsive />
    </DemoShell>
  );
}
