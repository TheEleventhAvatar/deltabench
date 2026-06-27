import { BenchmarkRunner } from './BenchmarkRunner';
import { BenchmarkConfig, MCPConfig, TraceEntry } from '../types';
import { DeltaMCPClient } from '../mcp/DeltaMCPClient';
import { ShopifyUCPClient } from '../mcp/ShopifyUCPClient';

export interface LiveBenchmarkResult {
  runId: string;
  promptId: string;
  promptText: string;
  steps: TraceEntry[];
  verdict?: string;
  error?: string;
}

export class LiveBenchmarkRunner extends BenchmarkRunner {
  private mcpConfig: MCPConfig;
  private deltaClient: DeltaMCPClient;
  private ucpClient: ShopifyUCPClient;

  constructor(recorder: any, mcpConfig: MCPConfig) {
    super(recorder);
    this.mcpConfig = mcpConfig;
    this.deltaClient = new DeltaMCPClient(mcpConfig);
    this.ucpClient = new ShopifyUCPClient();
  }

  async executeBenchmark(config: BenchmarkConfig): Promise<LiveBenchmarkResult> {
    await this.recorder.startRun(config.runId, config.promptId, config.promptText);

    const steps: TraceEntry[] = [];
    let verdict: string | undefined;
    let runError: string | undefined;

    try {
      // Step 1: Get language guide
      const languageGuide = await this.executeMCPTool(
        config, 'get_language_guide', {},
        () => this.deltaClient.getLanguageGuide()
      );
      steps.push(this.lastEntry!);

      // Step 2: Search taxonomy (extract category from prompt)
      const category = await this.extractCategory(config.promptText);
      const taxonomyResult = await this.executeMCPTool(
        config, 'search_taxonomy', { query: category },
        () => this.deltaClient.searchTaxonomy(category)
      );
      steps.push(this.lastEntry!);

      // Step 3: Generate and submit policy
      const policySource = await this.generatePolicy(config.promptText, taxonomyResult);
      const policyResult = await this.executeMCPTool(
        config, 'submit_policy', { source: policySource },
        () => this.deltaClient.submitPolicy(policySource)
      );
      steps.push(this.lastEntry!);

      // Step 4: Search for product using Shopify UCP CLI
      const productResult = await this.executeMCPTool(
        config, 'search_product', { query: config.promptText },
        async () => {
          const result = await this.ucpClient.searchProduct(config.promptText);
          return result ? JSON.stringify(result) : JSON.stringify({ error: 'No product found' });
        }
      );
      steps.push(this.lastEntry!);

      const productGid = await this.searchProduct(config.promptText);

      if (productGid && policyResult.policy_id) {
        // Step 5: Submit proposal
        const proposalResult = await this.executeMCPTool(
          config, 'submit_proposal',
          { policy_id: policyResult.policy_id, variant_gid: productGid },
          () => this.deltaClient.submitProposal(policyResult.policy_id, productGid)
        );
        steps.push(this.lastEntry!);

        // Step 6: Get outcome
        const outcomeResult = await this.executeMCPTool(
          config, 'get_outcome',
          { intent_id: proposalResult.intent_id },
          () => this.deltaClient.getOutcome(proposalResult.intent_id)
        );
        steps.push(this.lastEntry!);

        // Extract verdict from the outcome result
        if (typeof outcomeResult === 'object' && outcomeResult !== null) {
          verdict = (outcomeResult as any).verdict_tag || (outcomeResult as any).verdict;
        }
      } else {
        runError = 'Could not find product via Shopify UCP CLI';
        console.warn(`[${config.promptId}] ${runError}: "${config.promptText}"`);
      }
    } catch (error) {
      runError = error instanceof Error ? error.message : String(error);
      console.error(`[${config.promptId}] Benchmark error: ${runError}`);
    } finally {
      await this.recorder.endRun(config.runId);
    }

    return {
      runId: config.runId,
      promptId: config.promptId,
      promptText: config.promptText,
      steps,
      verdict,
      error: runError,
    };
  }

  private lastEntry: TraceEntry | undefined;

  protected async executeMCPTool(
    config: BenchmarkConfig,
    toolName: string,
    request: any,
    callFn: () => Promise<any>
  ): Promise<any> {
    const startTime = Date.now();
    const step = this.recorder.getNextStep();
    const runId = this.recorder.getCurrentRun()!;
    const promptId = this.recorder.getCurrentPromptId()!;

    let response: any;
    let status: 'success' | 'error' | 'timeout' = 'success';
    let error: string | null = null;

    try {
      response = await callFn();
    } catch (e) {
      status = 'error';
      error = e instanceof Error ? e.message : String(e);
      response = { error };
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
      error,
    };

    this.lastEntry = entry;
    await this.recorder.record(entry);
    return response;
  }

