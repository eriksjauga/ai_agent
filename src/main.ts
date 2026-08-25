import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator';
import { ReportGenerator } from './utils/report-generator';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  if (!owner || !repo || !prStr) {
    console.error('Usage: npm run dev <owner> <repo> <pr-number>');
    process.exit(1);
  }

  const prNumber = Number.parseInt(prStr, 10);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.error(`Invalid PR number: "${prStr}". Must be a positive integer.`);
    process.exit(1);
  }

  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasBedrockCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  if (hasBedrockCreds) {
    if (!process.env.AWS_REGION) {
      console.error('AWS_REGION must be set when using AWS Bedrock authentication.');
      process.exit(1);
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error(
      'Missing authentication. Set either:\n' +
      '  - ANTHROPIC_API_KEY (Anthropic API), or\n' +
      '  - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION (AWS Bedrock)'
    );
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_MODEL) {
    console.error(
      'ANTHROPIC_MODEL is required. Examples:\n' +
      '  - AWS Bedrock: us.anthropic.claude-sonnet-4-5-20250929-v1:0\n' +
      '  - Anthropic API: claude-sonnet-4-5-20250929'
    );
    process.exit(1);
  }

  console.log('Starting code review', { owner, repo, prNumber });

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const reportGenerator = new ReportGenerator();
    const reportsDir = path.resolve('reports');
    fs.mkdirSync(reportsDir, { recursive: true });

    const baseName = `${owner}-${repo}-pr${prNumber}`;
    fs.writeFileSync(path.join(reportsDir, `${baseName}.json`), reportGenerator.generateJSONReport(report));
    fs.writeFileSync(path.join(reportsDir, `${baseName}.md`), reportGenerator.generateMarkdownReport(report));
    fs.writeFileSync(path.join(reportsDir, `${baseName}.html`), reportGenerator.generateHTMLReport(report));

    console.log(`✅ Review complete. Reports saved to ${reportsDir}`);
  } catch (error) {
    logger.error('Fatal error during code review', { error: error instanceof Error ? error.message : String(error) });
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
