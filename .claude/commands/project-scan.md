---
description: "Run a repo-level validation scan"
allowed-tools:
  - Read
  - Glob
  - Grep
---

# /project-scan

Run a targeted validation pass across the repository:

1. Inspect the root rules and system directories.
2. Check the expected evidence artifacts for each workflow.
3. Verify all Python test suites in the harness directories pass.
4. Summarize the validation result in a concise status report.
