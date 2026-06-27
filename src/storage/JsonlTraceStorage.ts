import * as fs from 'fs/promises';
import * as path from 'path';
import { TraceStorage, TraceEntry, TraceSearchFilters } from '../types';

export class JsonlTraceStorage implements TraceStorage {
  private tracesDir: string;

  constructor(tracesDir: string = 'results/traces') {
    this.tracesDir = tracesDir;
  }

  async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tracesDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  async append(entry: TraceEntry): Promise<void> {
    await this.ensureDirectory();
    const filePath = path.join(this.tracesDir, `${entry.runId}.jsonl`);
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(filePath, line, 'utf-8');
  }

  async read(runId: string): Promise<TraceEntry[]> {
    const filePath = path.join(this.tracesDir, `${runId}.jsonl`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      return [];
    }
  }

  async listRuns(): Promise<string[]> {
    await this.ensureDirectory();
    try {
      const files = await fs.readdir(this.tracesDir);
      return files
        .filter(f => f.endsWith('.jsonl'))
        .map(f => f.replace('.jsonl', ''));
    } catch (error) {
      return [];
    }
  }

  async search(filters: TraceSearchFilters): Promise<TraceEntry[]> {
    const runIds = filters.runId ? [filters.runId] : await this.listRuns();
    const allEntries: TraceEntry[] = [];

    for (const runId of runIds) {
      const entries = await this.read(runId);
      allEntries.push(...entries);
    }

    return allEntries.filter(entry => {
      if (filters.tool && entry.tool !== filters.tool) return false;
      if (filters.status && entry.status !== filters.status) return false;
      if (filters.promptId && entry.promptId !== filters.promptId) return false;
      if (filters.minDuration && entry.duration < filters.minDuration) return false;
      if (filters.maxDuration && entry.duration > filters.maxDuration) return false;
      return true;
    });
  }
}
