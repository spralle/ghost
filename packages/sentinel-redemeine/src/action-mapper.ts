import type { ActionMap } from './types.js';

/**
 * Resolve a sentinel action from a command type using the action map.
 * Supports direct matches and wildcard patterns (e.g. 'order.*').
 */
export function resolveAction(actionMap: ActionMap, commandType: string): string | undefined {
  if (actionMap[commandType]) return actionMap[commandType];

  for (const [pattern, action] of Object.entries(actionMap)) {
    if (pattern.endsWith('.*') && commandType.startsWith(pattern.slice(0, -1))) {
      return action;
    }
  }

  return undefined;
}
