import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt';

/**
 * Analyzes a file for security, performance, and maintainability issues.
 * Invokes language-specific and security Claude Skills before reporting findings.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description: 'Analyzes code for security, performance, and maintainability issues using Claude Skills',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  tools: ['Skill', 'Read', 'Grep', 'Glob'],
  model: 'sonnet'
};
