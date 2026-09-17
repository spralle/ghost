import {
  absorbStackInDirection,
  detachTabInDirection,
  focusTabInDirection,
  moveTabInDirection,
  resizeInDirection,
  swapTabInDirection,
} from "@ghost-shell/state";
import type { ShellRuntime } from "../app/types.js";
import type { ShellKeyboardActionId } from "./default-shell-keybindings.js";
import {
  applyContextMutation,
  type ShellContextMutationResult,
  type ShellKeyboardActionResult,
} from "./shell-keyboard-action-results.js";

type Direction = "left" | "down" | "up" | "right";

interface DirectionalActionGroup {
  readonly prefix: string;
  readonly mutate: (runtime: ShellRuntime, direction: Direction) => ShellContextMutationResult;
  readonly reasons: Readonly<Record<Direction, string>>;
}

const DIRECTIONS: readonly Direction[] = ["left", "down", "up", "right"];

const DIRECTIONAL_ACTION_GROUPS: readonly DirectionalActionGroup[] = [
  {
    prefix: "shell.focus",
    mutate: (runtime, direction) => focusTabInDirection(runtime.contextState, direction),
    reasons: {
      left: "no focus target to the left",
      down: "no focus target below",
      up: "no focus target above",
      right: "no focus target to the right",
    },
  },
  {
    prefix: "shell.move",
    mutate: (runtime, direction) => moveTabInDirection(runtime.contextState, direction),
    reasons: {
      left: "no move target to the left",
      down: "no move target below",
      up: "no move target above",
      right: "no move target to the right",
    },
  },
  {
    prefix: "shell.swap",
    mutate: (runtime, direction) => swapTabInDirection(runtime.contextState, direction),
    reasons: {
      left: "no swap target to the left",
      down: "no swap target below",
      up: "no swap target above",
      right: "no swap target to the right",
    },
  },
  {
    prefix: "shell.tab.detach",
    mutate: (runtime, direction) => detachTabInDirection(runtime.contextState, direction),
    reasons: {
      left: "cannot detach tab to the left",
      down: "cannot detach tab below",
      up: "cannot detach tab above",
      right: "cannot detach tab to the right",
    },
  },
  {
    prefix: "shell.stack.absorb",
    mutate: (runtime, direction) => absorbStackInDirection(runtime.contextState, direction),
    reasons: {
      left: "no neighbor stack to absorb from the left",
      down: "no neighbor stack to absorb below",
      up: "no neighbor stack to absorb above",
      right: "no neighbor stack to absorb from the right",
    },
  },
  {
    prefix: "shell.resize",
    mutate: (runtime, direction) => resizeInDirection(runtime.contextState, direction),
    reasons: {
      left: "no resizable split to the left",
      down: "no resizable split below",
      up: "no resizable split above",
      right: "no resizable split to the right",
    },
  },
];

export function dispatchDirectionalAction(
  runtime: ShellRuntime,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult | null {
  for (const group of DIRECTIONAL_ACTION_GROUPS) {
    const direction = getActionDirection(actionId, group.prefix);
    if (!direction) {
      continue;
    }

    return applyContextMutation(runtime, group.mutate(runtime, direction), actionId, group.reasons[direction]);
  }

  return null;
}

function getActionDirection(actionId: ShellKeyboardActionId, prefix: string): Direction | null {
  for (const direction of DIRECTIONS) {
    if (actionId === `${prefix}.${direction}`) {
      return direction;
    }
  }

  return null;
}
