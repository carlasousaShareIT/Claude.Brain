// spiral-detector.js — in-memory rolling window for tool call pattern detection.
// Detects: rapid retries (many Bash in short window), repeated consecutive failures.
// Only counts ALLOWED calls — denied calls must not be recorded to avoid self-feeding loops.

const MAX_CALLS = 100;
const RAPID_WINDOW_MS = 90000;  // 90 seconds
const RAPID_THRESHOLD = 8;      // 8+ Bash calls in window
const CONSECUTIVE_THRESHOLD = 6; // 6+ consecutive Bash without other tools

const sessions = new Map();

function getDetector(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      calls: [],              // [{ toolName, timestamp }]
    });
  }
  return sessions.get(sessionId);
}

export function recordCall(sessionId, toolName) {
  const detector = getDetector(sessionId);
  const timestamp = Date.now();

  detector.calls.push({ toolName, timestamp });
  if (detector.calls.length > MAX_CALLS) {
    detector.calls = detector.calls.slice(-MAX_CALLS);
  }
}

// detect() is read-only — call it without recording first to check before allowing.
export function detect(sessionId) {
  const detector = sessions.get(sessionId);
  if (!detector) return { spiral: false, patterns: [] };

  const now = Date.now();
  const patterns = [];

  // Pattern 1: Rapid retries — many Bash calls in a short window
  const recentBash = detector.calls.filter(
    (c) => c.toolName === "Bash" && now - c.timestamp < RAPID_WINDOW_MS
  );
  if (recentBash.length >= RAPID_THRESHOLD) {
    patterns.push({
      pattern: "rapid_retries",
      message: `${recentBash.length} Bash calls in the last 90s. Stop and re-plan before retrying.`,
      count: recentBash.length,
    });
  }

  // Pattern 2: Repeated failures — many consecutive Bash without intervening other tools
  const calls = detector.calls;
  let consecutiveBash = 0;
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i].toolName === "Bash") {
      consecutiveBash++;
    } else {
      break;
    }
  }
  if (consecutiveBash >= CONSECUTIVE_THRESHOLD) {
    patterns.push({
      pattern: "repeated_failures",
      message: `${consecutiveBash} consecutive Bash calls without reading or planning. Step back and review your approach.`,
      count: consecutiveBash,
    });
  }

  return { spiral: patterns.length > 0, patterns };
}

export function clearSession(sessionId) {
  sessions.delete(sessionId);
}
