# Agent Shopping Benchmark — Shopify MCP vs delta Mandate

Benchmark comparing AI agent purchase accuracy on Shopify with and without delta Mandate's intent enforcement layer.

## Headline

When given 100 purchase intents across the Shopify catalog, a Shopify MCP-equipped agent bought the wrong product **28.8% of the time** (71.4% on hard, multi-constraint intents). With delta Mandate's verification layer: **0%**.

## Repository contents

| File | Description |
|------|-------------|
| [`intents.md`](intents.md) | The 100 taxonomy-aligned purchase intents, graded by difficulty (easy / medium / hard), with full change log documenting how each intent was adapted to use Shopify taxonomy attributes |
| [`shopify-agent-results.md`](shopify-agent-results.md) | Full results for the Shopify MCP control agent: all 66 found products verified against catalog data, with 19 errors identified and categorized |
| [`mandate-results.md`](mandate-results.md) | Full results for the delta Mandate agent across all 100 intents, showing per-intent verification evidence and pass/fail/error status |
| [`comparison-analysis.md`](comparison-analysis.md) | Side-by-side comparison: confusion matrix, error analysis, discovery vs enforcement distinction, and the 14 disagreement cases |

## Methodology

- **100 purchase intents** generated to span the full range of difficulty, from single-constraint lookups ("Bamboo cutting board, under $30") to multi-constraint combinations that may not exist ("Leather journal cover, solid pattern, not black, under $60, with elastic closure, leather book cover material")
- Every constraint mapped to a Shopify product taxonomy attribute (see change log in `intents.md`)
- Both agents used Shopify's MCP (Merchant Tools Protocol + UCP catalog search) for product discovery
- The delta Mandate agent additionally ran a policy engine that verifies each candidate product's extracted evidence against the user's constraints before allowing purchase
- Both agents were instructed to pass if no suitable product was found, rather than picking a product that doesn't fit

## Results

### Confusion matrix

|  | Shopify MCP agent | delta Mandate agent |
|--------|-------------------|---------------------|
| **True positive** (valid product found and purchased) | 47 | 56 |
| **True negative** (no valid product exists, correctly passed) | 23 | 44 |
| **False positive** (purchased a product that violated constraints) | 19 | 0 |
| **False negative** (passed when a valid product existed) | 11 | 0 |
| **Total** | 100 | 100 |

### Error rates

Two metrics matter, and the Shopify agent fails on both:

| Metric | Formula | Shopify agent | delta Mandate |
|--------|---------|---------------|---------------|
| **Purchase error rate** | FP / (TP + FP) | **28.8%** (19/66) | **0.0%** (0/56) |
| **False positive rate** | FP / (FP + TN) | **45.2%** (19/42) | **0.0%** (0/44) |

- **Purchase error rate** (false discovery rate): of the products the agent claimed to find, what fraction were wrong. This is the metric that matters to the user — 28.8% of the time the agent said "I found it," the purchase violated at least one constraint.
- **False positive rate**: of the cases where no valid purchase should have been made, what fraction did the agent wrongly make. Statistically rigorous but less intuitive for this use case.

On hard intents (5+ constraints), the purchase error rate hit **71.4%**.

### What the Shopify agent got wrong

Every false positive was a case where the agent asserted a constraint was satisfied without evidence in the catalog data:
- **14 cases:** the constraint wasn't present anywhere in the product data. The agent claimed it was satisfied anyway.
- **5 cases:** the agent used product-type intuition ("stainless steel is inherently dishwasher safe") rather than extracting explicit evidence from the catalog.

## About delta Mandate

[delta Mandate](https://delta.network) is an intent enforcement layer for agentic commerce. It sits between an agent's discovery step and the payment, extracting structured evidence from product data and evaluating it against the user's constraints. If the verification passes when it shouldn't have, delta reimburses the user through the Mandate Guarantee.

## License

Benchmark data is provided for verification and reproducibility. Contact [delta](https://delta.network) for questions.
