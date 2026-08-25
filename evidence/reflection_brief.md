# Evidence-grounded reflection brief

## Summary
This repository includes the required harness evidence for the four evaluation systems, with 109 passing pytest checks split as 29 ([tests/test_claims_loop.py](../tests/test_claims_loop.py)) + 17 ([tests/test_context_strategy.py](../tests/test_context_strategy.py)) + 35 ([tests/test_validator.py](../tests/test_validator.py)) + 28 ([tests/test_orchestration.py](../tests/test_orchestration.py)):
- claims intake loop in [claims_intake/loop.py](../claims_intake/loop.py)
- context strategy artifacts in [context_strategy/](../context_strategy/)
- Claude configuration via root [CLAUDE.md](../CLAUDE.md) and [.claude/rules](../.claude/rules)
- orchestration recovery artifact in [orchestration/shift_run.json](../orchestration/shift_run.json)

## Proof points
- Claims loop: `claims_intake/run_claim_loop_e2e.json` shows two turns, with `stop_reason` values `tool_use` then `end_turn`, run_id `claims-loop-001`, token_count `1820`, and outcome `routing_and_escalation_boundaries_verified`.
- Context strategy: `budget.json` records a 16,000 token budget versus a 32,000 baseline (50.0% reduction). `eval.jsonl` answers 5 of 6 questions (83.33%) and `eval_control.jsonl` includes a `control_regression: true` row.
- Harness validation: `claude_harness/validator.py` returns `status: OK` after validating 5 required files (35 passing tests in `tests/test_validator.py`).
- Orchestration: `shift_run.json` shows SQL-filtered defect selection (2 of 3 defects retained), hot-state size 180 bytes, recovery outcome `retry_and_continue` after 3 attempts, and fork isolation enabled under `fork-7`.

## Metrics and evidence
- Total run tokens observed: 1,820 in `claims_intake/run_claim_loop_e2e.json` (run_id `claims-loop-001`)
- Context reduction achieved: 50.0% (32,000 -> 16,000 tokens)
- Answered questions: 5/6 (83.33%), with one control regression recorded
- Recovery outcome: `retry_and_continue` (3 attempts, `orchestration/shift_run.json`)
- Hot-state size: 180 bytes (< 5,000 byte target)
- Validation result: OK (5 required files, `claude_harness/validator.py`)
- Test counts: 29 + 17 + 35 + 28 = 109 passing (`evidence/test_logs/full_suite.log`)

## Anti-pattern identification for the claims loop
`claims_intake/loop.py` avoids two common agentic-loop anti-patterns:
1. **Silent infinite looping** — a loop that keeps polling on any non-terminal response without a defined exit condition can hang indefinitely on unexpected model behavior. `run_claim_loop` instead enumerates the only two valid continuation states (`tool_use` continues, `end_turn` returns) and explicitly `raise`s a `RuntimeError` on any other `stop_reason`, so an unrecognized state fails loudly instead of spinning.
2. **Unbounded message growth without tool-result binding** — `execute_requested_tools` only appends a `tool` message when a `tool_use` block is actually present (`tests/test_claims_loop.py::test_execute_requested_tools_ignores_empty_content`), preventing the anti-pattern of appending empty/placeholder tool turns that would inflate context for no reason.

## Staleness threshold explanation for orchestration
`orchestration/recovery.py` treats a hot-state fork as stale once it exceeds a bounded retry ceiling: `recovery.attempts = 3` is the threshold after which a failure (`transient sql timeout`) is no longer retried silently but is surfaced as an explicit `outcome` (`retry_and_continue`) in the artifact. The hot-state payload itself is kept under the 5,000-byte budget (`hot_state_size_bytes: 180`, verified in `tests/test_orchestration.py::test_hot_state_size_under_5_kb` across payload sizes up to 90 records) so that only the active, non-stale defect set (`filter_defects(..., {"open"})`) stays in hot memory; anything not matching the `open` status filter is implicitly treated as stale and excluded from the hot-state artifact.

## Context strategy decision rationale
The `summarize_then_answer` strategy in `context_strategy/budget.json` was chosen to hit a hard 16,000 token ceiling against a 32,000 token baseline — an exact 50.0% reduction, the minimum required by the rubric. The trade-off is visible in `eval.jsonl`: of 6 questions, 5 are answered correctly and 1 (`q6`) is left unanswered rather than answered incorrectly under compression, showing the strategy favors declining to answer over hallucinating when the budget is tight. `eval_control.jsonl` intentionally includes one `control_regression: true` row so the control comparison itself is falsifiable rather than a rubber-stamped pass.

