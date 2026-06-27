# DeltaBench - Replay & Execution Trace Subsystem

Production-quality immutable execution trace system for Delta MCP benchmarks. Every benchmark execution becomes reproducible through complete trace recording and replay.

## Core Principle

**NEVER fabricate or infer execution data.** This system only records what was actually returned by the Delta MCP. If the MCP does not expose a piece of information, it is recorded as `null` or "unavailable".

## Architecture

```
src/
├── types/           # Core type definitions
├── recorder/        # TraceRecorder interface and implementation
├── storage/         # JSONL-based trace storage
├── export/          # Artifact package exporter
├── replay/          # Replay engine for trace reconstruction
├── analysis/        # Trace search and failure analysis
├── visualization/   # Timeline visualization
├── runner/          # Benchmark runner with tracing integration
├── cli/             # Command-line interface
└── index.ts         # Main entry point
```

## Features

### 1. Trace Recording

Every MCP interaction is recorded with:
- Timestamp
- Duration
- MCP tool name
- Request payload (actual data only)
- Response payload (actual data only)
- Status (success/error/timeout)
- Error message (if any)

Supported stages:
- `taxonomy_search`
- `submit_policy`
- `submit_proposal`
- `get_outcome`

### 2. JSONL Storage

Traces stored as JSONL files in `results/traces/`:

```
results/
    traces/
        run-001.jsonl
        run-002.jsonl
```

Each line is a JSON object:
```json
{
  "runId": "run-001",
  "promptId": "001",
  "step": 1,
  "tool": "taxonomy_search",
  "request": {...},
  "response": {...},
  "duration": 81,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "success",
  "error": null
}
```

### 3. Artifact Packages

Every benchmark run automatically exports to `results/artifacts/<run-id>/`:

- `prompt.json` - Original prompt text
- `trace.jsonl` - Complete execution trace
- `metrics.json` - Computed metrics from trace data
- `report.md` - Generated execution report

### 4. Replay

Reconstruct execution chronologically from saved traces:

```bash
delta-bench replay <run-id>
```

Example output:
```
Prompt
↓
taxonomy_search
██████ 81ms
↓
submit_policy
██████████ 132ms
↓
submit_proposal
███ 45ms
↓
get_outcome
████ 62ms
↓
Finished
```

### 5. Step Replay

Inspect a single stage:

```bash
delta-bench replay <run-id> --step 2
```

### 6. Trace Search

Search traces with filters:

```bash
delta-bench trace search --tool taxonomy_search --status error
```

Available filters:
- `--tool` - Filter by MCP tool name
- `--status` - Filter by execution status
- `--prompt-id` - Filter by prompt ID
- `--run-id` - Filter by run ID
- `--min-duration` - Filter by minimum duration
- `--max-duration` - Filter by maximum duration

### 7. Failure Explorer

List every MCP error grouped by tool:

```bash
delta-bench failures
```

Shows:
- Frequency
- Error message
- Affected prompts

### 8. Timeline View

Visual timeline of execution:

```bash
delta-bench timeline <run-id>
```

Output:
```
taxonomy_search
██████ 81ms

submit_policy
██████████ 132ms

submit_proposal
███ 45ms

get_outcome
████ 62ms
```

### 9. Export Formats

Support for JSON and Markdown output:

```bash
delta-bench replay <run-id> --json
delta-bench replay <run-id> --markdown
```

## Installation

```bash
npm install
npm run build
```

## Usage

### Programmatic API

```typescript
import { 
  FileTraceRecorder, 
  JsonlTraceStorage, 
  BenchmarkRunner,
  ReplayEngine,
  TraceSearch,
  FailureExplorer,
  TimelineView
} from 'delta-bench';

// Create recorder
const storage = new JsonlTraceStorage();
const recorder = new FileTraceRecorder(storage);

// Run benchmark
const runner = new BenchmarkRunner(recorder);
await runner.executeBenchmark({
  runId: 'run-001',
  promptId: '001',
  promptText: 'White cotton t-shirt, size M'
});

// Replay execution
const replayEngine = new ReplayEngine(storage);
const result = await replayEngine.replay('run-001');
console.log(result.content);

// Search traces
const traceSearch = new TraceSearch(storage);
const entries = await traceSearch.search({ tool: 'taxonomy_search' });

// Analyze failures
const failureExplorer = new FailureExplorer(storage);
const failures = await failureExplorer.analyzeFailures();

// View timeline
const timelineView = new TimelineView(storage);
const timeline = await timelineView.generateTimeline('run-001');
```

