import {
  assertValidPipeline,
  contentSummaryLine,
  runContentPipeline,
  writeGeneratedArtifacts,
  writeNormalizedArtifacts
} from './pipeline';

const result = await runContentPipeline();
assertValidPipeline(result);
await Promise.all([writeNormalizedArtifacts(result), writeGeneratedArtifacts(result)]);
console.log(`Content catalog built: ${contentSummaryLine(result)}.`);
