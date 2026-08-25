---
name: context-fork
description: Fork the current working context to maintain a read-only trace of the active facts.
context: fork
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Context fork skill

Use a context fork when you need to isolate the active state from a broader working set while preserving the read-only evidence trail.

- Keep the fork narrow and deterministic.
- Preserve the root facts and the decision trail.
- Do not mutate the parent context during read-only validation.
- Record the recovered state and any isolation boundary in the artifact output.
