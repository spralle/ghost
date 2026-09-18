import { EntityList } from "@ghost-shell/entity-table";
import { orders } from "./08-order-aggregate-data";
import { orderOperations } from "./08-order-aggregate-operations";
import { OrderSchema } from "./08-order-aggregate-schemas";

export function OrderTable() {
  return (
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
        rowOperations={orderOperations}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