  private async extractCategory(promptText: string): Promise<string> {
    // Use the last word or phrase as the category search term
    const words = promptText.toLowerCase().split(/[,\s]+/).filter(w => w.length > 2);

    // Common category keywords to look for in prompts
    const categoryKeywords = [
      't-shirt', 'wallet', 'jeans', 'bottle', 'board', 'mug', 'mouse',
      'bag', 'towel', 'socks', 'beanie', 'bowl', 'gloves', 'backpack',
      'shorts', 'frame', 'case', 'pin', 'bandana', 'keychain', 'sweatpants',
      'belt', 'planter', 'pillowcase', 'candle', 'duffel', 'notebook', 'tumbler',
      'blanket', 'headband', 'sweater', 'keyboard', 'sheets', 'coffee',
      'mat', 'french press', 'shirt', 'dripper', 'resistance', 'boots',
      'activewear', 'water', 'protein', 'towel', 'baking', 'card', 'joggers',
      'skillet', 'apron', 'utensil', 'lunch', 'laptop', 'belt', 'flannel',
      'pillow', 'candles', 'pot', 'shaker', 'loafers', 'hoodie', 'storage',
      'duffel', 'overcoat', 'pajamas', 'teapot', 'rug', 'messenger',
      'scraper', 'mechanical', 'sheets', 'sweater', 'messenger', 'coffee',
      'jacket', 'cookware', 'duvet', 'headphones', 'dutch oven',
      'tea', 'boots', 'sheets', 'bottle', 'rug', 'watch', 'towels',
      'cutting', 'wallet', 'maker', 'earbuds', 'tote', 'french', 't-shirt',
      'journal', 'throw', 'dinnerware', 'mixing', 'backpack', 'keyboard',
    ];

    // Find matching category keyword
    for (const keyword of categoryKeywords) {
      if (promptText.toLowerCase().includes(keyword.toLowerCase())) {
        return keyword;
      }
    }

    // Fallback: first meaningful word
    return words[0] || 'general';
  }

  private async generatePolicy(promptText: string, taxonomyResult: any): Promise<string> {
    // Build a policy based on the prompt text and taxonomy result
    const category = taxonomyResult.category || this.extractCategorySync(promptText);
    const path = taxonomyResult.path || taxonomyResult.raw || '';

    // Generate a basic policy from the prompt
    const lowerPrompt = promptText.toLowerCase();

    const constraints: string[] = [];

    // Extract material from prompt
    const materials = ['cotton', 'leather', 'stainless steel', 'bamboo', 'ceramic',
      'wool', 'nylon', 'glass', 'silicone', 'canvas', 'felt', 'linen', 'suede',
      'merino', 'hemp', 'cast iron', 'wood', 'flannel', 'beeswax', 'kraft',
      'synthetic', 'cowhide'];
    for (const material of materials) {
      if (lowerPrompt.includes(material)) {
        constraints.push(`  evidence.material == "${material}";`);
        break;
      }
    }

    // Extract color
    const colors = ['white', 'black', 'blue', 'red', 'green', 'brown', 'grey', 'gray',
      'navy', 'purple', 'beige', 'charcoal', 'silver', 'clear', 'multi-color', 'heather'];
    for (const color of colors) {
      if (lowerPrompt.includes(color)) {
        const mappedColor = color === 'gray' ? 'grey' : color;
        constraints.push(`  evidence.color == "${mappedColor}";`);
        break;
      }
    }

    // Extract size
    const sizes = ['s', 'm', 'l', 'xl', 'small', 'medium', 'large', 'queen', 'king',
      'standard', 'one size', 'unisex'];
    for (const size of sizes) {
      if (lowerPrompt.includes(' ' + size + ' ') || lowerPrompt.endsWith(' ' + size)) {
        constraints.push(`  evidence.size == "${size.toUpperCase()}";`);
        break;
      }
    }

    // Price constraint
    const underMatch = lowerPrompt.match(/under\s+\$(\d+)/);
    if (underMatch) {
      constraints.push(`  evidence.price.amount <= ${parseFloat(underMatch[1])};`);
      constraints.push(`  evidence.price.currency == "USD";`);
    }

    // If we couldn't extract any constraints, add a basic one
    if (constraints.length === 0) {
      constraints.push(`  evidence.category == "${category}";`);
    }

    // Category constraint always
    constraints.unshift(`  evidence.category == "${category}";`);

    const policy = `name purchase_policy

evidence {
  category: string,
  material: string,
  color: string,
  size: string,
  price: {
    amount: float,
    currency: string,
  },
}

requires {
${constraints.join('\n')}
}`;

    return policy;
  }

  private extractCategorySync(promptText: string): string {
    return this.extractCategory(promptText) as unknown as string || 'general';
  }

  private async searchProduct(promptText: string): Promise<string | null> {
    const result = await this.ucpClient.searchProduct(promptText);
    return result ? result.variantGid : null;
  }
}