import { TraceStorage, TraceEntry } from '../types';

export class TimelineView {
  private storage: TraceStorage;

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  async generateTimeline(runId: string, format: 'text' | 'json' = 'text'): Promise<string> {
    const trace = await this.storage.read(runId);
    
    if (format === 'json') {
      return JSON.stringify(trace.map(e => ({
        tool: e.tool,
        duration: e.duration,
        timestamp: e.timestamp,
        status: e.status
      })), null, 2);
    }

    let output = '';
    for (const entry of trace) {
      const bar = '█'.repeat(Math.min(Math.floor(entry.duration / 10), 20));
      output += `${entry.tool}\n${bar} ${entry.duration}ms\n\n`;
    }
    return output;
  }
}
