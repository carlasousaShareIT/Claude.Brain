// observer/engine.js — Pure violation detection engine
// Processes tool call events and detects behavioral violations.
// Stateful class, no side effects — all I/O injected by caller.

import crypto from "crypto";

// Default thresholds — per-violation-type
const DEFAULT_THRESHOLDS = {
  spiral_explorer: { readCountWithoutWrite: 20 },
  loop: { repeatCount: 5 },
  late_output: { callsWithoutCommitOrWrite: 40 },
  stuck: { silenceSeconds: 60 },
  role_violation: { researcherWriteLimit: 3, builderExploreLimit: 15 },
};

// Per-profile overrides: null disables the violation for that profile
const PROFILE_OVERRIDES = {
  researcher: {
    late_output: null, // researchers never trigger late_output
    spiral_explorer: { readCountWithoutWrite: 40 }, // higher tolerance
    role_violation: { researcherWriteLimit: 3 },
  },
  builder: {
    spiral_explorer: { readCountWithoutWrite: 10 }, // builders should write sooner
    role_violation: { builderExploreLimit: 15 },
  },
  reviewer: {
    late_output: null,
    spiral_explorer: null, // reviewers are read-heavy by nature
  },
};

// Tool classification
const READ_TOOLS = new Set([
  "Read", "Grep", "Glob", "WebSearch", "WebFetch",
  "ReadMcpResourceTool", "ListMcpResourcesTool",
  "ToolSearch", "TaskGet", "TaskList",
]);
const WRITE_TOOLS = new Set([
  "Write", "Edit", "Bash", "NotebookEdit",
]);
const COMMIT_INDICATORS = ["git commit", "git push"];

const hashInput = (toolName, input) => {
  const str = toolName + "::" + JSON.stringify(input);
  return crypto.createHash("md5").update(str).digest("hex");
};

export class ObserverEngine {
  constructor({ thresholds, profileOverrides, agentProfile } = {}) {
    this._baseThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this._profileOverrides = { ...PROFILE_OVERRIDES, ...profileOverrides };
    this._agentProfile = agentProfile || null; // { role: "researcher"|"builder"|"reviewer"|... }
    this._thresholds = this._resolveThresholds();

    this.reset();
  }

  _resolveThresholds() {
    const role = this._agentProfile?.role || "";
    const overrides = this._profileOverrides[role] || {};
    const resolved = {};

    for (const [type, defaults] of Object.entries(this._baseThresholds)) {
      if (type in overrides) {
        if (overrides[type] === null) {
          resolved[type] = null; // disabled
        } else {
          resolved[type] = { ...defaults, ...overrides[type] };
        }
      } else {
        resolved[type] = { ...defaults };
      }
    }
    return resolved;
  }

  reset() {
    this._readCount = 0;
    this._writeCount = 0;
    this._totalCalls = 0;
    this._callsSinceLastCommitOrWrite = 0;
    this._lastEventTime = null;
    this._startTime = null;
    this._firstWriteAt = null;
    this._commitCount = 0;
    this._testRunCount = 0;
    this._testPassCount = 0;
    this._testFailCount = 0;
    this._violationCount = 0;
    this._inputTokens = 0;
    this._cacheReadTokens = 0;
    this._cacheCreationTokens = 0;
    this._outputTokens = 0;
    this._toolCallCounts = {};
    this._inputHashes = new Map(); // hash → count
    this._violations = [];
    this._researcherWrites = 0;
    this._builderExplores = 0;
  }

  processEvent(event) {
    const violations = [];
    const now = event.timestamp ? new Date(event.timestamp).getTime() : Date.now();

    if (!this._startTime) this._startTime = now;

    // Claude Code JSONL: tokens are inside assistant.message.usage
    if (event.type === "assistant" && event.message?.usage) {
      const u = event.message.usage;
      this._inputTokens += u.input_tokens || 0;
      this._cacheReadTokens += u.cache_read_input_tokens || 0;
      this._cacheCreationTokens += u.cache_creation_input_tokens || 0;
      this._outputTokens += u.output_tokens || 0;

      // Extract tool_use blocks from assistant message content
      const content = event.message?.content || [];
      for (const block of content) {
        if (block?.type === "tool_use") {
          violations.push(...this._processToolCall(block.name || "", block.input || {}, now));
        }
      }
    }

    // Track tokens from flat event format (legacy/custom)
    if (event.inputTokens) this._inputTokens += event.inputTokens;
    if (event.outputTokens) this._outputTokens += event.outputTokens;

    // Flat tool_use / tool_result events (custom format)
    if (event.type === "tool_use" || event.type === "tool_result") {
      const toolName = event.tool || event.name || "";
      const input = event.input || event.params || {};
      violations.push(...this._processToolCall(toolName, input, now));
    }

    // Track test results from tool_result events
    if (event.type === "tool_result" && event.output) {
      const output = typeof event.output === "string" ? event.output : JSON.stringify(event.output);
      if (/tests?\s+passed|passing/i.test(output)) this._testPassCount++;
      if (/tests?\s+failed|failing|FAIL/i.test(output)) this._testFailCount++;
    }

    // Record violations
    for (const v of violations) {
      this._violations.push(v);
      this._violationCount++;
    }

    return violations;
  }

