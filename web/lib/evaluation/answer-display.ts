/**
 * Normalize a model answer's raw text before it is rendered to the participant.
 *
 * - Trims leading/trailing whitespace so a short answer card is top-aligned with
 *   no empty gap below its label.
 * - Collapses runs of 3+ consecutive newlines into a single blank line so a
 *   model-emitted whitespace run does not inject large vertical gaps.
 *
 * A single newline (plain-text line break) and a single blank line (one
 * paragraph gap) are preserved unchanged.
 */
export function normalizeAnswerText(text: string): string {
  return text.replace(/\n{3,}/g, "\n\n").trim()
}
