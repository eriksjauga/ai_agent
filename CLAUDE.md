---
description: "Repository-wide Claude harness and engineering guardrails"
---

# Repository instructions

This repo uses the Claude harness for validation, evaluation, and recovery workflows.

@import ./.claude/rules/core.md
@import ./.claude/rules/typescript.md
@import ./.claude/rules/python.md

## Operating rules

- Prefer small, testable steps over large speculative edits.
- Keep evidence artifacts in the system folders for each workflow.
- Use read-only tools for investigation and validation before writing changes.
- Preserve auditability: record tests, outputs, and token counts in the artifacts directory.

## Commands

- Use /project-scan for a repo-level validation run.
- Keep all generated evidence under the corresponding system folder.
- Favor explicit routing, escalation, and recovery in agent loops.
