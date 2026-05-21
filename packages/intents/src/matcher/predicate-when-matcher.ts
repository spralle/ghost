import { compileShorthand, evaluateWithTrace } from "kuery";
import type {
  IntentFactBag,
  IntentWhenMatcher,
  PredicateEvaluationResult,
  PredicateFailureTrace,
} from "./contracts.js";

export function createPredicateWhenMatcher(): IntentWhenMatcher {
  return {
    id: "predicate-when-matcher",
    evaluate: evaluatePredicate,
  };
}

function evaluatePredicate(when: Record<string, unknown>, facts: IntentFactBag): PredicateEvaluationResult {
  const ast = compileShorthand(when);
  const { result, traces } = evaluateWithTrace(ast, facts);

  const failedPredicates: PredicateFailureTrace[] = traces.map((t) => ({
    path: t.path,
    actual: t.actual,
    condition: t.expected,
  }));

  return {
    matched: Boolean(result),
    failedPredicates,
  };
}
