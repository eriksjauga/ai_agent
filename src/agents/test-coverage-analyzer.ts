import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt';

/**
 * Identifies untested code paths using extended thinking to reason about risk and priority.
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description: 'Identifies untested code paths and prioritizes missing test coverage',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  tools: ['Read', 'Grep', 'Glob'],
  model: 'sonnet'
};