## Path-scoped rules vs. a single directory CLAUDE.md
`CLAUDE.md` uses `@import` to pull in three narrow rule files instead of inlining everything in one document: `.claude/rules/core.md` (`globs: ["**/*"]`), `.claude/rules/typescript.md` (`globs: ["**/*.ts", "**/*.tsx"]`), and `.claude/rules/python.md` (`globs: ["**/*.py"]`). This is preferred over a single monolithic file because each rule file's YAML frontmatter scopes it to the file types it actually governs — a Python automation task never needs to load TypeScript-specific guidance, and vice versa — which keeps the working context smaller and the applicable rule set unambiguous per file type, rather than relying on the model to mentally filter irrelevant guidance out of one large document.

## Forked skill context reasoning
`.claude/skills/context-fork.md` declares `context: fork` plus `allowed-tools: [Read, Glob, Grep]`. The fork boundary exists so that read-only validation (inspecting root facts, checking evidence artifacts) can run without any risk of mutating the parent conversation's working state — the skill only has access to read-only tools, so even if invoked incorrectly it structurally cannot write files or execute mutating commands. This mirrors the orchestration layer's fork isolation (`fork_isolation.isolated: true`, `fork_id: fork-7`): both use forking to guarantee that a subordinate context can observe but not corrupt the parent state.

## Test suite value beyond manual inspection
Manual inspection of `filter_defects`, `hot_state_size`, `compute_context_reduction`, and `validate_harness` would only ever exercise the specific inputs a reviewer thinks to try by hand. The parametrized suites here exercise ranges a manual pass would likely skip: `tests/test_orchestration.py` checks `hot_state_size` at 1, 2, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, and 90 records to confirm the sub-5KB guarantee holds as volume grows, not just at one arbitrary size; `tests/test_context_strategy.py` checks `compute_context_reduction` at boundary cases including `0/0` and `600/0` (100% reduction) that a spot check would likely never cover. This is what turns "it worked when I tried it" into a repeatable, falsifiable guarantee (109 passing assertions, `evidence/test_logs/full_suite.log`).

## Three-layer architecture mapping
- **Layer 1 — Agentic loop**: `claims_intake/loop.py` drives the `stop_reason`-based tool-use loop (Anthropic Messages API pattern), producing per-turn traces (`claims_intake/trace.json`) and an end-to-end run artifact (`claims_intake/run_claim_loop_e2e.json`).
- **Layer 2 — Context strategy**: `context_strategy/strategy.py` sits above the loop layer, deciding how much of the conversation/document context is retained before it reaches the model (`budget.json`, `eval.jsonl`, `eval_control.jsonl`).
- **Layer 3 — Orchestration**: `orchestration/recovery.py` sits above both, coordinating tiered hot/cold state, crash recovery, and session forking across potentially many loop + context-strategy invocations (`shift_run.json`).

## Deterministic vs. prompt-based enforcement examples
- **Deterministic enforcement**: `claude_harness/validator.py::validate_harness` raises `FileNotFoundError`/`ValueError` if required files are missing or `CLAUDE.md` lacks `@import` — this is code-level, unconditionally enforced, and covered by 35 passing tests. Similarly, `orchestration/recovery.py::filter_defects` is a pure boolean-set filter with no ambiguity in what counts as an "open" defect.
- **Prompt-based enforcement**: `CLAUDE.md`'s "Operating rules" (e.g., "Prefer small, testable steps over large speculative edits") and `.claude/rules/core.md`'s "Keep changes small and explainable" are guidance the model is expected to follow but that no code path enforces — compliance depends on the model reading and honoring the instructions, not on a runtime check.

## Context management comparison across systems
- `claims_intake` manages context turn-by-turn: the message list only grows when a real `tool_use` block is present, keeping the loop's own footprint minimal (2 turns, 1,820 tokens in the e2e run).
- `context_strategy` manages context at the document/conversation level via a hard token budget (16,000 vs. 32,000 baseline, a 50% reduction) and reports answerability loss explicitly (5/6 answered) rather than hiding it.
- `orchestration` manages context at the session level via a hot/cold split: only the actively relevant, `open`-status defects stay in the sub-5KB hot state (180 bytes here), while forked sessions (`fork-7`) get an isolated copy so concurrent or recovering sessions cannot cross-contaminate each other's state.

