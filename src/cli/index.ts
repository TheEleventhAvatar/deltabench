import { Command } from 'commander';
import { JsonlTraceStorage } from '../storage';
import { TraceRecorder } from '../recorder';
import { ReplayEngine } from '../replay';
import { TraceSearch } from '../analysis';
import { FailureExplorer } from '../analysis';
import { TimelineView } from '../visualization';
import { LiveBenchmarkRunner, LiveBenchmarkResult } from '../runner';
import { ArtifactExporter } from '../export';
import * as fs from 'fs/promises';
import * as path from 'path';

export const program = new Command();

program
  .name('delta-bench')
  .description('Delta MCP benchmark runner and trace analysis tool')
  .version('1.0.0');

// List all runs
program
  .command('list')
  .description('List all benchmark runs')
  .action(async () => {
    const storage = new JsonlTraceStorage();
    const runs = await storage.listRuns();
    console.log('Available runs:');
    runs.forEach(run => console.log(`  - ${run}`));
  });

// Replay a run
program
  .command('replay <runId>')
  .description('Replay a benchmark run')
  .option('-s, --step <step>', 'Replay a specific step')
  .option('--json', 'Output as JSON')
  .option('--markdown', 'Output as Markdown')
  .action(async (runId, options) => {
    const storage = new JsonlTraceStorage();
    const replayEngine = new ReplayEngine(storage);
    const step = options.step ? parseInt(options.step) : undefined;
    const format = options.json ? 'json' : options.markdown ? 'markdown' : 'text';
    const result = await replayEngine.replay(runId, step, format);
    console.log(result.content);
  });

// Search traces
program
  .command('trace')
  .description('Search traces')
  .command('search')
  .description('Search traces with filters')
  .option('--tool <tool>', 'Filter by tool name')
  .option('--status <status>', 'Filter by status')
  .option('--prompt-id <promptId>', 'Filter by prompt ID')
  .option('--run-id <runId>', 'Filter by run ID')
  .option('--min-duration <ms>', 'Minimum duration')
  .option('--max-duration <ms>', 'Maximum duration')
  .action(async (options) => {
    const storage = new JsonlTraceStorage();
    const traceSearch = new TraceSearch(storage);
    const filters: any = {};
    if (options.tool) filters.tool = options.tool;
    if (options.status) filters.status = options.status;
    if (options.promptId) filters.promptId = options.promptId;
    if (options.runId) filters.runId = options.runId;
    if (options.minDuration) filters.minDuration = parseInt(options.minDuration);
    if (options.maxDuration) filters.maxDuration = parseInt(options.maxDuration);

    const entries = await traceSearch.search(filters);
    console.log(`Found ${entries.length} entries:`);
    entries.forEach(entry => {
      console.log(`  [${entry.runId}] Step ${entry.step}: ${entry.tool} (${entry.status})`);
    });
  });

// View failures
program
  .command('failures')
  .description('View failure analysis')
  .option('--run-id <runId>', 'Filter by run ID')
  .action(async (options) => {
    const storage = new JsonlTraceStorage();
    const failureExplorer = new FailureExplorer(storage);
    const failures = await failureExplorer.analyzeFailures(options.runId);

    console.log('Failure Analysis:');
    console.log('==================');
    failures.forEach(failure => {
      console.log(`\nTool: ${failure.tool}`);
      console.log(`Error: ${failure.error}`);
      console.log(`Frequency: ${failure.frequency}`);
      console.log(`Affected Prompts: ${failure.affectedPrompts.join(', ')}`);
    });
  });

// Timeline view
program
  .command('timeline <runId>')
  .description('View execution timeline')
  .option('--json', 'Output as JSON')
  .action(async (runId, options) => {
    const storage = new JsonlTraceStorage();
    const timelineView = new TimelineView(storage);
    const format = options.json ? 'json' : 'text';
    const timeline = await timelineView.generateTimeline(runId, format);
    console.log(timeline);
  });

