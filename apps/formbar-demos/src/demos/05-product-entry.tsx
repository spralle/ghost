import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["name", "sku", "price", "category"],
  properties: {
    name: { type: "string", title: "Product Name", description: "Display name shown to customers" },
    sku: { type: "string", title: "SKU", description: "Stock Keeping Unit identifier" },
    description: { type: "string", title: "Description", maxLength: 1000, description: "Detailed product description" },
    category: {
      type: "string",
      title: "Category",
      enum: [
        "Electronics",
        "Clothing",
        "Home & Garden",
        "Sports",
        "Books",
        "Food & Beverage",
        "Health",
        "Automotive",
        "Toys",
        "Office Supplies",
      ],
    },
    price: { type: "number", title: "Price (USD)", minimum: 0, description: "Retail price" },
    weight: { type: "number", title: "Weight (kg)", minimum: 0, description: "Shipping weight" },
    quantity: { type: "integer", title: "Stock Quantity", minimum: 0, maximum: 10000, description: "Units in stock" },
    rating: { type: "integer", title: "Quality Rating", minimum: 1, maximum: 5, description: "Internal quality score" },
    isActive: { type: "boolean", title: "Active", description: "Available for purchase" },
    isFeatured: { type: "boolean", title: "Featured", description: "Show on homepage" },
  },
};

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "identity",
      props: { title: "Product Identity", columns: 2 },
      children: [
        { type: "field", id: "f-name", path: "name" },
        { type: "field", id: "f-sku", path: "sku" },
        { type: "field", id: "f-category", path: "category" },
      ],
    },
    {
      type: "section",
      id: "details",
      props: { title: "Details" },
      children: [{ type: "field", id: "f-description", path: "description" }],
    },
    {
      type: "section",
      id: "pricing",
      props: { title: "Pricing & Inventory", columns: 2 },
      children: [
        { type: "field", id: "f-price", path: "price" },
        { type: "field", id: "f-weight", path: "weight" },
        { type: "field", id: "f-quantity", path: "quantity" },
        { type: "field", id: "f-rating", path: "rating" },
      ],
    },
    {
      type: "section",
      id: "status",
      props: { title: "Status", columns: 2 },
      children: [
        { type: "field", id: "f-isActive", path: "isActive" },
        { type: "field", id: "f-isFeatured", path: "isFeatured" },
      ],
    },
  ],
};

export function ProductEntryDemo() {
  return (
    <DemoShell
      title="Product Catalog Entry"
      description="Product entry form with number constraints, rich descriptions, and multi-column grid layout."
      motivation="Demonstrates number fields with constraint enforcement (min, max, step) in a grid layout. Shows how the layout system controls visual arrangement independently from schema structure."
      features={[
        "Number Inputs",
        "Slider (Rating)",
        "Select (>5 Options)",
        "Textarea (Auto)",
        "Multi-Column Grid",
        "Required Fields",
      ]}
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
