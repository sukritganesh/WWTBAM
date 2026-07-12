import { assertValidPipeline, contentSummaryLine, runContentPipeline } from './pipeline';

const result = await runContentPipeline();
assertValidPipeline(result);
console.log(`Content valid: ${contentSummaryLine(result)}.`);
console.log(`Integrity: ${result.report.sourceIntegrity.allHashesMatch ? 'all SHA-256 hashes match' : 'FAILED'}.`);
console.log(`Editorial warnings: ${result.report.warnings.length}.`);
