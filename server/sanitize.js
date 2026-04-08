// sanitize.js — strip dangerous CLI flags from strings before agent prompt injection

/**
 * Strips dangerous CLI flags from text before it is injected into agent prompts.
 *
 * Handles:
 * - --dangerously-skip-permissions / --dangerouslySkipPermissions
 * - --permission-mode (with optional value via space or =)
 * - --agent (with optional value via space or =)
 * - --model (with optional value via space or =)
 * - -p (short form of --permission-mode, with value via space or =)
 *
 * Does NOT strip partial matches (e.g. --models is left alone).
 */
export function sanitizePrompt(text) {
  if (!text || typeof text !== "string") return text;

  // Standalone boolean flags (no value)
  // \b ensures we don't match partial prefixes; (?![\w-]) ensures we don't match longer flags
  const booleanFlags = /(?:^|\s)--(?:dangerously-skip-permissions|dangerouslySkipPermissions)(?![\w-])/g;

  // Flags that take a value (space-separated or =separated)
  // Match: --flag=value  OR  --flag value  (where value is a non-flag token)
  const valueFlagLong = /(?:^|\s)--(?:permission-mode|agent|model)(?:=[^\s]*|(?:\s+(?!-)(?:[^\s]+)))?(?![\w-])/g;

  // Short flag: -p value  or  -p=value (but not -px or --p)
  const shortP = /(?:^|\s)-p(?:=[^\s]*|(?:\s+(?!-)(?:[^\s]+)))?(?![\w-])/g;

  let result = text;
  result = result.replace(booleanFlags, " ");
  result = result.replace(valueFlagLong, " ");
  result = result.replace(shortP, " ");

  // Collapse extra whitespace
  return result.replace(/\s{2,}/g, " ").trim();
}
