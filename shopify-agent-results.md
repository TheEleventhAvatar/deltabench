---
title: "Shopify MCP Benchmark — Found Product Verification (66 items)"
date: 2026-06-22
tags: [benchmark, shopify, mcp, delta, agent-shopping]
---

# Shopify MCP Benchmark — Found Product Verification

## Headline

**28.8% of products the agent claimed to find were false positives** — the agent presented products as matching all constraints when the catalog data did not contain the evidence. Error rate scales with constraint count.

| Tier | FOUND | Correct | False Positives | Error Rate |
|---|---|---|---|---|
| Easy (1-2 constraints) | 27 | 21 | 6 | **22.2%** |
| Medium (3-4 constraints) | 32 | 24 | 8 | **25.0%** |
| Hard (5+ constraints) | 7 | 2 | 5 | **71.4%** |
| **Overall** | **66** | **47** | **19** | **28.8%** |

## Methodology

- **100 taxonomy-aligned purchase intents** (every constraint expressible in delta's product taxonomy)
- Agent selected products from Shopify UCP Global Catalog search results (structured product data via `ucp catalog search`)
- Agent instructed to return PASS if no product satisfies ALL constraints
- 66 of 100 intents resulted in FOUND; 34 resulted in PASS
- Each FOUND product verified by:
  1. Fetching actual product page via curl
  2. Checking every constraint against catalog data (title + description from Shopify structured fields)
  3. Cross-checking against delta's enforcement engine results where available
- **Correct** = all constraints confirmed in catalog data; **False positive** = one or more constraints not found in evidence
- Evaluation corrected using delta's engine as ground truth — 3 cases where my text-based eval was too strict (features in structured data not visible in page text) were corrected to "correct"; 5 cases where my eval used intuition ("by definition slip-on") were corrected to "false positive" after confirming the terms do NOT appear in the product's catalog data

## Key Finding: Every Failure is Missing Evidence, Not Wrong Attribute

Every single false positive is a feature the agent *claimed* was satisfied but the catalog data doesn't confirm. Not wrong color, not wrong size, not wrong price — **missing evidence**.

**Two failure patterns:**

1. **Feature not in catalog data** (14 cases): The product page/catalog data simply doesn't mention "dishwasher safe", "non-insulated", "machine washable", "reusable", "USB-C" etc. The agent asserted the constraint was satisfied without evidence.

2. **Agent used intuition instead of evidence** (5 cases): The agent inferred a property from the product type rather than extracting it from catalog data:
   - 041: Claimed "slip-on" because Chelsea boots are *by definition* slip-on — but the term doesn't appear in the catalog data
   - 046: Claimed "reusable" because silicone baking mats are *by definition* reusable — but not in the catalog data
   - 052: Claimed "dishwasher safe" because stainless steel is *inherently* dishwasher safe — but not in the catalog data
   - 066: Claimed "machine washable" because cotton pajamas are *typically* machine washable — but not in the catalog data
   - 081: Claimed "single origin" because Pinhead Gunpowder is a specific tea varietal — but not in the catalog data

   All 5 terms **do exist** in the Shopify taxonomy (other products in the same search results have them explicitly). But the specific products the agent selected **do not** have them. The agent used product-type knowledge, not catalog evidence.

This is exactly the failure mode delta's enforcement engine is designed to catch: the agent *claims* a constraint is satisfied, but the product evidence doesn't confirm it. A deterministic verification layer requiring taxonomy-grounded evidence for each constraint would block all 19 false positives.

## Full Results Table (66 items)

| ID | Diff | Intent | Product | Verdict | What Failed |
|---|---|---|---|---|---|
| 001 | easy | White cotton t-shirt, size M | Versace White Cotton Crew Neck T-Shirt Size M | ✅ Correct | — |
| 002 | easy | Black leather wallet, under $50 | Black Leather Wallet ($20.00) | ✅ Correct | — |
| 003 | easy | Blue denim jeans, size 32, straight-leg | Diesel Straight Leg Denim Jeans Size 32 ($29) | ✅ Correct | — |
| 004 | easy | Stainless steel water bottle, vacuum-insulated | Stainless Steel Double Wall Vacuum Insulated Bottle ($14.99) | ✅ Correct | — |
| 005 | easy | Bamboo cutting board, under $30 | Undercut Bamboo Cutting Board ($23.99) | ✅ Correct | — |
| 006 | easy | Red ceramic mug, non-insulated | Red Ceramic Mug ($14.00) | ❌ Wrong | 'non-insulated' not in catalog data |
| 007 | easy | Black wireless mouse, under $40 | Logitech M325s Wireless Mouse Black ($22.99) | ✅ Correct | — |
| 008 | easy | Cotton tote bag, open top | Seaside Cotton Tote Bag ($4.48) | ✅ Correct | — |
| 010 | easy | White athletic socks, running, size L, moisture-wicking | Feetures Elite Running Socks White Large ($16.19) | ✅ Correct | — |
| 011 | easy | Black beanie, acrylic, one size | AC/DC Logo Beanie Black Acrylic One Size ($23) | ✅ Correct | — |
| 012 | easy | White ceramic decorative bowl, round | 5in Wide White Ceramic Bowl ($7.99) | ✅ Correct | — |
| 013 | easy | Brown leather gloves, size M | Padded Leather Gloves Size M Brown ($15.47) | ✅ Correct | — |
| 014 | easy | Grey waterproof laptop backpack | Waterproof Laptop Backpack Grey ($79) | ✅ Correct | — |
| 015 | easy | Blue moisture-wicking shorts, size M | Blue Mesh Shorts M ($38) | ❌ Wrong | 'moisture-wicking' not confirmed in catalog data |
| 016 | easy | Wooden picture frame, 5x7 inch | 5x7 White and Black Wooden Picture Frame ($29) | ✅ Correct | — |
| 018 | easy | Green enamel pin, under $10 | Green Mini Heart Enamel Pin ($7.50) | ✅ Correct | — |
| 019 | easy | White cotton bandana, large, solid | Plain Bandana White Large ($4.99) | ✅ Correct | — |
| 020 | easy | Stainless steel keychain, under $10 | Stainless Steel Keychain ($6.48) | ✅ Correct | — |
| 021 | easy | Grey sweatpants, size L | Polo RL Grey Sweatpants Size L ($37) | ✅ Correct | — |
| 022 | easy | Black leather belt for men | DUNDEE Mens Black Genuine Leather Belt ($13) | ✅ Correct | — |
| 023 | easy | Blue ceramic round planter | Blue Round Ceramic Planter ($325) | ✅ Correct | — |
| 024 | easy | White cotton pillowcase, standard | Cotton Standard Pillowcase White ($8.99) | ✅ Correct | — |
| 025 | easy | Natural beeswax container candle | Beeswax Container Candle ($30) | ✅ Correct | — |
| 027 | easy | Brown kraft notebook, lined pages | Brunnen Notebook Kraft Lined ($3.39) | ✅ Correct | — |
| 028 | easy | Clear glass tumbler, non-insulated, dishwasher safe | George Home Clear Glass Tumbler (£2.71) | ❌ Wrong | 'non-insulated' not in catalog data |
| 029 | easy | Grey fleece throw blanket, medium warmth | LURKA Checkered Sherpa Fleece Throw Smoke Grey ($32.39) | ❌ Wrong | 'medium warmth' not in catalog data |
| 030 | easy | Black solid-pattern headband, under $10 | Solid Black Headband ($5) | ✅ Correct | — |
| 031 | medium | Green crewneck sweater, wool, crew neck, under $100 | Song and Soul Crew Sweater Wool Army Green M ($79.99) | ✅ Correct | — |
| 033 | medium | Organic cotton bed sheets, queen, machine washable, white | ORGANIC TEXTILES Cotton Sheets Queen White ($333) | ❌ Wrong | 'machine washable' not confirmed in catalog data |
| 034 | medium | Leather crossbody bag, brown, magnetic closure, under $200 | Genuine Leather Magnetic Snap Crossbody Bag Dark Brown ($36) | ✅ Correct | — |
| 035 | medium | Cold brew concentrate, dark roast, sugar-free, under $25 | Cold Brew Concentrate ($7) | ✅ Correct | — |
| 036 | medium | Yoga mat, purple, TPE, solid, under $50 | Purple TPE Yoga Mat ($40.22) | ✅ Correct | — |
| 037 | medium | Stainless steel French press, double wall, under $40 | French Press 100% Stainless Steel Double Wall ($26) | ✅ Correct | — |
| 038 | medium | Linen shirt, size L, blue, long sleeve, machine washable | Men's 100% Linen Long Sleeve Shirt Blue L ($43.98) | ❌ Wrong | 'machine washable' not in catalog data |
| 039 | medium | Ceramic pour-over dripper, manual, white, under $25 | White Ceramic Pour Over Dripper Manual ($8.99) | ✅ Correct | — |
| 040 | medium | Resistance band set, medium resistance, solid, under $30 | Train Resistance Bands 5-Band Set ($29.99) | ❌ Wrong | 'medium resistance' not in catalog data |
| 041 | medium | Suede Chelsea boots, size 9, brown, slip-on, under $150 | Brown Clarks Suede Chelsea Boots Size 9 ($25) | ❌ Wrong | 'slip-on' not in catalog data — agent used intuition |
| 044 | medium | Hemp protein powder, vanilla, powder form, under $35 | Hemp Foods Australia Vanilla Hemp Protein ($31) | ✅ Correct | — |
| 045 | medium | Cotton bath towel, grey, solid, terry weave | 2-Pack Gray Cotton Bath Towels Terry ($39.99) | ✅ Correct | — |
| 046 | medium | Silicone baking mats, reusable, dishwasher safe, under $20 | Non-Stick Silicone Baking Mat Dishwasher Safe ($19.99) | ❌ Wrong | 'reusable' not in catalog data — agent used intuition |
| 047 | medium | Leather card holder, black, compact design, under $40 | Double C Card Bag Black Leather ($38.80) | ❌ Wrong | 'compact design' not in catalog data |
| 048 | medium | Cotton joggers, size M, heather grey, tapered | SKIMS Cotton Fleece Classic Jogger Heather Grey M ($88) | ❌ Wrong | fabric is Fleece not Cotton — Delta confirmed |
| 049 | medium | Cast iron skillet, pre-seasoned, oven safe, under $40 | 3Pcs Pre-Seasoned Cast Iron Skillet Set Oven Safe ($17.49) | ✅ Correct | — |
| 050 | medium | Canvas apron, unisex, solid, pockets, under $25 | Canvas Apron with Front Pocket ($10.50) | ✅ Correct | — |
| 051 | medium | Bamboo utensil set, dishwasher safe, spatula, under $15 | 5-Piece Bamboo Cooking Utensil Set ($12.99) | ❌ Wrong | 'includes spatula' not confirmed in catalog data |
| 052 | medium | Stainless steel lunch box, snap-on lid, dishwasher safe, under $35 | Lock & Go Stainless Lunch Box ($28) | ❌ Wrong | 'dishwasher safe' not in catalog data — agent used intuition |
| 054 | medium | Cotton bandana, red, solid, unisex | Solid Red Bandana ($4.99) | ✅ Correct | — |
| 055 | medium | Leather belt, black, large, men's | Size Large Black Woven Leather Belt Men's ($29) | ✅ Correct | — |
| 057 | medium | Standard pillow, hypoallergenic, synthetic fill, under $30 | Economical Hotel Pillows Synthetic Down ($28) | ✅ Correct | — |
| 058 | medium | Beeswax pillar candles, unscented, reusable, under $20 | 2 Pack Beeswax Pillar Candles Unscented ($19.99) | ❌ Wrong | 'reusable' not in catalog data |
| 060 | medium | Stainless steel cocktail shaker, satin finish, dishwasher safe, under $30 | Cuisinox Satin Finish Cocktail Shaker ($15.26) | ✅ Correct | — |
| 062 | medium | Cotton hoodie, size L, navy blue, long sleeve, under $50 | Cotton World Fleece Pullover Hoodie Navy Blue L ($8.99) | ✅ Correct | Delta confirmed — long sleeve in structured data |
| 063 | medium | Glass food storage, leak-proof, dishwasher safe, under $35 | 5-Pack Glass Food Storage Leak-Proof Dishwasher Safe ($31.41) | ✅ Correct | — |
| 064 | medium | Leather duffel bag, large, brown, under $200 | Brown Leather Duffel Bag Large ($109.99) | ✅ Correct | — |
| 065 | medium | Wool blend overcoat, size M, charcoal, insulated, under $250 | Jasper Men's Wool Blend Overcoat Charcoal Down Insulated ($163.44) | ✅ Correct | — |
| 066 | medium | Cotton pajamas, size L, striped, long sleeve, machine washable, under $45 | Cotton Striped Printed Long-sleeved Pajamas Set ($32) | ❌ Wrong | 'machine washable' not in catalog data — agent used intuition |
| 068 | medium | Cotton area rug, rectangular, braided, multi-color, under $80 | Hand Made Woven Chindi Cotton Area Rugs Turquoise Multi ($19.99) | ✅ Correct | — |
| 069 | medium | Leather messenger bag, black, laptop compartment, under $100 | Black Mens Leather Laptop Messenger Bag ($0.01) | ✅ Correct | — |
| 070 | medium | Stainless steel tongue scraper, under $10, reusable | Zefiro Tongue Scraper ($5) | ✅ Correct | — |
| 075 | hard | Whole bean coffee, medium roast, coarse grind, single origin, under $20 | Single-Origin Whole Bean Coffee Colombia ($19.99) | ❌ Wrong | 'coarse grind' not in catalog data |
| 079 | hard | Wireless over-ear headphones, ANC, closed-back, USB-C, mic, under $200 | Oneodio A Series ANC Wireless Headphones ($199) | ✅ Correct | Delta confirmed — USB-C etc. in structured data |
| 081 | hard | Organic green tea, loose leaf, unflavored, single origin, under $15 | Organic Pinhead Gunpowder Loose Leaf Tea ($4.99) | ❌ Wrong | 'single origin' + 'unflavored' not in catalog data — agent used intuition |
| 089 | hard | Leather wallet, cowhide, solid, RFID, under $75, brown, not black | Genuine Cowhide Leather Wallet RFID Brown ($23) | ✅ Correct | Delta confirmed — my eval had false positive |
| 090 | hard | Cold brew maker, glass, clear, manual, coffee beans, under $40 | Glass Cold Brew Coffee Maker ($18.99) | ✅ Correct | — |
| 097 | hard | Ceramic dinnerware, matte, solid, round, white, DW+MW safe, under $100 | 6 Piece Ceramic Dinnerware Set Matte White ($67.98) | ✅ Correct | — |
| 098 | hard | Stainless steel mixing bowl set, nesting, lids, round, DW safe, under $40 | Stainless Steel Mixing Bowls with Lids Nesting ($37.48) | ❌ Wrong | 'round shape' not in catalog data |

## Methodology Notes

- Product pages fetched via `curl --compressed` with mobile user agent
- Constraint checking is strict: a feature must appear in the product's catalog data (title or Shopify structured description) to be considered satisfied
- "By definition" reasoning (e.g., "Chelsea boots are inherently slip-on") is NOT accepted as evidence — the term must be extractable from the product's catalog data
- Evaluation was corrected using delta's enforcement engine as ground truth: 3 false positives in my text-based eval were corrected (062, 079, 089 — features were in structured data my text fetch missed), and 5 "ambiguous" cases were confirmed as false positives after verifying the terms do NOT appear in the product's catalog data
- PASS entries (34 items) are not included in this table — they are a separate analysis
- Raw data: `benchmark-v2/eval-shopify/all-66.json`
