import { DemoFormRoot } from "../renderers/DemoFormRoot";
import { DemoShell } from "../renderers/DemoShell";

const schema = {
  type: "object",
  required: ["customerName", "orderDate", "paymentMethod"],
  properties: {
    orderNumber: { type: "string", title: "Order Number", description: "Auto-generated if left blank" },
    customerName: { type: "string", title: "Customer Name" },
    customerEmail: { type: "string", title: "Customer Email", format: "email" },
    orderDate: { type: "string", title: "Order Date", description: "YYYY-MM-DD format" },
    deliveryDate: { type: "string", title: "Requested Delivery Date" },
    paymentMethod: {
      type: "string",
      title: "Payment Method",
      enum: ["Credit Card", "Wire Transfer", "Purchase Order", "Net 30", "Net 60"],
    },
    currency: { type: "string", title: "Currency", enum: ["USD", "EUR", "GBP", "JPY", "NOK", "SEK", "DKK", "CHF"] },
    subtotal: { type: "number", title: "Subtotal", minimum: 0 },
    taxRate: { type: "number", title: "Tax Rate (%)", minimum: 0, maximum: 100 },
    discount: { type: "number", title: "Discount (%)", minimum: 0, maximum: 100 },
    shippingCost: { type: "number", title: "Shipping Cost", minimum: 0 },
    notes: {
      type: "string",
      title: "Order Notes",
      "x-formbar": { widget: "textarea" },
      description: "Internal notes for this order",
    },
    rushOrder: { type: "boolean", title: "Rush Order", description: "Prioritize processing" },
    requiresSignature: { type: "boolean", title: "Requires Signature", description: "Delivery must be signed for" },
  },
} as const;

const layout = {
  type: "group",
  id: "root",
  children: [
    {
      type: "section",
      id: "header",
      props: { title: "Order Header", columns: 2 },
      children: [
        { type: "field", id: "f-orderNum", path: "orderNumber" },
        { type: "field", id: "f-orderDate", path: "orderDate" },
        { type: "field", id: "f-deliveryDate", path: "deliveryDate" },
        { type: "field", id: "f-rush", path: "rushOrder" },
      ],
    },
    {
      type: "section",
      id: "customer",
      props: { title: "Customer", columns: 2 },
      children: [
        { type: "field", id: "f-name", path: "customerName" },
        { type: "field", id: "f-email", path: "customerEmail" },
      ],
    },
    {
      type: "section",
      id: "payment",
      props: { title: "Payment & Pricing", columns: 2 },
      children: [
        { type: "field", id: "f-payment", path: "paymentMethod" },
        { type: "field", id: "f-currency", path: "currency" },
        { type: "field", id: "f-subtotal", path: "subtotal" },
        { type: "field", id: "f-tax", path: "taxRate" },
        { type: "field", id: "f-discount", path: "discount" },
        { type: "field", id: "f-shipping", path: "shippingCost" },
      ],
    },
    {
      type: "section",
      id: "delivery",
      props: { title: "Delivery Options", columns: 2 },
      children: [{ type: "field", id: "f-signature", path: "requiresSignature" }],
    },
    {
      type: "section",
      id: "notes",
      props: { title: "Notes" },
      children: [{ type: "field", id: "f-notes", path: "notes" }],
    },
  ],
} as const;

export function OrderEntryDemo() {
  return (
    <DemoShell
      title="Order / Invoice Entry"
      description="A real-world order entry form with multiple sections for header, customer, payment, and delivery details. Demonstrates formbar handling business forms with mixed field types."
      motivation="A realistic business form: invoice with line items, payment method switching, and calculated fields. Proves the system handles real-world complexity, not just toy examples."
      features={[
        "Order Entry",
        "Multi-Section",
        "2-Column Grid",
        "Select (Payment/Currency)",
        "Number Inputs",
        "Switch Toggles",
        "Textarea",
      ]}
      schema={schema}
      layout={layout}
    >
      <DemoFormRoot schema={schema} data={{}} layout={layout} onChange={(p, v) => console.log(p, v)} responsive />
    </DemoShell>
  );
}
