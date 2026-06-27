import { TraceStorage, TraceEntry } from '../types';

export interface FailureGroup {
  tool: string;
  error: string;
  frequency: number;
  affectedPrompts: string[];
}

export class FailureExplorer {
  private storage: TraceStorage;

  constructor(storage: TraceStorage) {
    this.storage = storage;
  }

  async analyzeFailures(runId?: string): Promise<FailureGroup[]> {
    const filters = runId ? { runId } : {};
    const allEntries = await this.storage.search(filters);
    const errorEntries = allEntries.filter(e => e.status === 'error' && e.error);

    const failureMap = new Map<string, FailureGroup>();

    for (const entry of errorEntries) {
      const key = `${entry.tool}|${entry.error}`;
      const existing = failureMap.get(key);

      if (existing) {
        existing.frequency++;
        if (!existing.affectedPrompts.includes(entry.promptId)) {
          existing.affectedPrompts.push(entry.promptId);
        }
      } else {
        failureMap.set(key, {
          tool: entry.tool,
          error: entry.error!,
          frequency: 1,
          affectedPrompts: [entry.promptId]
        });
      }
    }

    return Array.from(failureMap.values()).sort((a, b) => b.frequency - a.frequency);
  }
}
