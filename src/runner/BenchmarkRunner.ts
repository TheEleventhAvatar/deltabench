import { TraceRecorder, BenchmarkConfig, TraceEntry, ExecutionStatus } from '../types';

export class BenchmarkRunner {
  protected recorder: TraceRecorder;

  constructor(recorder: TraceRecorder) {
    this.recorder = recorder;
  }

  async executeBenchmark(config: BenchmarkConfig): Promise<any> {
    await this.recorder.startRun(config.runId, config.promptId, config.promptText);
    
    try {
      // Template method - should be overridden by subclasses
      await this.executeMCPTool(config, 'taxonomy_search', {});
      await this.executeMCPTool(config, 'submit_policy', {});
      await this.executeMCPTool(config, 'submit_proposal', {});
      await this.executeMCPTool(config, 'get_outcome', {});
    } finally {
      await this.recorder.endRun(config.runId);
    }
  }

  protected async executeMCPTool(
    config: BenchmarkConfig,
    toolName: string,
    request: any,
    _callFn?: () => Promise<any>
  ): Promise<any> {
    const startTime = Date.now();
    const step = this.recorder.getNextStep();
    const runId = this.recorder.getCurrentRun()!;
    const promptId = this.recorder.getCurrentPromptId()!;

    let response: any;
    let status: ExecutionStatus = 'success';
    let error: string | null = null;

    try {
      // This is a template - subclasses should override with actual MCP calls
      response = { message: 'Template execution - override this method' };
    } catch (e) {
      status = 'error';
      error = e instanceof Error ? e.message : String(e);
      response = null;
    }

    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    const entry: TraceEntry = {
      runId,
      promptId,
      step,
      tool: toolName,
      request,
      response,
      duration,
      timestamp,
      status,
      error
    };

    await this.recorder.record(entry);
    return response;
  }
}
