import { escapeHtml } from "../app/utils.js";

export interface PopoutButtonPart {
  readonly instanceId: string;
  readonly title: string;
}

export function renderPartPopoutButton(part: PopoutButtonPart): string {
  return `<button type="button" data-action="popout" data-tab-id="${part.instanceId}" data-part-id="${part.instanceId}" aria-label="Pop out ${escapeHtml(part.title)} to a new window" title="Pop out tab to a new window">Pop out tab</button>`;
}
