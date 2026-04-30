import { describe, expect, test } from "vitest";
import type { FormState } from "../contracts.js";
import { createForm } from "../create-form.js";
import type { DeepKeys } from "../type-utils.js";

// Type assertion helpers
type Assert<T extends true> = T;
type IsEqual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type IsAssignable<T, U> = T extends U ? true : false;

describe("Type safety — compile-time assertions", () => {
  test("createForm infers TData from initialData", () => {
    const form = createForm({ initialData: { name: "test", age: 30 } });
    type _1 = Assert<IsEqual<ReturnType<typeof form.getState>["data"], { name: string; age: number }>>;
    expect(form.getState().data.name).toBe("test");
  });

  test("FormApi.setValue type safety", () => {
    const form = createForm({ initialData: { name: "", count: 0 } });
    form.setValue("name", "hello");
    form.setValue("count", 42);
    // @ts-expect-error — wrong value type for path
    form.setValue("name", 123);
    // Runtime: setValue still executes (no runtime guard), so just verify types compiled
    expect(form.getState().data.count).toBe(42);
  });

  test("FieldApi.get() return type", () => {
    const form = createForm({ initialData: { name: "hi", count: 5 } });
    const nameField = form.field("name");
    const nameValue = nameField.get();
    type _3 = Assert<IsEqual<typeof nameValue, string>>;

    const countField = form.field("count");
    const countValue = countField.get();
    type _4 = Assert<IsEqual<typeof countValue, number>>;
    expect(nameValue).toBe("hi");
  });

  test("Nested object paths", () => {
    const form = createForm({ initialData: { address: { city: "NYC", zip: 10001 } } });
    const cityField = form.field("address.city");
    const cityValue = cityField.get();
    type _6 = Assert<IsEqual<typeof cityValue, string>>;
    expect(cityValue).toBe("NYC");
  });

  test("Array paths", () => {
    const form = createForm({ initialData: { tags: ["a", "b"] } });
    const tagsField = form.field("tags");
    const tagsValue = tagsField.get();
    type _arr = Assert<IsEqual<typeof tagsValue, string[]>>;
    expect(tagsValue).toEqual(["a", "b"]);
  });

  test("FormState generic preservation", () => {
    type State = FormState<{ name: string }, { visible: boolean }>;
    type _7 = Assert<IsEqual<State["data"], { name: string }>>;
    type _8 = Assert<IsEqual<State["uiState"], { visible: boolean }>>;
    expect(true).toBe(true);
  });

  test("Backward compatibility — unparameterized usage", () => {
    const untypedForm = createForm();
    const state = untypedForm.getState();
    type _9 = Assert<IsEqual<typeof state.data, unknown>>;
    untypedForm.setValue("anything", 42);
    expect(state.data).toEqual({});
  });

  test("DeepKeys/DeepValue edge cases", () => {
    // Optional fields
    type Opt = { a?: { b: string } };
    type _10 = Assert<IsAssignable<"a.b", DeepKeys<Opt>>>;

    // Nullable fields
    type Nullable = { a: { b: string } | null };
    type _11 = Assert<IsAssignable<"a.b", DeepKeys<Nullable>>>;

    expect(true).toBe(true);
  });

  test("$ui path escape hatch", () => {
    const form = createForm({ initialData: { name: "", count: 0 } });
    // $ui paths work via the string overload
    form.setValue("$ui.visible", true);
    expect(true).toBe(true);
  });
});
