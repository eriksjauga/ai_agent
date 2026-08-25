import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReviewReport } from '../src/types/report-types';

/**
 * Tests for CodeReviewOrchestrator
 *
 * The Claude Agent SDK's `query()` is mocked so these tests run without
 * network access or API keys, and exercise the orchestrator's own logic:
 * configuration, MCP/agent wiring, aggregation, and schema validation.
 */

const sampleReport: ReviewReport = {
  pullRequest: { owner: 'octocat', repo: 'hello-world', number: 42 },
  fileReviews: [
    {
      file: 'src/payment.ts',
      codeQuality: {
        file: 'src/payment.ts',
        issues: [
          {
            line: 10,
            severity: 'critical',
            category: 'security',
            description: 'Hardcoded API key',
            suggestion: 'Move to environment variable'
          }
        ],
        overallScore: 70,
        summary: 'One critical security issue found.'
      },
      testCoverage: {
        file: 'src/payment.ts',
        hasTests: false,
        testFiles: [],
        untestedPaths: [
          {
            type: 'function',
            location: 'processPayment',
            priority: 'high',
            reasoning: 'No tests cover the error path',
            suggestedTest: 'Test processPayment rejects invalid card'
          }
        ],
        coverageEstimate: 40,
        summary: 'Low coverage on error handling.'
      },
      refactorings: {
        file: 'src/payment.ts',
        suggestions: [
          {
            type: 'modernize',
            location: 'processPayment',
            impact: 'medium',
            description: 'Use async/await instead of callbacks',
            before: 'function f(cb) {}',
            after: 'async function f() {}',
            benefits: 'Improves readability'
          }
        ],
        summary: 'One modernization opportunity.'
      }
    }
  ],
  summary: {
    totalFiles: 1,
    overallScore: 70,
    criticalIssues: 1,
    highPriorityTests: 1,
    refactoringOpportunities: 1
  },
  recommendations: [
    {
      priority: 'critical',
      category: 'security',
      description: 'Remove hardcoded credentials',
      files: ['src/payment.ts']
    }
  ],
  metadata: {
    analyzedAt: '2025-01-15T10:30:00.000Z',
    duration: 0,
    agentVersions: { orchestrator: 'claude-sonnet-4-5-20250929' }
  }
};

function buildResultMessage(structuredOutput: unknown) {
  return {
    type: 'result' as const,
    subtype: 'success' as const,
    structured_output: structuredOutput
  };
}

// Mock must be hoisted before importing the orchestrator module
const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock
}));

import { CodeReviewOrchestrator } from '../src/orchestrator';

async function* toAsyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    queryMock.mockReset();
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      expect(() => new CodeReviewOrchestrator()).not.toThrow();
    });

    it('should accept custom rate limit configuration', () => {
      const orchestrator = new CodeReviewOrchestrator({
        rateLimits: { maxRequestsPerMinute: 10, maxTokensPerMinute: 5000, maxConcurrent: 1 }
      });
      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });
  });

  describe('reviewPullRequest', () => {
    it('should call query with GitHub MCP tools and subagents configured', async () => {
      queryMock.mockImplementation(() => toAsyncIterable([buildResultMessage(sampleReport)]));

      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('octocat', 'hello-world', 42);

      expect(queryMock).toHaveBeenCalledTimes(1);
      const callArgs = queryMock.mock.calls[0][0];
      expect(callArgs.options.allowedTools).toContain('Task');
      expect(callArgs.options.allowedTools.some((t: string) => t.includes('github'))).toBe(true);
      expect(Object.keys(callArgs.options.agents)).toEqual(
        expect.arrayContaining(['code-quality-analyzer', 'test-coverage-analyzer', 'refactoring-suggester'])
      );
      expect(callArgs.options.mcpServers).toHaveProperty('github');
    });

    it('should spawn all 3 subagents definitions passed to the SDK', async () => {
      queryMock.mockImplementation(() => toAsyncIterable([buildResultMessage(sampleReport)]));

      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('octocat', 'hello-world', 42);

      const callArgs = queryMock.mock.calls[0][0];
      const agents = callArgs.options.agents;
      expect(agents['code-quality-analyzer']).toBeDefined();
      expect(agents['test-coverage-analyzer']).toBeDefined();
      expect(agents['refactoring-suggester']).toBeDefined();
    });

    it('should aggregate results into a validated ReviewReport', async () => {
      queryMock.mockImplementation(() => toAsyncIterable([buildResultMessage(sampleReport)]));

      const orchestrator = new CodeReviewOrchestrator();
      const report = await orchestrator.reviewPullRequest('octocat', 'hello-world', 42);

      expect(report.pullRequest).toEqual({ owner: 'octocat', repo: 'hello-world', number: 42 });
      expect(report.fileReviews).toHaveLength(1);
      expect(report.summary.criticalIssues).toBe(1);
      expect(report.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should validate output with the Zod schema and reject malformed structured output', async () => {
      queryMock.mockImplementation(() =>
        toAsyncIterable([buildResultMessage({ pullRequest: { owner: 'octocat' } })])
      );

      const orchestrator = new CodeReviewOrchestrator({ rateLimits: { maxRequestsPerMinute: 100 } });

      await expect(
        orchestrator.reviewPullRequest('octocat', 'hello-world', 42)
      ).rejects.toThrow();
    });

    it('should throw when the agent result is an error', async () => {
      queryMock.mockImplementation(() =>
        toAsyncIterable([{ type: 'result' as const, subtype: 'error_max_turns' as const }])
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('octocat', 'hello-world', 42)
      ).rejects.toThrow();
    });

    it('should throw when an MCP server fails to connect', async () => {
      queryMock.mockImplementation(() =>
        toAsyncIterable([
          { type: 'init' as const, mcpServers: { github: { status: 'failed', error: 'auth error' } } },
          buildResultMessage(sampleReport)
        ])
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('octocat', 'hello-world', 42)
      ).rejects.toThrow(/failed to connect/i);
    });
  });

  describe('Integration', () => {
    // These tests require actual API keys and should be skipped in CI
    it.skip('should review a real small PR', async () => {
      // NOTE: Only run manually with valid API keys
    });
  });
});