  _processToolCall(toolName, input, now) {
    const violations = [];

    this._totalCalls++;
    this._toolCallCounts[toolName] = (this._toolCallCounts[toolName] || 0) + 1;

    // Check stuck (time since last event)
    if (this._lastEventTime && this._thresholds.stuck) {
      const gap = (now - this._lastEventTime) / 1000;
      if (gap >= this._thresholds.stuck.silenceSeconds) {
        violations.push(this._makeViolation("stuck", {
          silenceSeconds: Math.round(gap),
          threshold: this._thresholds.stuck.silenceSeconds,
        }));
      }
    }

    // Classify tool
    const isRead = READ_TOOLS.has(toolName);
    const isWrite = WRITE_TOOLS.has(toolName);
    const isCommit = isWrite && toolName === "Bash" &&
      typeof input.command === "string" &&
      COMMIT_INDICATORS.some(ci => input.command.includes(ci));

    if (isRead) {
      this._readCount++;
      this._builderExplores++;
    }

    if (isWrite) {
      this._writeCount++;
      this._callsSinceLastCommitOrWrite = 0;
      this._readCount = 0;
      this._researcherWrites++;
      if (!this._firstWriteAt) this._firstWriteAt = new Date(now).toISOString();
      if (isCommit) {
        this._commitCount++;
        this._callsSinceLastCommitOrWrite = 0;
      }
    }

    // Detect test runs
    if (toolName === "Bash" && typeof input.command === "string") {
      if (/npm\s+test|jest|vitest|mocha|karma|ng\s+test/.test(input.command)) {
        this._testRunCount++;
      }
      if (!isRead) this._builderExplores = 0;
    }

    // Check spiral_explorer
    if (this._thresholds.spiral_explorer && isRead) {
      if (this._readCount >= this._thresholds.spiral_explorer.readCountWithoutWrite) {
        violations.push(this._makeViolation("spiral_explorer", {
          readCount: this._readCount,
          threshold: this._thresholds.spiral_explorer.readCountWithoutWrite,
        }));
        this._readCount = 0;
      }
    }

    // Check loop (repeated identical calls)
    if (this._thresholds.loop) {
      const h = hashInput(toolName, input);
      const count = (this._inputHashes.get(h) || 0) + 1;
      this._inputHashes.set(h, count);
      if (count >= this._thresholds.loop.repeatCount) {
        violations.push(this._makeViolation("loop", {
          tool: toolName, repeatCount: count, threshold: this._thresholds.loop.repeatCount,
        }));
        this._inputHashes.set(h, 0);
      }
    }

    // Check late_output
    if (this._thresholds.late_output && !isWrite) {
      this._callsSinceLastCommitOrWrite++;
      if (this._callsSinceLastCommitOrWrite >= this._thresholds.late_output.callsWithoutCommitOrWrite) {
        violations.push(this._makeViolation("late_output", {
          callsSinceOutput: this._callsSinceLastCommitOrWrite,
          threshold: this._thresholds.late_output.callsWithoutCommitOrWrite,
        }));
        this._callsSinceLastCommitOrWrite = 0;
      }
    }

    // Check role_violation
    if (this._thresholds.role_violation) {
      const role = this._agentProfile?.role || "";
      if (role === "researcher" && this._researcherWrites > this._thresholds.role_violation.researcherWriteLimit) {
        violations.push(this._makeViolation("role_violation", {
          role, action: "researcher writing files", writeCount: this._researcherWrites,
        }));
        this._researcherWrites = 0;
      }
      if (role === "builder" && this._builderExplores > this._thresholds.role_violation.builderExploreLimit) {
        violations.push(this._makeViolation("role_violation", {
          role, action: "builder excessive exploration", exploreCount: this._builderExplores,
        }));
        this._builderExplores = 0;
      }
    }

    this._lastEventTime = now;
    return violations;
  }

  _makeViolation(type, details) {
    return {
      type,
      agentName: this._agentProfile?.name || "unknown",
      details,
      severity: "warning", // always warning in passive mode; caller upgrades if active
      timestamp: new Date().toISOString(),
    };
  }

  getMetrics() {
    const now = Date.now();
    return {
      toolCalls: { ...this._toolCallCounts },
      totalCalls: this._totalCalls,
      firstWriteAt: this._firstWriteAt,
      commitCount: this._commitCount,
      testRunCount: this._testRunCount,
      testPassCount: this._testPassCount,
      testFailCount: this._testFailCount,
      violationCount: this._violationCount,
      durationMs: this._startTime ? now - this._startTime : 0,
      inputTokens: this._inputTokens,
      cacheReadTokens: this._cacheReadTokens,
      cacheCreationTokens: this._cacheCreationTokens,
      outputTokens: this._outputTokens,
    };
  }

  getViolations() {
    return [...this._violations];
  }
}

export { DEFAULT_THRESHOLDS, PROFILE_OVERRIDES };
