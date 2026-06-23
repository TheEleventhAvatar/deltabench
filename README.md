# Agent Shopping Benchmark — Shopify MCP vs delta Mandate

Benchmark comparing AI agent purchase accuracy on Shopify with and without delta Mandate's intent enforcement layer.

## Headline

When given 100 purchase intents across the Shopify catalog, a Shopify MCP-equipped agent bought the wrong product **28.8% of the time** (71.4% on hard, multi-constraint intents). With delta Mandate's verification layer: **0%**.

## Repository contents

| File | Description |
|------|-------------|
| [`intents.md`](intents.md) | The 100 taxonomy-aligned purchase intents, graded by difficulty (easy / medium / hard), with full change log documenting how each intent was adapted to use Shopify taxonomy attributes |
| [`shopify-agent-results.md`](shopify-agent-results.md) | Full results for the Shopify MCP control agent: all 66 found products verified against catalog data, with 19 false positives identified and categorized |
| [`mandate-results.md`](mandate-results.md) | Full results for the delta Mandate agent across all 100 intents, showing per-intent verification evidence and pass/fail/error status |
| [`comparison-analysis.md`](comparison-analysis.md) | Side-by-side comparison: confusion matrix, false positive and false negative analysis, discovery vs enforcement distinction, and the 14 disagreement cases |

## Methodology

- **100 purchase intents** generated to span the full range of difficulty, from single-constraint lookups ("Bamboo cutting board, under $30") to multi-constraint combinations that may not exist ("Leather journal cover, solid pattern, not black, under $60, with elastic closure, leather book cover material")
- Every constraint mapped to a Shopify product taxonomy attribute (see change log in `intents.md`)
- Both agents used Shopify's MCP (Merchant Tools Protocol + UCP catalog search) for product discovery
- The delta Mandate agent additionally ran a policy engine that verifies each candidate product's extracted evidence against the user's constraints before allowing purchase
- Both agents were instructed to pass if no suitable product was found, rather than picking a product that doesn't fit

## Key definitions

- **False positive (FP):** the agent bought a product that violated one or more constraints. This is the dangerous failure — real money spent on the wrong thing.
- **False negative (FN):** the agent passed on a purchase that was actually valid — a discovery failure, not a safety failure.

## Results summary

| Metric | Shopify MCP agent | delta Mandate agent |
|--------|-------------------|---------------------|
| True positives (valid purchase) | 47 | 56 |
| True negatives (correct pass) | 23 | 44 |
| **False positives** | **19** | **0** |
| **False negatives** | **11** | **0** |
| **False positive rate** | **28.8%** | **0.0%** |
| FP rate on hard intents (5+ constraints) | 71.4% | 0.0% |

Every Shopify agent false positive was a case where the agent asserted a constraint was satisfied without evidence in the catalog data — either the attribute was absent entirely (14 cases) or the agent used product-type intuition rather than extracting explicit evidence (5 cases).

## About delta Mandate

[delta Mandate](https://delta.network) is an intent enforcement layer for agentic commerce. It sits between an agent's discovery step and the payment, extracting structured evidence from product data and evaluating it against the user's constraints. If the verification passes when it shouldn't have, delta reimburses the user through the Mandate Guarantee.

## License

Benchmark data is provided for verification and reproducibility. Contact [delta](https://delta.network) for questions.
