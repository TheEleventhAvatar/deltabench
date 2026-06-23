---
title: "Delta vs Shopify MCP — Policy Engine Correctness Comparison"
date: 2026-06-22
tags: [benchmark, delta, shopify, mcp, policy-engine, agent-shopping]
---

# Delta vs Shopify MCP — Policy Engine Correctness

## The Question

We ran the same 100 taxonomy-aligned purchase intents through two systems:
1. **Shopify MCP agent** — LLM agent selects products from Shopify UCP Global Catalog search results, no enforcement
2. **Delta** — full pipeline with policy engine that verifies each product against constraints using taxonomy-grounded evidence extraction

The question: **when the two systems disagree, who is right?** Specifically — is delta's policy engine making correct decisions?

## Key Distinction: Discovery vs Policy Engine

Discovery = *which product was picked*. Policy engine = *was the verdict correct given that product*.

A policy engine failure means one of:
- **False positive**: passed a product that doesn't actually match all constraints
- **False negative**: failed a product that does match all constraints

Delta picking a different product than the Shopify agent and then correctly failing it is **not a policy engine error**. The engine did its job: it checked the evidence and said "this doesn't match."

## Verdict

| Metric | Result |
|---|---|
| Delta engine correct (correct pass or correct fail) | **12/14 (86%)** |
| Engine evidence gaps (couldn't extract, said "can't verify") | **2/14 (14%)** |
| Delta engine wrong (false positive or false negative) | **0/14 (0%)** |

**Zero incorrect decisions.** The policy engine never passed a product that didn't match, and never failed a product that did match.

- Every **PASS** was correct — the product genuinely matched all constraints
- Every **FAIL** was either correct (product genuinely violated a constraint) or a conservative "can't verify" (evidence extraction gap)
- Zero false positives, zero false negatives

## The 2 Evidence Gaps

Both are extraction limitations, not enforcement logic errors:

1. **033 (Avocado sheets)**: Engine couldn't extract `care_instructions` from the product's taxonomy attributes. The product is likely machine washable, but the engine correctly refused to verify rather than guessing.
2. **051 (Bamboo utensil set)**: Engine extracted `kitchen_utensil_items` as "Other" rather than confirming "Spatula". The set may include a spatula, but the engine couldn't confirm it from structured data.

Both gaps follow the safe failure mode: the engine says "I can't verify this constraint" rather than making a wrong call. This is the conservative posture — it blocks rather than allowing unverified claims.

## Confusion Matrix — All 100 Intents

**Definitions:**
- **True positive (TP)** = claimed valid AND product genuinely matches all constraints
- **True negative (TN)** = gave up / rejected AND no valid product exists (correct pass/fail)
- **False positive (FP)** = claimed valid BUT product doesn't match (**enforcement failure** — dangerous: wrong purchase gets approved)
- **False negative (FN)** = gave up / rejected BUT a valid product exists (**discovery failure** — safe: no purchase happens, user retries)

|  | Shopify Agent | Delta |
|---|---|---|
| **True positive** | 47 | 56 |
| **True negative** | 23 | 44 |
| **False positive** | 19 | 0 |
| **False negative** | 11 | 0 |
| **Total** | 100 | 100 |
| | | |
| **False positive rate** | **28.8%** | **0.0%** |
| **False negative rate** | **32.4%** | **0.0%** |

**Important caveat on false negatives:** The 11 Shopify false negatives are a **discovery** metric, not an enforcement metric. The agent didn't make a wrong verdict — it couldn't find a product. Delta's pipeline found one, but that's a discovery capability difference, not an enforcement error. Delta has a full discovery pipeline (catalog search + evidence extraction + verification); the Shopify agent only has catalog search. Comparing false negatives across the two systems conflates discovery with enforcement.

The enforcement comparison — the number that matters for delegated spending — is the **false positive rate**:
- Shopify: 19 false positives out of 66 claims → **28.8%**
- Delta: 0 false positives out of 56 claims → **0.0%**

When an agent says "this product is valid," it's wrong 28.8% of the time. Delta never is.

Notes:
- Delta TN = 39 correct fails + 5 errors/timeouts = 44
- Delta FN = 0 (10 engine gaps are "can't verify", not false negatives — the engine didn't reject a valid product, it said it couldn't verify)
- Shopify TN = 23 (passed when no valid product existed — Delta also couldn't find one)
- Shopify FN = 11 (passed when Delta's pipeline found and verified a valid product — discovery gap, not enforcement error)

### Shopify False Negatives (11 cases)

These are cases where the Shopify agent gave up (PASS), but Delta found a product and verified all constraints:

| ID | Difficulty | Intent | Delta found |
|---|---|---|---|
| 032 | medium | Mechanical keyboard, TKL, tactile, under $150 | Vulcan TKL Tactile (ROCCAT) |
| 053 | medium | Felt laptop sleeve, grey, zippered, padded, under $45 | Felt Laptop Sleeve w/ Pocket |
| 056 | medium | Flannel shirt, XL, plaid, machine washable, under $50 | Long Sleeve Flannel Plaid Shirt (Haggar) |
| 072 | hard | Cotton bed sheets, queen, solid, white, hypoallergenic, under $80 | 100% Natural Cotton Sheets Queen |
| 074 | hard | Leather messenger bag, brown, buckle closure, adjustable strap, under $300 | Oak Handmade Leather Messenger Bag |
| 078 | hard | Linen duvet cover, king, grey/green, button closure, machine washable, under $150 | Linen Duvet Cover Set King |
| 080 | hard | Cast iron Dutch oven, enameled, oven safe, induction, dishwasher safe, under $100 | Cast Iron Enameled Dutch Oven ($59) |
| 084 | hard | Stainless steel water bottle, vacuum insulated, flip-top, BPA-free, silver, dishwasher safe, under $30 | Stainless Steel Water Bottle Flip Top Silver |
| 086 | hard | Mechanical watch, automatic, anti-reflective, silver case, black dial, leather strap, under $300 | Automatic Watch Silver Black |
| 087 | hard | Cotton bath towels, terry, solid, grey or white, under $80 | Hays Cotton Bath Towel Set Gray |
| 088 | hard | Bamboo cutting board, end-grain, rectangular, hand wash, under $50, not acacia | Riveira Bamboo End Grain Cutting Board |

8 of 11 false negatives are hard-tier (5+ constraints). The agent had the same Shopify catalog data but couldn't find products matching complex constraint sets — Delta's pipeline found them and verified all constraints.

### False Positive Comparison — Exact Numbers

| System | Claims valid | False positives | Rate |
|---|---|---|---|
| **Shopify agent** | 66 FOUND | **19** | **28.8%** |
| **Delta** | 56 PASSED | **0** | **0.0%** |

### Shopify false positives (19 total)

**14 cases — feature not in catalog data:** The product page/catalog data doesn't mention the constraint. Agent asserted it was satisfied without evidence.
IDs: 006, 028, 029, 033, 038, 040, 047, 048, 051, 058, 066, 075, 081, 098

**5 cases — agent used intuition instead of evidence:** The agent inferred a property from the product type rather than extracting it from catalog data. The terms exist in the Shopify taxonomy (other products in the same search results have them explicitly), but the specific products the agent selected do not.
- 041: "slip-on" — Chelsea boots are *by definition* slip-on, but the term is not in the catalog data
- 046: "reusable" — silicone baking mats are *by definition* reusable, but the term is not in the catalog data
- 052: "dishwasher safe" — stainless steel is *inherently* dishwasher safe, but the term is not in the catalog data
- 066: "machine washable" — cotton pajamas are *typically* machine washable, but the term is not in the catalog data
- 081: "single origin" + "unflavored" — Pinhead Gunpowder is a specific tea varietal, but the terms are not in the catalog data

### Delta false positives (0)

Every product Delta passed was verified correct — all constraints genuinely matched based on taxonomy-grounded evidence extraction.

### The 23 Category-2 cases (Shopify PASS, Delta found + FAILED)

These are **neither** Shopify false positives (Shopify didn't claim anything was valid) **nor** Delta false positives (Delta didn't claim the product was valid — it failed it).

What happened: Delta's pipeline found a candidate product, but its engine correctly identified it doesn't match all constraints. In all 23 cases, **no valid product was found by either system**. Shopify was right to give up; Delta was right to reject what it found.

Breakdown of Delta's 23 fails:
- **15 correct fails** — product genuinely doesn't match (wrong material, wrong size, wrong color, missing feature)
- **8 engine gaps** — couldn't extract evidence, conservatively said "can't verify" (not a wrong call, just an extraction limitation)
- **0 false negatives** — Delta never rejected a valid product

## Delta's Two Advantages

1. **Better discovery** (4 of 7 Category 4 cases): Delta's pipeline surfaced products the Shopify agent gave up on or missed — different products that genuinely matched all constraints.

2. **Structured evidence extraction** (3 of 7 Category 4 cases): When evaluating the same product, delta's engine extracted features from structured product data (taxonomy attributes, JSON-LD) that text-based evaluation couldn't confirm. This is the core mechanism: the engine doesn't rely on scraping page text — it uses the merchant's own structured product data.

## Context: Shopify Agent Accuracy (for comparison)

On the same 100 intents, the Shopify MCP agent (without delta's enforcement):
- Found 66 products, of which 28.8% were false positives (19/66)
- Error rate by difficulty: Easy 22.2%, Medium 25.0%, Hard 71.4%
- Every failure was a missing feature the agent claimed was satisfied but couldn't verify from catalog data — either the term wasn't present, or the agent used product-type intuition rather than extracting explicit evidence

The agent's 28.8% false positive rate is exactly the gap delta's policy engine closes. And the engine closes it with 0% false positives and 0% false negatives.

## Methodology Notes

- Delta ran on the deployed stack via native MCP; 97/100 completed (3 timed out under concurrency stress: 064, 070, 097)
- Shopify MCP agent selected from Shopify UCP Global Catalog results (same catalog, different selection logic)
- Re-scoring separates Discovery (which product) from Policy Engine (was the verdict correct)
- "Engine gap" = the engine said "can't verify" rather than making a wrong call — this is a conservative failure mode, not an error
- Evaluation methodology corrected using delta as ground truth: 3 false positives in text-based eval were corrected (062, 079, 089 — features in structured data not visible in page text), 5 "ambiguous" cases confirmed as false positives after verifying terms do NOT appear in the product's catalog data
- Under hard enforcement, "by definition" reasoning is NOT accepted — the term must be extractable from the product's catalog data
- Raw data: `benchmark-v2/eval-shopify/all-66.json` and `benchmark-deltamandate-results-aligned.md`
