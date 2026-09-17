import { z } from "zod";

export const OrderSchema = z.object({
  id: z.string(),
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  status: z.enum(["draft", "placed", "confirmed", "shipped", "delivered", "cancelled"]),
  lineCount: z.number(),
  totalAmount: z.number(),
  currency: z.enum(["USD", "EUR", "GBP", "SEK"]),
  placedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const OrderLineSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  sku: z.string(),
  product: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  status: z.enum(["pending", "allocated", "shipped", "cancelled"]),
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderLine = z.infer<typeof OrderLineSchema>;

export const orderSchemaSource = `z.object({
  id: z.string(),
  customer: z.object({
    name: z.string(),
    email: z.string().email(),
  }),
  status: z.enum([
    'draft', 'placed', 'confirmed',
    'shipped', 'delivered', 'cancelled',
  ]),
  lineCount: z.number(),
  totalAmount: z.number(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'SEK']),
  placedAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})`;

export const lineSchemaSource = `z.object({
  id: z.string(),
  orderId: z.string(),
  sku: z.string(),
  product: z.string(),
  qty: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  status: z.enum(['pending', 'allocated', 'shipped', 'cancelled']),
})`;

export const usageSource = `{/* Orders (Master) */}
<EntityList
  entityType="order"
  schema={OrderSchema}
  data={orders}
  exclude={['id']}
  defaultVisible={[
    'customer.name', 'customer.email', 'status',
    'lineCount', 'totalAmount', 'currency', 'placedAt',
  ]}
  overrides={{
    'customer.email': { format: 'link' },
    totalAmount: { format: 'currency' },
  }}
  rowOperations={orderOps}
  getRowId={(row) => row.id}
/>

{/* Order Lines (Detail) */}
<EntityList
  entityType="order-line"
  schema={OrderLineSchema}
  data={orderLines}
  exclude={['id']}
  overrides={{
    unitPrice: { format: 'currency' },
    lineTotal: { format: 'currency' },
  }}
  rowOperations={lineOps}
  pageSizeOptions={[10, 25]}
  getRowId={(row) => row.id}
/>`;
