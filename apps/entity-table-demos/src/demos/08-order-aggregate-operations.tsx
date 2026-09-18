import type { EntityOperation } from "@ghost-shell/entity-table";
import { CheckCircle, Eye, Package, XCircle } from "lucide-react";
import type { Order, OrderLine } from "./08-order-aggregate-schemas";

export const orderOperations: EntityOperation<Order>[] = [
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

export const orderLineOperations: EntityOperation<OrderLine>[] = [
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
