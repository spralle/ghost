import { EntityList } from "@ghost-shell/entity-table";
import { orderLines } from "./08-order-aggregate-data";
import { orderLineOperations } from "./08-order-aggregate-operations";
import { OrderLineSchema } from "./08-order-aggregate-schemas";

export function OrderLinesTable() {
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
        rowOperations={orderLineOperations}
        pageSizeOptions={[10, 25]}
        getRowId={(row) => row.id}
      />
    </div>
  );
}
