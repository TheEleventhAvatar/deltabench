import { TraceRecorder as ITraceRecorder, TraceEntry } from '../types';

export class TraceRecorder implements ITraceRecorder {
  private storage: any;
  private currentRun: string | null = null;
  private currentPromptId: string | null = null;
  private stepCounter: number = 0;

  constructor(storage: any) {
    this.storage = storage;
  }

  async record(entry: TraceEntry): Promise<void> {
    await this.storage.append(entry);
  }

  async startRun(runId: string, promptId: string, promptText: string): Promise<void> {
    this.currentRun = runId;
    this.currentPromptId = promptId;
    this.stepCounter = 0;
  }

  async endRun(runId: string): Promise<void> {
    this.currentRun = null;
    this.currentPromptId = null;
    this.stepCounter = 0;
  }

  getCurrentRun(): string | null {
    return this.currentRun;
  }

  getCurrentPromptId(): string | null {
    return this.currentPromptId;
  }

  getNextStep(): number {
    return ++this.stepCounter;
  }
}
