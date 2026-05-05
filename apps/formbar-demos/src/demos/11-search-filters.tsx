import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  properties: {
    query: { type: "string", title: "Search", description: "Keywords or phrases" },
    category: {
      type: "string",
      title: "Category",
      enum: ["All", "Documents", "Images", "Videos", "Audio", "Archives"],
    },
    dateRange: {
      type: "string",
      title: "Date Range",
      enum: ["Any Time", "Past Hour", "Past Day", "Past Week", "Past Month", "Past Year"],
    },
    sortBy: {
      type: "string",
      title: "Sort By",
      enum: ["Relevance", "Date (Newest)", "Date (Oldest)", "Name (A-Z)", "Name (Z-A)", "Size"],
    },
    fileSize: { type: "string", title: "File Size", enum: ["Any", "< 1 MB", "1-10 MB", "10-100 MB", "> 100 MB"] },
    includeArchived: { type: "boolean", title: "Include Archived" },
    exactMatch: { type: "boolean", title: "Exact Match" },
  },
} as const;

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "search",
      props: { title: "Search Query" },
      children: [{ type: "field", id: "f-query", path: "query" }],
    },
    {
      type: "section",
      id: "filters",
      props: { title: "Filters", columns: 2 },
      children: [
        { type: "field", id: "f-category", path: "category" },
        { type: "field", id: "f-dateRange", path: "dateRange" },
        { type: "field", id: "f-sortBy", path: "sortBy" },
        { type: "field", id: "f-fileSize", path: "fileSize" },
      ],
    },
    {
      type: "section",
      id: "options",
      props: { title: "Options", columns: 2 },
      children: [
        { type: "field", id: "f-archived", path: "includeArchived" },
        { type: "field", id: "f-exact", path: "exactMatch" },
      ],
    },
  ],
} as const;

export function SearchFiltersDemo() {
  return (
    <DemoShell
      title="Search Filter Bar"
      description="A compact search and filter panel demonstrating formbar for non-traditional form UIs. Select components keep the interface clean, while switch toggles provide quick boolean options."
      motivation="Compact filter panel pattern common in data-heavy apps. Shows how the same schema-to-form pipeline works for search/filter UIs, not just data entry — proving the system's versatility."
      features={["Filter Panel", "Select Controls", "Switch Toggles", "Compact Layout", "2-Column Grid"]}
      schema={schema}
      layout={layout}
    >
      <DemoFormRoot schema={schema} data={{}} layout={layout} onChange={(p, v) => console.log(p, v)} responsive />
    </DemoShell>
  );
}
