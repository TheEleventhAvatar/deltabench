import { TraceStorage, TraceEntry } from '../types';

export interface ReplayResult {
  content: string;
  format: 'text' | 'json' | 'markdown';
}

export class ReplayEngine {
  private storage: TraceStorage;

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  async replay(runId: string, step?: number, format: 'text' | 'json' | 'markdown' = 'text'): Promise<ReplayResult> {
    const trace = await this.storage.read(runId);
    
    if (trace.length === 0) {
      return {
        content: `No trace found for run ${runId}`,
        format
      };
    }

    if (step !== undefined) {
      const stepEntry = trace.find(e => e.step === step);
      if (!stepEntry) {
        return {
          content: `Step ${step} not found in run ${runId}`,
          format
        };
      }
      return this.formatStep(stepEntry, format);
    }

    return this.formatFullTrace(trace, format);
  }

  private formatStep(entry: TraceEntry, format: 'text' | 'json' | 'markdown'): ReplayResult {
    if (format === 'json') {
      return {
        content: JSON.stringify(entry, null, 2),
        format: 'json'
      };
    }

    if (format === 'markdown') {
      return {
        content: `## Step ${entry.step}: ${entry.tool}\n\n` +
          `- **Status**: ${entry.status}\n` +
          `- **Duration**: ${entry.duration}ms\n` +
          `- **Timestamp**: ${entry.timestamp}\n` +
          (entry.error ? `- **Error**: ${entry.error}\n` : '') +
          `\n### Request\n\`\`\`json\n${JSON.stringify(entry.request, null, 2)}\n\`\`\`\n\n` +
          `### Response\n\`\`\`json\n${JSON.stringify(entry.response, null, 2)}\n\`\`\`\n`,
        format: 'markdown'
      };
    }

    return {
      content: `Step ${entry.step}: ${entry.tool}\n` +
        `Status: ${entry.status}\n` +
        `Duration: ${entry.duration}ms\n` +
        `Timestamp: ${entry.timestamp}\n` +
        (entry.error ? `Error: ${entry.error}\n` : ''),
      format: 'text'
    };
  }

  private formatFullTrace(trace: TraceEntry[], format: 'text' | 'json' | 'markdown'): ReplayResult {
    if (format === 'json') {
      return {
        content: JSON.stringify(trace, null, 2),
        format: 'json'
      };
    }

    if (format === 'markdown') {
      let content = '# Execution Replay\n\n';
      for (const entry of trace) {
        content += `## Step ${entry.step}: ${entry.tool}\n\n`;
        content += `- **Status**: ${entry.status}\n`;
        content += `- **Duration**: ${entry.duration}ms\n`;
        content += `- **Timestamp**: ${entry.timestamp}\n`;
        if (entry.error) {
          content += `- **Error**: ${entry.error}\n`;
        }
        content += '\n';
      }
      return { content, format: 'markdown' };
    }

    let content = 'Execution Replay\n';
    content += '='.repeat(50) + '\n\n';
    for (const entry of trace) {
      const bar = '█'.repeat(Math.min(Math.floor(entry.duration / 10), 20));
      content += `${entry.tool}\n${bar} ${entry.duration}ms\n\n`;
    }
    content += 'Finished\n';
    return { content, format: 'text' };
  }
}
