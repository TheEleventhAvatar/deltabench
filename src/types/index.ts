export type ExecutionStatus = 'success' | 'error' | 'timeout';

export interface TraceEntry {
  runId: string;
  promptId: string;
  step: number;
  tool: string;
  request: unknown;
  response: unknown;
  duration: number;
  timestamp: string;
  status: ExecutionStatus;
  error: string | null;
}

export interface BenchmarkConfig {
  runId: string;
  promptId: string;
  promptText: string;
  mcpConfig?: {
    serverUrl: string;
    authToken: string;
  };
}

export interface MCPConfig {
  serverUrl: string;
  authToken: string;
}

export interface TraceStorage {
  append(entry: TraceEntry): Promise<void>;
  read(runId: string): Promise<TraceEntry[]>;
  listRuns(): Promise<string[]>;
  search(filters: TraceSearchFilters): Promise<TraceEntry[]>;
}

export interface TraceRecorder {
  record(entry: TraceEntry): Promise<void>;
  startRun(runId: string, promptId: string, promptText: string): Promise<void>;
  endRun(runId: string): Promise<void>;
  getNextStep(): number;
  getCurrentRun(): string | null;
  getCurrentPromptId(): string | null;
}

export interface TraceSearchFilters {
  tool?: string;
  status?: ExecutionStatus;
  promptId?: string;
  runId?: string;
  minDuration?: number;
  maxDuration?: number;
}

export interface Metrics {
  totalSteps: number;
  totalDuration: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  averageDuration: number;
}

export interface ArtifactPackage {
  prompt: {
    id: string;
    text: string;
  };
  trace: TraceEntry[];
  metrics: Metrics;
  report: string;
}
