# Evidence-grounded reflection brief

## Summary
This repository now includes the required harness evidence for the four evaluation systems:
- claims intake loop in claims_intake/loop.py
- context strategy artifacts in context_strategy/
- Claude configuration via root CLAUDE.md and .claude/rules
- orchestration recovery artifact in orchestration/shift_run.json

## Proof points
- Claims loop: run_claim_loop_e2e.json shows two turns, with stop_reason values tool_use then end_turn, and a run_id of claims-loop-001.
- Context strategy: budget.json records a 16,000 token budget versus a 32,000 baseline, which is a 50.0% reduction. eval.jsonl answers 5 of 6 questions (83.33%) and the control file includes a regression marker.
- Harness validation: claude_harness/validator.py returns status OK after validating the required files.
- Orchestration: shift_run.json shows filtered SQL defect selection, hot-state size 180 bytes, recovery outcome retry_and_continue, and fork isolation enabled.

## Metrics and evidence
- Total run tokens observed: 1,820 in claims_intake/run_claim_loop_e2e.json
- Context reduction achieved: 50.0%
- Answered questions: 5/6
- Recovery outcome: retry_and_continue
- Hot-state size: 180 bytes (< 5 KB)
- Validation result: OK
