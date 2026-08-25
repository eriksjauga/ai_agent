import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt';

/**
 * Suggests modernization opportunities and design pattern improvements with before/after examples.
 */
export const refactoringSuggester: AgentDefinition = {
  description: 'Suggests modernization and pattern improvements with before/after examples',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  tools: ['Read', 'Grep', 'Glob'],
  model: 'sonnet'
};
