import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  properties: {
    notifications: { type: "boolean", title: "Enable Notifications", description: "Receive in-app notifications" },
    emailAlerts: { type: "boolean", title: "Email Alerts", description: "Send email for important events" },
    pushNotifications: { type: "boolean", title: "Push Notifications", description: "Mobile push notifications" },
    darkMode: { type: "boolean", title: "Dark Mode", description: "Use dark color theme" },
    compactView: { type: "boolean", title: "Compact View", description: "Reduce spacing in lists" },
    fontSize: {
      type: "integer",
      title: "Font Size",
      minimum: 12,
      maximum: 24,
      description: "Base font size in pixels",
    },
    language: { type: "string", title: "Language", enum: ["English", "Spanish", "French", "German", "Japanese"] },
    timezone: {
      type: "string",
      title: "Timezone",
      enum: ["UTC-8 (PST)", "UTC-5 (EST)", "UTC+0 (GMT)", "UTC+1 (CET)", "UTC+9 (JST)", "UTC+10 (AEST)"],
    },
    autoSave: { type: "boolean", title: "Auto-Save", description: "Automatically save changes" },
    telemetry: {
      type: "boolean",
      title: "Usage Analytics",
      description: "Help us improve by sharing anonymous usage data",
    },
  },
};

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "notifications",
      props: { title: "Notifications" },
      children: [
        { type: "field", id: "f-notifications", path: "notifications" },
        { type: "field", id: "f-emailAlerts", path: "emailAlerts" },
        { type: "field", id: "f-pushNotifications", path: "pushNotifications" },
      ],
    },
    {
      type: "section",
      id: "appearance",
      props: { title: "Appearance" },
      children: [
        { type: "field", id: "f-darkMode", path: "darkMode" },
        { type: "field", id: "f-compactView", path: "compactView" },
        { type: "field", id: "f-fontSize", path: "fontSize" },
      ],
    },
    {
      type: "section",
      id: "localization",
      props: { title: "Localization", columns: 2 },
      children: [
        { type: "field", id: "f-language", path: "language" },
        { type: "field", id: "f-timezone", path: "timezone" },
      ],
    },
    {
      type: "section",
      id: "data",
      props: { title: "Data & Privacy" },
      children: [
        { type: "field", id: "f-autoSave", path: "autoSave" },
        { type: "field", id: "f-telemetry", path: "telemetry" },
      ],
    },
  ],
};

export function SettingsPanelDemo() {
  return (
    <DemoShell
      title="Settings Panel"
      description="Toggle-heavy settings form with categorized sections. Demonstrates Switch controls, Slider, and RadioGroup widgets."
      motivation="Shows boolean-heavy configuration UIs with toggle switches. Common enterprise pattern: app preferences panels where every field is a boolean. Schema-driven means settings are type-safe and self-documenting."
      features={["Switch Controls", "Slider (Font Size)", "RadioGroup", "Sections", "Custom Layout"]}
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
