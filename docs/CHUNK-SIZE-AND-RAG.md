# Chunk Size and RAG: Discussion Summary

This document captures our discussion on how chunk size impacts the RAG application, how to choose good settings, and an alternative approach using full shots instead of chunks.

---

## Part 1: How Chunk Size Impacts the RAG Application

### 1. Retrieval

- Each chunk is embedded and stored as one vector.
- **Smaller chunks** → more vectors per shot → finer-grained matches, but more risk of splitting related content.
- **Larger chunks** → fewer vectors → more context per match, but less precise retrieval and more noise.

### 2. Context for the LLM

- `chunkContent` is passed as `excerpt` in `serializeShotsForPrompt` (around line 136 in `app/(chat)/api/chat/route.ts`).
- The LLM sees up to 24 retrieved chunks (default `DEFAULT_RETRIEVAL_K`).
- Chunk size directly controls how much text each retrieved hit contributes to the prompt.

### 3. Current Setup

- **Chunking**: Paragraph-aware (split on `\n\n`), then character-based with overlap.
- **Defaults**: 800 chars, 200 overlap (~25% overlap).
- **Overlap logic**: `start += chunkSize - chunkOverlap` → each step moves 600 chars forward, so 200 chars overlap between consecutive chunks.

---

## Part 2: Choosing Chunk Size and Overlap

### Model Limits

- Embedding models (e.g. text-embedding-3-small) typically support up to ~8K tokens per input.
- 800 chars ≈ 200 tokens, so you're well below the limit for all models.

### Content Type

| Content type                      | Chunk size   | Overlap   | Rationale                          |
| --------------------------------- | ------------ | --------- | ---------------------------------- |
| Dense / technical (APIs, specs)   | 256–512 chars| 10–20%    | Smaller chunks for precise matches |
| Narrative / descriptive (MAFI)   | 512–1024 chars | 15–25%  | Larger chunks keep context together|
| Mixed                             | 512–800 chars| 15–25%    | Middle ground                      |

### Overlap

- **10–20%**: Typical starting point.
- **25%** (current 200/800): Good for narrative content to reduce boundary cuts.
- **50%+**: Usually unnecessary and increases storage and compute.

### Per-Model Guidance

Chunk size is mostly independent of embedding model; the main constraint is the model's max input length. All supported models support 8K+ tokens, so 800 chars is safe.

| Model                    | Dimensions | Max input | Suggested chunk size |
| ------------------------ | ---------- | --------- | -------------------- |
| text-embedding-3-small   | 1536       | 8K tokens | 512–1024 chars        |
| text-embedding-3-large   | 3072       | 8K tokens | 512–1024 chars       |
| mistral-embed            | 1024       | 8K tokens | 512–1024 chars       |
| google/*                 | 768        | 8K tokens | 512–1024 chars       |

### Practical Recommendations for MAFI Shots

1. **Keep 800 / 200** as a baseline for narrative shot descriptions.
2. **If retrieval feels too coarse**: Try 512 chars, 100 overlap.
3. **If answers are cut at chunk boundaries**: Try 1024 chars, 200 overlap.
4. **If you want to tune per model**: Add model-specific defaults in `embedding-models.ts`, but for this use case a single global setting is usually enough.

### Quick Evaluation

- **Precision**: Are retrieved chunks too broad or noisy? → Try smaller chunks.
- **Recall**: Are relevant shots missing? → Try larger chunks or more overlap.
- **Context quality**: Does the LLM lack enough context per hit? → Try larger chunks.

The current 800/200 setup is a reasonable default for narrative content. Adjust based on retrieval quality and LLM answers rather than model-specific rules.

---

## Part 3: Full Shots vs Chunks — Alternative Approach

### Context

Instead of passing retrieved chunks to the LLM, we could deduplicate by shot and pass the full shot content for each matched shot.

### Current Flow

1. Retrieve top 24 **chunks** (vector search).
2. Pass each chunk's `excerpt` (chunk content) to the LLM.
3. Multiple chunks from the same shot can appear separately.

### Proposed Flow

1. Retrieve top 24 chunks (unchanged).
2. **Deduplicate by `shot_id`** (e.g. keep best similarity per shot).
3. Pass **full shot records** (title, description, historic_context, place, author, date, geotag, tags) instead of chunk excerpts.

### Feasibility

The retrieval already joins `shots`, so full shot metadata is available for each chunk. The shots table stores `description` (which often contains the main text when no frontmatter description exists) and `historic_context`. Together these cover most of what gets embedded.

### Tradeoffs

| Aspect                    | Chunks (current)        | Full shots (proposed)           |
| -------------------------- | ----------------------- | ------------------------------ |
| Context completeness      | Risk of cut-off at boundaries | Full shot content per match |
| Token usage                | ~24 × ~800 chars ≈ 19k  | Depends on shot length; often similar or less |
| Relevance signal           | Chunk is the exact match | Full shot may include irrelevant text |
| Result count               | Up to 24 items          | Fewer unique shots (e.g. 8–15) |
| Noise                      | Only the matched excerpt | Extra text around the match   |

### Recommendation

Using full shots is a good fit because:

1. Shots are relatively short (metadata + description + historic_context).
2. No chunk-boundary issues.
3. Fewer, richer items can be easier for the LLM to reason about.
4. Chunks remain useful for retrieval; only the context passed to the LLM changes.

### Implementation Sketch

1. **Retrieval**: Keep current query; it already returns full shot rows plus `chunkContent` and `similarity`.
2. **Deduplication**: Group by `shot_id`, keep the row with highest `similarity` per shot.
3. **Serialization**: In `serializeShotsForPrompt`, replace `excerpt: shot.chunkContent` with full shot fields (description, historic_context, etc.) or a combined `fullContent`.
4. **Optional**: Include the best-matching chunk as `matchedExcerpt` so the LLM knows which part triggered the retrieval.

### Optional: Hybrid Approach

Pass both:

- Full shot content (description, historic_context, etc.).
- `matchedExcerpt`: the chunk that matched, so the model sees both full context and the specific relevant passage.

---

## References

- Chunking logic: `lib/ai/mafi-embeddings.ts` — `chunkShotText`, `generateShotEmbeddings`
- Retrieval: `lib/ai/mafi-retrieval.ts` — `retrieveRelevantShots`
- Prompt serialization: `app/(chat)/api/chat/route.ts` — `serializeShotsForPrompt`
- Settings UI: `app/admin/settings/settings-form.tsx` — chunk size and overlap inputs
- Ingest defaults: `lib/ingest/run-mafi-ingest.ts` — `INGEST_DEFAULTS` (reads from database)
