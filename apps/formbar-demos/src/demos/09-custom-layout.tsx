import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["vesselName", "imoNumber"],
  properties: {
    vesselName: { type: "string", title: "Vessel Name" },
    imoNumber: { type: "string", title: "IMO Number", description: "International Maritime Organization number" },
    callSign: { type: "string", title: "Call Sign" },
    flag: {
      type: "string",
      title: "Flag State",
      enum: [
        "Panama",
        "Liberia",
        "Marshall Islands",
        "Hong Kong",
        "Singapore",
        "Bahamas",
        "Malta",
        "Norway",
        "Greece",
        "Japan",
      ],
    },
    vesselType: {
      type: "string",
      title: "Vessel Type",
      enum: ["Container", "Bulk Carrier", "Tanker", "RoRo", "General Cargo"],
    },
    grossTonnage: { type: "number", title: "Gross Tonnage", minimum: 0, description: "GT" },
    deadweight: { type: "number", title: "Deadweight", minimum: 0, description: "DWT in metric tons" },
    length: { type: "number", title: "LOA (m)", minimum: 0, description: "Length Overall in meters" },
    beam: { type: "number", title: "Beam (m)", minimum: 0, description: "Width at widest point" },
    draft: { type: "number", title: "Max Draft (m)", minimum: 0, description: "Maximum draft" },
    yearBuilt: { type: "integer", title: "Year Built", minimum: 1950, maximum: 2026 },
    isActive: { type: "boolean", title: "Active", description: "Currently in service" },
  },
};

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "identity",
      props: { title: "Vessel Identity", columns: 2 },
      children: [
        { type: "field", id: "f-name", path: "vesselName" },
        { type: "field", id: "f-imo", path: "imoNumber" },
        { type: "field", id: "f-callSign", path: "callSign" },
        { type: "field", id: "f-flag", path: "flag" },
      ],
    },
    {
      type: "section",
      id: "classification",
      props: { title: "Classification", columns: 2 },
      children: [
        { type: "field", id: "f-type", path: "vesselType" },
        { type: "field", id: "f-year", path: "yearBuilt" },
        { type: "field", id: "f-active", path: "isActive" },
      ],
    },
    {
      type: "section",
      id: "dimensions",
      props: { title: "Dimensions & Capacity", columns: 2 },
      children: [
        { type: "field", id: "f-gt", path: "grossTonnage" },
        { type: "field", id: "f-dwt", path: "deadweight" },
        { type: "field", id: "f-loa", path: "length" },
        { type: "field", id: "f-beam", path: "beam" },
        { type: "field", id: "f-draft", path: "draft" },
      ],
    },
  ],
} as const;

export function CustomLayoutDemo() {
  return (
    <DemoShell
      title="Custom Layout Override"
      description="The same schema can be rendered with completely different layouts. This layout groups vessel properties by identity, classification, and dimensions — different from the schema's flat structure."
      motivation="Proves layout is fully decoupled from schema. Same data schema, completely different visual arrangement. Shows the split between 'what data' (schema) and 'how to display' (layout) that enables designer/developer collaboration."
      features={["Custom Layout", "2-Column Grid", "Select (>5)", "RadioGroup (≤5)", "Number Inputs", "Slider (Year)"]}
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
