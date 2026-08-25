# Verification logs

Each section below is identified by system name and file path, with the exact pytest command and passing output captured from this workspace. Full captured output also lives under `evidence/test_logs/`.

## System 1: claims_intake (stop-reason-driven claims loop)

- Implementation: [claims_intake/loop.py](../claims_intake/loop.py)
- Turn-by-turn trace artifact: [claims_intake/trace.json](../claims_intake/trace.json)
- End-to-end run artifact: [claims_intake/run_claim_loop_e2e.json](../claims_intake/run_claim_loop_e2e.json)
  - `run_id`: `claims-loop-001`
  - `token_count`: `1820`
  - trace: turn 1 `stop_reason=tool_use` (tool `search_claims`) -> turn 2 `stop_reason=end_turn` (`route=escalate_to_human`)
  - `outcome`: `routing_and_escalation_boundaries_verified`

Command:
```bash
python -m pytest tests/test_claims_loop.py -q
```

Output:
```text
.............................                                            [100%]
29 passed in 0.13s
```

Full log: [evidence/test_logs/claims_intake.log](test_logs/claims_intake.log)

## System 2: context_strategy (context budget and answer quality)

- Implementation: [context_strategy/strategy.py](../context_strategy/strategy.py)
- Budget artifact: [context_strategy/budget.json](../context_strategy/budget.json) — 16,000 token budget vs. 32,000 baseline = 50.0% reduction
- Eval artifact: [context_strategy/eval.jsonl](../context_strategy/eval.jsonl) — 5 of 6 questions answered (83.33%)
- Control artifact: [context_strategy/eval_control.jsonl](../context_strategy/eval_control.jsonl) — includes one row with `control_regression: true`

Command:
```bash
python -m pytest tests/test_context_strategy.py -q
```

Output:
```text
.................                                                        [100%]
17 passed in 0.10s
```

Full log: [evidence/test_logs/context_strategy.log](test_logs/context_strategy.log)

## System 3: claude_harness (Claude Code harness configuration)

- Validator: [claude_harness/validator.py](../claude_harness/validator.py) — returns `status: OK`
- Root config: [CLAUDE.md](../CLAUDE.md) — uses `@import` for path-scoped rule files
- Rule files: [.claude/rules/core.md](../.claude/rules/core.md), [.claude/rules/typescript.md](../.claude/rules/typescript.md), [.claude/rules/python.md](../.claude/rules/python.md) — each has YAML glob frontmatter
- Command: [.claude/commands/project-scan.md](../.claude/commands/project-scan.md) — project-scoped slash command with `allowed-tools`
- Skill: [.claude/skills/context-fork.md](../.claude/skills/context-fork.md) — `context: fork` plus read-only `allowed-tools` (Read, Glob, Grep)

Command:
```bash
python -m pytest tests/test_validator.py -q
```

Output:
```text
...................................                                      [100%]
35 passed in 0.14s
```

Full log: [evidence/test_logs/claude_harness.log](test_logs/claude_harness.log)

## System 4: orchestration (recovery and fork isolation)

- Implementation: [orchestration/recovery.py](../orchestration/recovery.py)
- Shift run artifact: [orchestration/shift_run.json](../orchestration/shift_run.json)
  - SQL-filtered defects: 2 open defects retained (`D-1`, `D-3`) out of 3 via `filter_defects`
  - `hot_state_size_bytes`: `180` (< 5,000 byte target)
  - `recovery.outcome`: `retry_and_continue` (recovered after 3 attempts)
  - `fork_isolation.isolated`: `true`, `fork_id`: `fork-7`

Command:
```bash
python -m pytest tests/test_orchestration.py -q
```

Output:
```text
............................                                             [100%]
28 passed in 0.09s
```

Full log: [evidence/test_logs/orchestration.log](test_logs/orchestration.log)

## Full suite

Command:
```bash
python -m pytest -q
```

Output:
```text
........................................................................ [ 66%]
.....................................                                    [100%]
109 passed in 0.40s
```

29 (claims_intake) + 17 (context_strategy) + 35 (claude_harness) + 28 (orchestration) = 109 total, matching each system's required count.

Full log: [evidence/test_logs/full_suite.log](test_logs/full_suite.log)
