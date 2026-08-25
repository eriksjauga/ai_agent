/**
 * Model Context Protocol (MCP) server configurations
 *
 * Required MCP Servers:
 * 1. GitHub - For PR/repo operations
 * 2. ESLint - For code linting and style analysis
 *
 * Documentation:
 * - MCP Protocol: https://modelcontextprotocol.io
 * - GitHub MCP: https://github.com/github/github-mcp-server
 * - ESLint MCP: https://eslint.org/docs/latest/use/mcp
 */

export interface McpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export const mcpServersConfig: Record<string, McpServerConfig> = {
  /**
   * GitHub MCP Server
   * Provides tools for GitHub API operations
   *
   * Note: GITHUB_TOKEN is optional (recommended for private repos and higher rate limits).
   * The GitHub MCP server expects GITHUB_PERSONAL_ACCESS_TOKEN as the env var name.
   * We map our GITHUB_TOKEN from .env to this expected name.
   */
  github: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '' }
  },

  /**
   * ESLint MCP Server
   * Provides tools for linting and code quality analysis
   */
  eslint: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {}
  }
};

/** GitHub MCP tools used by the orchestrator to fetch PR metadata and files */
export const githubTools = [
  'mcp__github__get_pull_request',
  'mcp__github__get_pull_request_files',
  'mcp__github__get_file_contents'
];

/** ESLint MCP tools used by the code-quality-analyzer subagent */
export const eslintTools = [
  'mcp__eslint__lint'
];