// Run benchmark
program
  .command('run')
  .description('Run benchmark against live Delta MCP')
  .option('--prompt-id <promptId>', 'Run a specific prompt ID (e.g., 001)')
  .option('--intents <path>', 'Path to intents file (default: intents.md)')
  .option('--mcp-url <url>', 'MCP server URL')
  .option('--mcp-token <token>', 'MCP auth token')
  .option('--limit <n>', 'Limit number of prompts to run')
  .option('--all', 'Run ALL 100 prompts from intents file')
  .action(async (options) => {
    const storage = new JsonlTraceStorage();
    const recorder = new TraceRecorder(storage);
    const exporter = new ArtifactExporter();

    const mcpConfig = {
      serverUrl: options.mcpUrl || 'https://delta-mandate-mcp.repyhlabs.dev/mcp',
      authToken: options.mcpToken || '4888ca72af18978bc5f84258914c104e6990b8b5544f4ec6fee4db3f2fe795b3',
    };

    const runner = new LiveBenchmarkRunner(recorder, mcpConfig);

    if (options.promptId) {
      // Run single prompt
      const promptText = getPromptText(options.promptId);
      if (!promptText) {
        console.error(`Prompt ID ${options.promptId} not found in intents. Check intents.md.`);
        // Try loading from intents file
        const intents = await parseIntentsFile(options.intents || 'intents.md');
        const intent = intents.find(i => i.id === options.promptId);
        if (!intent) {
          console.error('Could not find prompt text. Provide --intents path to intents file.');
          process.exit(1);
        }
        return runSinglePrompt(runner, storage, exporter, intent, mcpConfig);
      }

      await runSinglePrompt(runner, storage, exporter, {
        id: options.promptId,
        text: promptText,
      }, mcpConfig);
    } else if (options.all) {
      // Run all prompts from intents.md
      const intentsPath = options.intents || 'intents.md';
      console.log(`Loading intents from ${intentsPath}...`);
      const intents = await parseIntentsFile(intentsPath);

      if (intents.length === 0) {
        console.error('No intents found. Check the intents file path.');
        process.exit(1);
      }

      console.log(`Loaded ${intents.length} intents.\n`);

      const limit = options.limit ? parseInt(options.limit) : intents.length;
      const toRun = intents.slice(0, limit);

      console.log(`Running ${toRun.length} benchmarks against live Delta MCP...\n`);

      const results: LiveBenchmarkResult[] = [];
      const startTime = Date.now();
      let passCount = 0;
      let failCount = 0;
      let errorCount = 0;

      for (let i = 0; i < toRun.length; i++) {
        const intent = toRun[i];
        const progress = `[${i + 1}/${toRun.length}]`;

        console.log(`${progress} Running prompt ${intent.id}: ${intent.text.substring(0, 60)}...`);

        const result = await runner.executeBenchmark({
          runId: `run-${intent.id}-${Date.now()}`,
          promptId: intent.id,
          promptText: intent.text,
          mcpConfig,
        });

        results.push(result);

        // Export artifacts
        try {
          const trace = await storage.read(result.runId);
          await exporter.export(result.runId, intent.id, intent.text, trace);
        } catch (e) {
          console.error(`  Export failed for ${intent.id}:`, (e as Error).message);
        }

        if (result.error) {
          errorCount++;
          console.log(`  [ERROR] ${result.error}`);
        } else if (result.verdict === 'pass' || result.verdict === 'pass_with_warnings') {
          passCount++;
          console.log(`  [PASS] Verdict: ${result.verdict}`);
        } else {
          failCount++;
          console.log(`  [FAIL] Verdict: ${result.verdict || 'unknown'}`);
        }

        // Small delay between prompts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n================================================================`);
      console.log(`Benchmark Complete!`);
      console.log(`Total: ${results.length} | Pass: ${passCount} | Fail: ${failCount} | Error: ${errorCount}`);
      console.log(`Time: ${totalTime}s`);
      console.log(`================================================================`);

      // Save summary
      const summaryPath = path.join('results', 'benchmark-summary.json');
      const summary = {
        timestamp: new Date().toISOString(),
        total: results.length,
        pass: passCount,
        fail: failCount,
        error: errorCount,
        timeSeconds: parseFloat(totalTime),
        results: results.map(r => ({
          promptId: r.promptId,
          verdict: r.verdict || 'error',
          error: r.error || null,
          steps: r.steps.length,
        })),
      };
      await fs.mkdir(path.join('results'), { recursive: true });
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
      console.log(`Summary saved to ${summaryPath}`);
    } else {
      console.log('Usage:');
      console.log('  delta-bench run --prompt-id 001          Run a single prompt');
      console.log('  delta-bench run --all                    Run ALL 100 prompts');
      console.log('  delta-bench run --all --limit 5          Run first 5 prompts');
      console.log('  delta-bench run --all --mcp-token <token>');
      console.log('  delta-bench run --all --intents path/to/intents.md');
    }
  });

/**
 * Run a single prompt.
 */
async function runSinglePrompt(
  runner: LiveBenchmarkRunner,
  storage: JsonlTraceStorage,
  exporter: ArtifactExporter,
  intent: { id: string; text: string },
  mcpConfig: { serverUrl: string; authToken: string }
): Promise<void> {
  const runId = `run-${intent.id}-${Date.now()}`;
  console.log(`Running prompt ${intent.id}: ${intent.text}`);

  const result = await runner.executeBenchmark({
    runId,
    promptId: intent.id,
    promptText: intent.text,
    mcpConfig,
  });

  const trace = await storage.read(runId);
  await exporter.export(runId, intent.id, intent.text, trace);

  console.log(`\nBenchmark completed: ${runId}`);
  console.log(`Steps: ${result.steps.length}`);
  if (result.verdict) {
    console.log(`Verdict: ${result.verdict}`);
  }
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
}

/**
 * Parse intents from an intents.md file.
 * Format: | ID | Intent |
 */
async function parseIntentsFile(filePath: string): Promise<Array<{ id: string; text: string }>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const intents: Array<{ id: string; text: string }> = [];
    const lines = content.split('\n');

    let inTable = false;
    for (const line of lines) {
      // Detect table start
      if (line.includes('| ID | Intent |')) {
        inTable = true;
        continue;
      }
      // Skip separator line
      if (inTable && line.includes('|---|---|')) continue;
      // Detect table end (blank line or next section)
      if (inTable && (line.trim() === '' || line.startsWith('##') || line.startsWith('#'))) {
        inTable = false;
        continue;
      }
      if (inTable) {
        const match = line.match(/\|\s*(\d+)\s*\|\s*(.+?)\s*\|/);
        if (match) {
          intents.push({
            id: match[1],
            text: match[2].trim(),
          });
        }
      }
    }

    return intents;
  } catch (error) {
    console.error(`Failed to parse intents file: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Get prompt text for known prompt IDs.
 */
function getPromptText(promptId: string): string | null {
  const known: Record<string, string> = {
    '001': 'White cotton t-shirt, size M',
    '002': 'Black leather wallet, under $50',
    '003': 'Blue denim jeans, size 32, straight-leg fit',
    '004': 'Stainless steel water bottle, vacuum-insulated',
    '005': 'Bamboo cutting board, under $30',
    '006': 'Red ceramic mug, non-insulated',
    '007': 'Black wireless mouse, under $40',
    '008': 'Cotton tote bag, open top',
    '009': 'Green terry bath towel, solid pattern, under $20',
    '010': 'White athletic socks for running, size large, moisture-wicking',
    '011': 'Black beanie, acrylic, one size',
    '012': 'White ceramic decorative bowl, round shape',
    '013': 'Brown leather gloves, size M',
    '014': 'Grey waterproof laptop backpack',
    '015': 'Blue moisture-wicking shorts, size M',
    '016': 'Wooden picture frame, 5x7 inch',
    '017': 'Black silicone battery phone case with USB type-C charging',
    '018': 'Green enamel pin, under $10',
    '019': 'White cotton bandana, large size, solid pattern',
    '020': 'Stainless steel keychain, under $10',
  };

  // Return the last 3 digits as fallback for IDs beyond 020
  return known[promptId] || null;
}