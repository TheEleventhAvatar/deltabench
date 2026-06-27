import * as fs from 'fs/promises';
import * as path from 'path';
import { TraceEntry, Metrics, ArtifactPackage } from '../types';

export class ArtifactExporter {
  private artifactsDir: string;

  constructor(artifactsDir: string = 'results/artifacts') {
    this.artifactsDir = artifactsDir;
  }

  async ensureDirectory(runId: string): Promise<string> {
    const runDir = path.join(this.artifactsDir, runId);
    await fs.mkdir(runDir, { recursive: true });
    return runDir;
  }

  computeMetrics(trace: TraceEntry[]): Metrics {
    const totalSteps = trace.length;
    const totalDuration = trace.reduce((sum, entry) => sum + entry.duration, 0);
    const successCount = trace.filter(e => e.status === 'success').length;
    const errorCount = trace.filter(e => e.status === 'error').length;
    const timeoutCount = trace.filter(e => e.status === 'timeout').length;
    const averageDuration = totalSteps > 0 ? totalDuration / totalSteps : 0;

    return {
      totalSteps,
      totalDuration,
      successCount,
      errorCount,
      timeoutCount,
      averageDuration
    };
  }

  generateReport(trace: TraceEntry[], metrics: Metrics): string {
    let report = '# Execution Report\n\n';
    report += `## Metrics\n\n`;
    report += `- Total Steps: ${metrics.totalSteps}\n`;
    report += `- Total Duration: ${metrics.totalDuration}ms\n`;
    report += `- Success Count: ${metrics.successCount}\n`;
    report += `- Error Count: ${metrics.errorCount}\n`;
    report += `- Timeout Count: ${metrics.timeoutCount}\n`;
    report += `- Average Duration: ${metrics.averageDuration.toFixed(2)}ms\n\n`;
    
    report += `## Execution Trace\n\n`;
    for (const entry of trace) {
      report += `### Step ${entry.step}: ${entry.tool}\n`;
      report += `- Status: ${entry.status}\n`;
      report += `- Duration: ${entry.duration}ms\n`;
      report += `- Timestamp: ${entry.timestamp}\n`;
      if (entry.error) {
        report += `- Error: ${entry.error}\n`;
      }
      report += '\n';
    }

    return report;
  }

  async export(
    runId: string,
    promptId: string,
    promptText: string,
    trace: TraceEntry[]
  ): Promise<string> {
    const runDir = await this.ensureDirectory(runId);
    const metrics = this.computeMetrics(trace);
    const report = this.generateReport(trace, metrics);

    const artifact: ArtifactPackage = {
      prompt: { id: promptId, text: promptText },
      trace,
      metrics,
      report
    };

    await fs.writeFile(
      path.join(runDir, 'prompt.json'),
      JSON.stringify(artifact.prompt, null, 2),
      'utf-8'
    );

    await fs.writeFile(
      path.join(runDir, 'trace.json'),
      JSON.stringify(artifact.trace, null, 2),
      'utf-8'
    );

    await fs.writeFile(
      path.join(runDir, 'metrics.json'),
      JSON.stringify(artifact.metrics, null, 2),
      'utf-8'
    );

    await fs.writeFile(
      path.join(runDir, 'report.md'),
      artifact.report,
      'utf-8'
    );

    return runDir;
  }
}
