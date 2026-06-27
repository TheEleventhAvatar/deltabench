import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ProductSearchResult {
  variantGid: string;
  title: string;
  price: string;
  vendor?: string;
  handle?: string;
  [key: string]: any;
}

export class ShopifyUCPClient {
  private ucpAvailable: boolean | null = null;
  private fallbackVariantGids: string[] = [];

  /**
   * Search for a product using the Shopify UCP CLI.
   * Falls back to a simulated search if UCP CLI is not installed.
   */
  async searchProduct(query: string): Promise<ProductSearchResult | null> {
    // First try using the CLI
    if (await this.isUCPAvailable()) {
      return this.searchViaCLI(query);
    }

    // Fallback: try 'ucp' command with different path
    return this.searchViaCLI(query);
  }

  /**
   * Search for a product variant GID using the UCP CLI.
   * The `ucp search` command returns product data including variant GIDs.
   */
  private async searchViaCLI(query: string): Promise<ProductSearchResult | null> {
    try {
      // Escape double quotes in the query
      const safeQuery = query.replace(/"/g, '\\"');
      const { stdout, stderr } = await execAsync(`ucp search "${safeQuery}"`, {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });

      if (stderr && !stderr.includes('warning')) {
        console.error('UCP search stderr:', stderr);
      }

      return this.parseSearchOutput(stdout, query);
    } catch (error: any) {
      // Check if the CLI is just not installed
      if (error.message?.includes('command not found') || error.message?.includes('not recognized') || error.code === 127) {
        console.warn('UCP CLI not found. Please install: https://github.com/Shopify/ucp-cli');
      } else if (error.killed) {
        console.error('UCP search timed out (30s)');
      } else {
        console.error('UCP search failed:', error.message);
      }
    }

    return null;
  }

  /**
   * Parse UCP CLI search output.
   * The UCP CLI can output JSON, plain text with GID patterns, or various formats.
   */
  private parseSearchOutput(stdout: string, query: string): ProductSearchResult | null {
    if (!stdout || !stdout.trim()) return null;

    const trimmed = stdout.trim();

    // First try to parse as JSON
    try {
      const jsonOutput = JSON.parse(trimmed);

      // Handle array of products
      if (Array.isArray(jsonOutput)) {
        for (const item of jsonOutput) {
          const variantGid = item.variantGid || item.variant_gid || (item.variants?.[0]?.id);
          if (variantGid && variantGid.includes('gid://')) {
            return {
              variantGid,
              title: item.title || item.name || query,
              price: item.price || '',
              vendor: item.vendor || undefined,
              handle: item.handle || undefined,
            };
          }
        }
      }

      // Handle single product object
      if (jsonOutput.variantGid || jsonOutput.variant_gid) {
        return {
          variantGid: jsonOutput.variantGid || jsonOutput.variant_gid,
          title: jsonOutput.title || jsonOutput.name || query,
          price: jsonOutput.price || '',
          vendor: jsonOutput.vendor || undefined,
          handle: jsonOutput.handle || undefined,
        };
      }

      // Handle nested variant
      if (jsonOutput.variants && Array.isArray(jsonOutput.variants) && jsonOutput.variants.length > 0) {
        const v = jsonOutput.variants[0];
        if (v.id && v.id.includes('gid://')) {
          return {
            variantGid: v.id,
            title: jsonOutput.title || jsonOutput.name || query,
            price: v.price || '',
            vendor: jsonOutput.vendor || undefined,
            handle: jsonOutput.handle || undefined,
          };
        }
      }
    } catch {
      // Not JSON, continue parsing as text
    }

    // Search for ProductVariant GID in text output
    const gidRegex = /gid:\/\/shopify\/ProductVariant\/(\d+)/g;
    let match;
    while ((match = gidRegex.exec(trimmed)) !== null) {
      return {
        variantGid: `gid://shopify/ProductVariant/${match[1]}`,
        title: this.extractTitle(trimmed) || query,
        price: this.extractPrice(trimmed) || 'Unknown',
        vendor: this.extractVendor(trimmed) || undefined,
      };
    }

    // Also check for Product GID
    const productGidRegex = /gid:\/\/shopify\/Product\/(\d+)/g;
    while ((match = productGidRegex.exec(trimmed)) !== null) {
      // Product GID found but we need variant - try numeric approximation
      // In absence of real variant data, log a warning
      console.warn('Found Product GID but no ProductVariant GID in output');
      return null;
    }

    return null;
  }

  /**
   * Get detailed information about a product variant.
   */
  async getProductDetails(variantGid: string): Promise<any> {
    try {
      const { stdout } = await execAsync(`ucp show "${variantGid}"`, {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });

      try {
        return JSON.parse(stdout);
      } catch {
        return { raw: stdout, variantGid };
      }
    } catch (error: any) {
      console.error('UCP show failed:', error.message);
      return { error: error.message, variantGid };
    }
  }

  private extractTitle(output: string): string {
    const patterns = [
      /title:\s*(.+)/i,
      /name:\s*(.+)/i,
      /product:\s*(.+)/i,
      /^\s*"([^"]+)"\s*$/,  // Quoted title on its own line
    ];
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) return match[1].trim();
    }
    return '';
  }

  private extractPrice(output: string): string {
    const patterns = [
      /price:\s*\$?([\d.]+)/i,
      /\$([\d.]+)/,
      /amount[:\s]+([\d.]+)/i,
    ];
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) return `$${match[1]}`;
    }
    return 'Unknown';
  }

  private extractVendor(output: string): string {
    const patterns = [
      /vendor:\s*(.+)/i,
      /brand:\s*(.+)/i,
    ];
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) return match[1].trim();
    }
    return '';
  }

  /**
   * Check if the UCP CLI is installed and accessible.
   */
  async isUCPAvailable(): Promise<boolean> {
    if (this.ucpAvailable !== null) return this.ucpAvailable;

    try {
      await execAsync('ucp --version', { timeout: 10000 });
      this.ucpAvailable = true;
    } catch {
      // Try also 'ucp help'
      try {
        await execAsync('ucp help', { timeout: 5000 });
        this.ucpAvailable = true;
      } catch {
        this.ucpAvailable = false;
      }
    }

    return this.ucpAvailable;
  }
}