import { query } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReport, ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types';
import { mcpServersConfig, githubTools } from './config/mcp.config';
import { codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester } from './agents';
import { buildOrchestratorPrompt } from './prompts';
import { RateLimiter, RateLimiterConfig } from './utils/rate-limiter';
import { withRetry, withTimeout, ReviewError, ErrorCodes } from './utils/error-handler';
import { logger, logReviewStart, logReviewComplete, logReviewError } from './utils/logger';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  /** Rate limit overrides (requests/minute, tokens/minute, concurrency) */
  rateLimits?: Partial<RateLimiterConfig>;
  /** Maximum agentic turns before the orchestrator gives up */
  maxTurns?: number;
  /** Overall timeout for a single PR review, in milliseconds */
  timeoutMs?: number;
  /** Model to use for the orchestrator agent */
  model?: string;
}

/**
 * Async generator input mode (recommended streaming pattern for MCP/subagent compatibility)
 */
async function* generateMessages(userMessage: string) {
  yield {
    type: 'user' as const,
    message: { role: 'user' as const, content: userMessage },
    parent_tool_use_id: null,
    session_id: 'code-review-orchestrator-session'
  };
}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private rateLimiter: RateLimiter;
  private maxTurns: number;
  private timeoutMs: number;
  private model: string;

  constructor(options: OrchestratorOptions = {}) {
    this.rateLimiter = new RateLimiter(options.rateLimits ?? {});
    this.maxTurns = options.maxTurns ?? 40;
    this.timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
    this.model = options.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5-20250929';
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();
    logReviewStart(owner, repo, prNumber);

    await this.rateLimiter.acquire(10000);
    try {
      const prompt = buildOrchestratorPrompt(owner, repo, prNumber);

      const rawReport = await withTimeout(
        () => withRetry(() => this.runAgenticReview(prompt), 3, 1000),
        this.timeoutMs,
        `Code review timed out for ${owner}/${repo}#${prNumber}`
      );

      const duration = Date.now() - startTime;
      const rawReportRecord = rawReport as Record<string, unknown>;
      const parsed = ReviewReportSchema.safeParse({
        ...rawReportRecord,
        metadata: {
          ...(rawReportRecord.metadata as Record<string, unknown> | undefined),
          duration
        }
      });

      if (!parsed.success) {
        throw new ReviewError(
          `Structured output failed schema validation: ${parsed.error.message}`,
          ErrorCodes.STRUCTURED_OUTPUT_FAILED
        );
      }

      logReviewComplete(owner, repo, prNumber, parsed.data.summary.overallScore, duration);
      return parsed.data;
    } catch (error) {
      logReviewError(owner, repo, prNumber, error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      this.rateLimiter.release();
    }
  }

  /**
   * Runs the orchestrator agent, which fetches PR files via GitHub MCP and
   * delegates per-file analysis to the three subagents in parallel via the Task tool.
   */
  private async runAgenticReview(prompt: string): Promise<unknown> {
    for await (const message of query({
      prompt: generateMessages(prompt),
      options: {
        mcpServers: mcpServersConfig,
        allowedTools: [...githubTools, 'Task'],
        agents: {
          'code-quality-analyzer': codeQualityAnalyzer,
          'test-coverage-analyzer': testCoverageAnalyzer,
          'refactoring-suggester': refactoringSuggester
        },
        model: this.model,
        maxTurns: this.maxTurns,
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema
        }
      }
    })) {
      if ((message as { type: string }).type === 'init') {
        const init = message as unknown as { mcpServers?: Record<string, { status: string; error?: string }> };
        if (init.mcpServers) {
          for (const [name, server] of Object.entries(init.mcpServers)) {
            if (server.status === 'failed') {
              throw new ReviewError(
                `MCP server '${name}' failed to connect: ${server.error ?? 'Unknown error'}`,
                ErrorCodes.GITHUB_API_ERROR
              );
            }
            logger.debug(`MCP server status`, { server: name, status: server.status });
          }
        }
      } else if (message.type === 'assistant') {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_use' && block.name === 'Task') {
              const input = block.input as { description?: string; subagent_type?: string };
              logger.debug('Invoking subagent', {
                description: input.description,
                subagent: input.subagent_type
              });
            }
          }
        }
      } else if (message.type === 'result' && message.subtype === 'success' && message.structured_output) {
        return message.structured_output;
      } else if (message.type === 'result') {
        throw new ReviewError(`Agentic review failed: ${message.subtype}`, ErrorCodes.AGENT_FAILED);
      }
    }

    throw new ReviewError(
      'Failed to get structured output from orchestrator agent',
      ErrorCodes.STRUCTURED_OUTPUT_FAILED
    );
  }
}
