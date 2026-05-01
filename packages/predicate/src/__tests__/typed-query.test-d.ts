import { compile, compileFilter, find, findOne, Predicate } from "../index.js";
import type { DotPaths, PathValue, TypedQuery } from "../typed-query.js";

// ---- Test interface ----
interface User {
  name: string;
  age: number;
  email: string;
  active: boolean;
  address: {
    street: string;
    city: string;
    geo: {
      lat: number;
      lng: number;
    };
  };
  tags: string[];
  scores: number[];
  createdAt: Date;
}

// ---- DotPaths tests ----
type UserPaths = DotPaths<User>;

// Valid top-level paths
const _p1: UserPaths = "name";
const _p2: UserPaths = "age";
const _p3: UserPaths = "address";
const _p4: UserPaths = "tags";

// Valid nested paths (depth 4 now supported)
const _p5: UserPaths = "address.street";
const _p6: UserPaths = "address.geo";
const _p7: UserPaths = "address.geo.lat";

// @ts-expect-error — invalid path
const _bad1: UserPaths = "nonexistent";
// @ts-expect-error — invalid nested path
const _bad2: UserPaths = "address.nonexistent";
// @ts-expect-error — too deep (depth 5)
const _bad3: UserPaths = "address.geo.lat.x";

// ---- PathValue tests ----
// These are validated by assignment — wrong types would cause compile errors
const _pv1: PathValue<User, "name"> = "" as string;
const _pv2: PathValue<User, "age"> = 0 as number;
const _pv3: PathValue<User, "active"> = true as boolean;
const _pv4: PathValue<User, "address.street"> = "" as string;
const _pv5: PathValue<User, "address.geo.lat"> = 0 as number;

// ---- TypedQuery tests ----

// Valid queries
const _q1: TypedQuery<User> = { name: "Alice" };
const _q2: TypedQuery<User> = { age: { $gt: 18 } };
const _q3: TypedQuery<User> = { name: { $regex: /alice/i } };
const _q4: TypedQuery<User> = { "address.city": "NYC" };
const _q5: TypedQuery<User> = { $and: [{ name: "Alice" }, { age: { $gte: 18 } }] };
const _q6: TypedQuery<User> = { tags: { $all: ["admin"] } };
const _q7: TypedQuery<User> = { tags: { $size: 3 } };
const _q8: TypedQuery<User> = { active: { $exists: true } };
const _q9: TypedQuery<User> = { name: { $in: ["Alice", "Bob"] } };
const _q10: TypedQuery<User> = { age: { $ne: null } };

// @ts-expect-error — invalid field name
const _bq1: TypedQuery<User> = { nonexistent: "value" };

// @ts-expect-error — wrong value type for $gt on string (number not assignable to string)
const _bq2: TypedQuery<User> = { name: { $gt: 42 } };

// Backward compat: untyped query still works
const _qu: TypedQuery<Record<string, unknown>> = { anything: "goes" };

// ---- API integration tests ----
// compile() accepts TypedQuery
compile<User>({ name: "Alice" });

// compileFilter() accepts TypedQuery
compileFilter<User>({ age: { $gte: 18 } });

// Predicate accepts TypedQuery
new Predicate<User>({ name: "Alice" });

// find() accepts TypedQuery
const users: User[] = [];
find<User>(users, { active: true });

// findOne() accepts TypedQuery
findOne<User>(users, { name: "Alice" });
