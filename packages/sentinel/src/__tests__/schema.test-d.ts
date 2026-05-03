import { defineResourceSchema, type TypedRelation } from "../index";

// --- Mock domain types ---

interface Party {
  partyId: string;
  role: string;
  name: string;
}

interface ChargeLine {
  chargeId: string;
  amount: number;
  currency: string;
}

interface OrderLine {
  lineId: string;
  sku: string;
  quantity: number;
  chargeLines: ChargeLine[];
}

interface Category {
  categoryId: string;
  name: string;
  /** Self-referencing: subcategories have the same shape */
  categories: Category[];
}

interface Order {
  orderId: string;
  status: string;
  total: number;
  orderLines: OrderLine[];
  parties: Party[];
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

// --- Valid usage ---

const orderSchema = defineResourceSchema<Order, "view" | "edit" | "cancel">({
  name: "Order",
  relations: {
    // Simple dot path
    owner: "orderId",
    nested: "metadata.createdAt",
    // Filtered relation
    activeLines: {
      from: "orderLines",
      $match: { quantity: { $gt: 0 } },
      $project: "lineId",
    },
    // Filtered relation without $match
    allParties: {
      from: "parties",
      $project: "partyId",
    },
  },
  actions: ["view", "edit", "cancel"],
  dataBlocks: {
    summary: {
      fields: ["orderId", "status", "total"],
      sensitivity: {
        tier: "standard",
      },
    },
    financial: {
      fields: ["total"],
      sensitivity: {
        tier: "restricted",
        audienceOverrides: [{ partyType: "accountant", tier: "standard" }],
      },
    },
  },
});

// Verify return type
const _name: string = orderSchema.name;
const _actions: readonly ("view" | "edit" | "cancel")[] = orderSchema.actions;

// --- Recursive relation ---

const categorySchema = defineResourceSchema<Category, "view" | "manage">({
  name: "Category",
  relations: {
    children: {
      $recurse: "categories",
      $project: "categoryId",
    },
  },
  actions: ["view", "manage"],
});

void categorySchema;

// --- Type errors: invalid paths ---

// @ts-expect-error — 'nonExistent' is not a valid DotPath of Order
const _badPath: TypedRelation<Order> = "nonExistent";

// @ts-expect-error — 'from' must be an array-of-objects key
const _badFrom: TypedRelation<Order> = { from: "status", $project: "orderId" };

// $project must be a valid path of the element type
const _badProject: TypedRelation<Order> = {
  from: "orderLines",
  $match: {},
  // @ts-expect-error — 'nonExistentField' is not a valid DotPath of OrderLine
  $project: "nonExistentField",
};

// $recurse must be a self-referencing key (Order has no self-ref arrays)
const _badRecurse: TypedRelation<Order> = {
  // @ts-expect-error — '$recurse' does not exist on FilteredRelation<Order>
  $recurse: "orderLines",
  $project: "lineId",
};

// invalid field in dataBlocks
defineResourceSchema<Order, "view">({
  name: "Order",
  relations: {},
  actions: ["view"],
  dataBlocks: {
    bad: {
      // @ts-expect-error — 'nonExistentField' is not a valid DotPath of Order
      fields: ["nonExistentField"],
    },
  },
});

void _badPath;
void _badFrom;
void _badProject;
void _badRecurse;
