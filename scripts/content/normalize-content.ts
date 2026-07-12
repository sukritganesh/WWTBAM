import { assertValidPipeline, contentSummaryLine, runContentPipeline, writeNormalizedArtifacts } from './pipeline';

const result = await runContentPipeline();
assertValidPipeline(result);
await writeNormalizedArtifacts(result);
console.log(`Normalized content written: ${contentSummaryLine(result)}.`);
