import { DemoShell } from "../components/DemoShell";
import { lineSchemaSource, orderSchemaSource, usageSource } from "./08-order-aggregate-schemas";
import { OrderLinesTable } from "./08-order-lines-table";
import { OrderTable } from "./08-order-table";

export function OrderAggregateDemo() {
  return (
    <DemoShell
      title="Order Aggregate (CQRS Style)"
      description="A CQRS read-model projection pattern: domain aggregates emit events, projections build flat read models for display. Here we show two related tables — an Order master view and an OrderLine detail view — as a query-side projection would produce them."
      features={["Entity List", "Order Lines", "Computed Display", "Row Actions as Commands", "Nested Entities"]}
      schema={orderSchemaSource}
      codeBlocks={[
        { title: "OrderLine Schema", code: lineSchemaSource, defaultOpen: false },
        { title: "Usage", code: usageSource, defaultOpen: true },
      ]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <OrderTable />
        <OrderLinesTable />
      </div>
    </DemoShell>
  );
}
