import { MCPConfig } from '../types';
import * as https from 'https';
import * as http from 'http';

// ── Result interfaces ──────────────────────────────────────────────

export interface TaxonomyResult {
  /** Extracted category (best-effort from text response) */
  category?: string;
  /** Extracted path (best-effort from text response) */
  path?: string;
  /** Raw response text from MCP server */
  raw: string;
}

export interface PolicyResult {
  /** Content-addressed policy ID returned by submit_policy */
  policy_id: string;
  /** Original policy source that was submitted */
  source: string;
  /** Raw response text from MCP server */
  raw: string;
}

export interface ProposalResult {
  /** Intent ID returned after signing + proposal submission */
  intent_id: string;
  /** Raw response text from MCP server */
  raw: string;
}

export interface OutcomeResult {
  /** Verdict tag: "pass", "fail", "pass_with_warnings", etc. */
  verdict_tag: string;
  /** Reason text from the outcome */
  reason: string;
  /** Evidence object returned by orchestrator */
  evidence: Record<string, unknown>;
  /** List of constraint failures */
  constraint_failures: Array<Record<string, unknown>>;
  /** Orchestrator status if present */
  status?: string;
  /** Raw response text from MCP server */
  raw: string;
}

// ── JSON-RPC types ─────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: 'tools/call';
  params: { name: string; arguments: Record<string, unknown> };
  id: number;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    [key: string]: unknown;
  };
  error?: { code: number; message: string; data?: unknown };
}

// ── Regex-based parsers (tested against real server output) ────────

/**
 * Extract a content-addressed policy ID from submit_policy response text.
 * Real format: "Policy is valid. Policy ID: Dza9GPByzZwJuJAJc7..."
 */
function extractPolicyId(text: string): string {
  const patterns = [
    /Policy\s+ID:\s*(\S+)/i,
    /policy[_-]?id[:\s]+(\S+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return '';
}

/**
 * Extract an intent_id from submit_proposal response text.
 */
function extractIntentId(text: string): string {
  // Real server responds with: "submit_proposal failed … for intent <UUID>:"
  // or "Intent <UUID> submitted successfully".
  const patterns = [
    /for\s+intent\s+([a-f0-9-]{36})/i,
    /intent[_-]?id[:\s]+(\S+)/i,
    /intent\s+(\S+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return '';
}

/**
 * Extract a verdict tag from get_outcome response text.
 */
function extractVerdict(text: string): string {
  const patterns = [
    /verdict[_\s]?tag[:\s]+(\S+)/i,
    /verdict[:\s]+(\S+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].replace(/[,;]/g, '');
  }
  return '';
}

// ── Client ─────────────────────────────────────────────────────────

export class DeltaMCPClient {
  private config: MCPConfig;
  private nextId = 1;

  constructor(config: MCPConfig) {
    this.config = config;
  }

  /**
   * Make a JSON-RPC `tools/call` request over HTTPS.
   *
   * The server returns `application/json` (not SSE).  Parses the
   * standard MCP `content` array extracting `.text` items.
   * JSON-RPC `error` responses are thrown.
   */
  private async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: toolName, arguments: args },
      id: this.nextId++,
    };

    const payload = JSON.stringify(request);
    const url = new URL(this.config.serverUrl);
    const isHttps = url.protocol === 'https:';

    return new Promise<string>((resolve, reject) => {
      const reqOpts = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        timeout: 60_000,
        headers: {
          Authorization: `Bearer ${this.config.authToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
      };

      const transport = isHttps ? https : http;
      const req = transport.request(reqOpts, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          let response: JsonRpcResponse;
          try {
            response = JSON.parse(body);
          } catch {
            reject(new Error(`MCP returned non-JSON body (${res.statusCode})`));
            return;
          }

          if (response.error) {
            reject(new Error(`MCP ${response.error.code}: ${response.error.message}`));
            return;
          }

          // Standard MCP content array
          if (response.result?.content && Array.isArray(response.result.content)) {
            const text = response.result.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('\n');
            resolve(text);
          } else {
            // Fallback: stringify whatever result object we got
            resolve(JSON.stringify(response.result ?? {}));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('MCP request timed out (60s)')); });
      req.write(payload);
      req.end();
    });
  }

  // ── Public methods ──────────────────────────────────────────────

  async getLanguageGuide(): Promise<string> {
    return this.callTool('get_language_guide', {});
  }

  async searchTaxonomy(query?: string): Promise<TaxonomyResult> {
    const args: Record<string, unknown> = {};
    if (query) args.query = query;
    const raw = await this.callTool('search_taxonomy', args);

    // Best-effort category extraction from prose response
    const catMatch = raw.match(/^##\s+(.+?)\s+\(/m);
    return {
      raw,
      category: catMatch ? catMatch[1].trim() : undefined,
    };
  }

  async submitPolicy(source: string): Promise<PolicyResult> {
    const raw = await this.callTool('submit_policy', { source });
    return {
      source,
      raw,
      policy_id: extractPolicyId(raw),
    };
  }

  async submitProposal(policyId: string, variantGid: string): Promise<ProposalResult> {
    const raw = await this.callTool('submit_proposal', {
      policy_id: policyId,
      variant_gid: variantGid,
    });
    return {
      raw,
      intent_id: extractIntentId(raw),
    };
  }

  async getOutcome(intentId: string): Promise<OutcomeResult> {
    const raw = await this.callTool('get_outcome', { intent_id: intentId });

    // Attempt structured JSON parse first; real server currently returns text
    const result: OutcomeResult = {
      verdict_tag: '',
      reason: raw.trim(),
      evidence: {},
      constraint_failures: [],
      raw,
    };

    try {
      const parsed = JSON.parse(raw);
      result.verdict_tag = parsed.verdict_tag ?? parsed.verdict ?? '';
      result.reason = parsed.reason ?? parsed.message ?? raw;
      result.evidence = parsed.evidence ?? {};
      result.constraint_failures = parsed.constraint_failures ?? parsed.failures ?? [];
      result.status = parsed.status;
    } catch {
      // Not JSON — use regex-based extraction
      result.verdict_tag = extractVerdict(raw);
    }

    return result;
  }
}