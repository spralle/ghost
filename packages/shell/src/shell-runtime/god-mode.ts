import type { ShellRuntime } from "../app/types.js";

export const GOD_MODE_ACTION_ID = "shell.elevatedSession.activate";
const GOD_MODE_SECRET = "ghost";

export function validateGodModeAuth(secret: string): boolean {
  return secret === GOD_MODE_SECRET;
}

export function activateElevatedSession(runtime: ShellRuntime): void {
  runtime.elevatedSession = { active: true, activatedAt: Date.now() };
  runtime.notice = "Session elevated";
}

interface PromptElements {
  backdrop: HTMLDivElement;
  input: HTMLInputElement;
}

function createPromptDOM(): PromptElements {
  const backdrop = document.createElement("div");
  backdrop.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:10001",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:var(--ghost-overlay-backdrop, rgba(0,0,0,0.5))",
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "background:var(--ghost-surface, #1e1e1e)",
    "color:var(--ghost-text-primary, #fff)",
    "border:1px solid var(--ghost-border, #444)",
    "border-radius:8px",
    "padding:24px",
    "min-width:300px",
    "display:flex",
    "flex-direction:column",
    "gap:12px",
  ].join(";");

  const title = document.createElement("div");
  title.textContent = "Elevated Session";
  title.style.cssText = "font-weight:600;font-size:16px;";

  const input = document.createElement("input");
  input.type = "password";
  input.placeholder = "Enter secret";
  input.style.cssText = [
    "background:var(--ghost-surface, #2a2a2a)",
    "color:var(--ghost-text-primary, #fff)",
    "border:1px solid var(--ghost-border, #555)",
    "border-radius:4px",
    "padding:8px",
    "font-size:14px",
    "outline:none",
  ].join(";");

  card.appendChild(title);
  card.appendChild(input);
  backdrop.appendChild(card);

  return { backdrop, input };
}

export function showGodModePrompt(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const { backdrop, input } = createPromptDOM();

    function cleanup(): void {
      backdrop.remove();
    }

    function handleKeyDown(evt: KeyboardEvent): void {
      if (evt.key === "Enter") {
        evt.preventDefault();
        evt.stopPropagation();
        const value = input.value;
        cleanup();
        resolve(value);
      } else if (evt.key === "Escape") {
        evt.preventDefault();
        evt.stopPropagation();
        cleanup();
        resolve(undefined);
      }
    }

    input.addEventListener("keydown", handleKeyDown);
    backdrop.addEventListener("click", (evt) => {
      if (evt.target === backdrop) {
        cleanup();
        resolve(undefined);
      }
    });

    document.body.appendChild(backdrop);
    input.focus();
  });
}

export async function handleGodModeAction(runtime: ShellRuntime): Promise<void> {
  const secret = await showGodModePrompt();
  if (secret === undefined) {
    return;
  }
  if (validateGodModeAuth(secret)) {
    activateElevatedSession(runtime);
  } else {
    runtime.actionNotice = "Authentication failed";
  }
}