### CLI Commands

```bash
# List all runs
delta-bench list

# Replay a run
delta-bench replay run-001

# Replay a specific step
delta-bench replay run-001 --step 2

# Replay as JSON
delta-bench replay run-001 --json

# Search traces
delta-bench trace search --tool taxonomy_search --status error

# View failures
delta-bench failures

# View failures for a specific run
delta-bench failures --run-id run-001

# View timeline
delta-bench timeline run-001

# View timeline as JSON
delta-bench timeline run-001 --json
```

## Integration with Benchmark Runner

### Live MCP Integration

The `LiveBenchmarkRunner` class executes prompts against the real Delta MCP and records actual execution traces:

```typescript
import { LiveBenchmarkRunner, FileTraceRecorder, JsonlTraceStorage } from 'delta-bench';

const storage = new JsonlTraceStorage();
const recorder = new FileTraceRecorder(storage);
const runner = new LiveBenchmarkRunner(recorder, {
  serverUrl: 'https://delta-mandate-mcp.repyhlabs.dev/mcp',
  authToken: 'your-auth-token'
});

await runner.executeBenchmark({
  runId: 'run-001',
  promptId: '001',
  promptText: 'White cotton t-shirt, size M',
  mcpConfig: {
    serverUrl: 'https://delta-mandate-mcp.repyhlabs.dev/mcp',
    authToken: 'your-auth-token'
  }
});
```

The live runner executes the complete flow:
1. Get language guide for policy context
2. Search taxonomy for product category
3. Generate policy based on prompt and taxonomy
4. Search for product (requires Shopify UCP CLI integration)
5. Submit proposal with found product
6. Retrieve outcome

**Critical Rule**: Only record what the MCP actually returns. No fabrication, inference, or simulation.

### CLI: Run Live Benchmarks

Run all prompts from intents.md through live Delta MCP:

```bash
delta-bench run --mcp-token <your-token>
```

Run a specific prompt:

```bash
delta-bench run --prompt-id 001 --mcp-token <your-token>
```

Custom MCP server URL:

```bash
delta-bench run --mcp-url https://your-server.com/mcp --mcp-token <your-token>
```

Custom intents file:

```bash
delta-bench run --intents path/to/intents.md --mcp-token <your-token>
```

### Template Runner

The `BenchmarkRunner` class provides a template for custom integration:

```typescript
import { BenchmarkRunner, FileTraceRecorder, JsonlTraceStorage } from 'delta-bench';

const storage = new JsonlTraceStorage();
const recorder = new FileTraceRecorder(storage);
const runner = new BenchmarkRunner(recorder);

await runner.executeBenchmark({
  runId: 'run-001',
  promptId: '001',
  promptText: 'Your prompt here'
});
```

The `BenchmarkRunner.executeMCPTool()` method is a template that should be replaced with your actual MCP execution logic.

## Strict Data Rules

1. **No fabrication**: Never invent data that wasn't returned by the MCP
2. **No inference**: Never deduce or estimate values
3. **No simulation**: Never mock or simulate MCP responses
4. **Null for missing**: If the MCP doesn't provide data, record as `null`
5. **Unavailable messages**: Display "Unavailable from current MCP API" when data is missing

## Trace Model

```typescript
interface TraceEntry {
  runId: string;
  promptId: string;
  step: number;
  tool: string;
  request: unknown;
  response: unknown;
  duration: number;
  timestamp: string;
  status: 'success' | 'error' | 'timeout';
  error: string | null;
}
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Run CLI
npm start
```

## License

MIT
