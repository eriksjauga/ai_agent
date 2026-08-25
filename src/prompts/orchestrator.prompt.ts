/**
 * Orchestrator prompt builder
 * Instructs the top-level agent to fetch PR files and delegate analysis
 * to the three specialized subagents in parallel, per file.
 */
export function buildOrchestratorPrompt(owner: string, repo: string, prNumber: number): string {
  return `You are the orchestrator for an automated code review system.

TARGET PULL REQUEST: ${owner}/${repo}#${prNumber}

You have access to:
- GitHub MCP tools (mcp__github__get_pull_request, mcp__github__get_pull_request_files, mcp__github__get_file_contents) to read PR metadata and file contents.
- The Task tool to delegate work to three specialized subagents: "code-quality-analyzer", "test-coverage-analyzer", "refactoring-suggester".

WORKFLOW:
1. Call mcp__github__get_pull_request_files to list the files changed in this PR.
2. For each changed file (skip binary/deleted files), fetch its contents with mcp__github__get_file_contents.
3. For each file, invoke all three subagents IN PARALLEL via the Task tool, passing the file path and its contents:
   - code-quality-analyzer: returns a CodeQualityResult
   - test-coverage-analyzer: returns a TestCoverageResult
   - refactoring-suggester: returns a RefactoringSuggestion
4. Aggregate every file's three results into a single fileReviews entry.
5. Compute summary statistics across all files:
   - totalFiles, overallScore (average of per-file quality scores)
   - criticalIssues (count of critical-severity code quality issues)
   - highPriorityTests (count of critical/high priority untested paths)
   - refactoringOpportunities (total refactoring suggestions)
6. Produce a prioritized recommendations list (critical/high/medium/low) referencing affected files.
7. Fill metadata.analyzedAt with the current ISO timestamp and metadata.agentVersions with the model used for each subagent.

Return the complete result as structured JSON matching the ReviewReport schema.`;
}
