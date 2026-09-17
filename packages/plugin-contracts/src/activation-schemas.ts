import { z } from "zod";

export const activationRuleSchema = z.object({
  entry: z.string(),
  when: z.record(z.string(), z.unknown()),
});

export const activationsSchema = z.array(activationRuleSchema);

export type ActivationRule = z.infer<typeof activationRuleSchema>;
