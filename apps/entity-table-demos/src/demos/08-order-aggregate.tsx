import type { EntityOperation } from "@ghost-shell/entity-table";
import { EntityList } from "@ghost-shell/entity-table";
import { CheckCircle, Eye, Package, XCircle } from "lucide-react";
import { DemoShell } from "../components/DemoShell";
import { orderLines, orders } from "./08-order-aggregate-data";
import {
  lineSchemaSource,
  type Order,
  type OrderLine,
  OrderLineSchema,
  OrderSchema,
  orderSchemaSource,
  usageSource,
} from "./08-order-aggregate-schemas";

const orderOps: EntityOperation<Order>[] = [
  {
    id: "view",
    label: "View Details",
    icon: <Eye className="h-4 w-4" />,
    handler: ({ entity }) => alert(`View order ${entity?.id}`),
  },
  {
    id: "confirm",
    label: "Confirm",
    icon: <CheckCircle className="h-4 w-4" />,
    handler: ({ entity }) => alert(`Confirm ${entity?.id}`),
    when: ({ entity }) => entity?.status === "placed",
  },
  {
    id: "cancel",
    label: "Cancel",
    icon: <XCircle className="h-4 w-4" />,
    variant: "destructive",
    handler: ({ entity }) => alert(`Cancel ${entity?.id}`),
    when: ({ entity }) =>
      entity?.status !== "shipped" && entity?.status !== "delivered" && entity?.status !== "cancelled",
  },
];

const lineOps: EntityOperation<OrderLine>[] = [
  {
    id: "allocate",
    label: "Allocate",
    icon: <Package className="h-4 w-4" />,
    handler: ({ entity }) => alert(`Allocate ${entity?.id}`),
    when: ({ entity }) => entity?.status === "pending",
  },
  {
    id: "cancel-line",
    label: "Cancel Line",
    icon: <XCircle className="h-4 w-4" />,
    variant: "destructive",
    handler: ({ entity }) => alert(`Cancel line ${entity?.id}`),
    when: ({ entity }) => entity?.status !== "shipped" && entity?.status !== "cancelled",
  },
];

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
        <div>
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
              color: "var(--ghost-text-primary, inherit)",
            }}
          >
            Orders (Master)
          </h3>
          <EntityList
            entityType="order"
            schema={OrderSchema}
            data={orders}
            exclude={["id"]}
            defaultVisible={[
              "customer.name",
              "customer.email",
              "status",
              "lineCount",
              "totalAmount",
              "currency",
              "placedAt",
            ]}
            overrides={{
              "customer.email": { format: "link" },
              totalAmount: { format: "currency" },
            }}
            rowOperations={orderOps}
            getRowId={(row) => row.id}
          />
        </div>
        <div>
          <h3
            style={{
              fontSize: "1.1rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
              color: "var(--ghost-text-primary, inherit)",
            }}
          >
            Order Lines (Detail)
          </h3>
          <EntityList
            entityType="order-line"
            schema={OrderLineSchema}
            data={orderLines}
            exclude={["id"]}
            overrides={{
              unitPrice: { format: "currency" },
              lineTotal: { format: "currency" },
            }}
            rowOperations={lineOps}
            pageSizeOptions={[10, 25]}
            getRowId={(row) => row.id}
          />
        </div>
      </div>
    </DemoShell>
  );
}
