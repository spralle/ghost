import { describe, expect, it } from "vitest";
import { orderLines, orders } from "./08-order-aggregate-data";
import { orderLineOperations, orderOperations } from "./08-order-aggregate-operations";

describe("order aggregate operations", () => {
  it("keeps order command visibility tied to order status", () => {
    const confirm = orderOperations.find((operation) => operation.id === "confirm");
    const cancel = orderOperations.find((operation) => operation.id === "cancel");
    if (!confirm?.when || !cancel?.when) throw new Error("Expected order predicates");

    const placed = orders.find((order) => order.status === "placed");
    const confirmed = orders.find((order) => order.status === "confirmed");
    const delivered = orders.find((order) => order.status === "delivered");
    if (!placed || !confirmed || !delivered) throw new Error("Expected order status fixtures");
    expect(confirm.when({ entity: placed, data: orders })).toBe(true);
    expect(confirm.when({ entity: confirmed, data: orders })).toBe(false);
    expect(cancel.when({ entity: confirmed, data: orders })).toBe(true);
    expect(cancel.when({ entity: delivered, data: orders })).toBe(false);
  });

  it("keeps line command visibility tied to line status", () => {
    const allocate = orderLineOperations.find((operation) => operation.id === "allocate");
    const cancel = orderLineOperations.find((operation) => operation.id === "cancel-line");
    if (!allocate?.when || !cancel?.when) throw new Error("Expected order-line predicates");

    const pending = orderLines.find((line) => line.status === "pending");
    const allocated = orderLines.find((line) => line.status === "allocated");
    const shipped = orderLines.find((line) => line.status === "shipped");
    if (!pending || !allocated || !shipped) throw new Error("Expected order-line status fixtures");
    expect(allocate.when({ entity: allocated, data: orderLines })).toBe(false);
    expect(allocate.when({ entity: pending, data: orderLines })).toBe(true);
    expect(cancel.when({ entity: allocated, data: orderLines })).toBe(true);
    expect(cancel.when({ entity: shipped, data: orderLines })).toBe(false);
  });
});
