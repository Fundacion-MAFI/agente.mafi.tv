How chunk size affects your RAG app

1. Retrieval
Each chunk is embedded and stored as one vector.
Smaller chunks → more vectors per shot → finer-grained matches, but more risk of splitting related content.
Larger chunks → fewer vectors → more context per match, but less precise retrieval and more noise.
2. Context for the LLM
chunkContent is passed as excerpt in serializeShotsForPrompt (around line 136 in app/(chat)/api/chat/route.ts).
The LLM sees up to 24 retrieved chunks (default DEFAULT_RETRIEVAL_K).
Chunk size directly controls how much text each retrieved hit contributes to the prompt.
3. Your current setup
Chunking: paragraph-aware (split on \n\n), then character-based with overlap.
Defaults: 800 chars, 200 overlap (~25% overlap).
Overlap: start += chunkSize - chunkOverlap → each step moves 600 chars forward, so 200 chars overlap between consecutive chunks.
Choosing chunk size and overlap

Model limits
Embedding models (e.g. text-embedding-3-small) typically support up to ~8K tokens per input.
800 chars ≈ 200 tokens, so you’re well below the limit for all your models.
Content type
Content type	Chunk size	Overlap	Rationale
Dense / technical (APIs, specs)	256–512 chars	10–20%	Smaller chunks for precise matches
Narrative / descriptive (your MAFI shots)	512–1024 chars	15–25%	Larger chunks keep context together
Mixed	512–800 chars	15–25%	Middle ground
Overlap
10–20%: typical starting point.
25% (your 200/800): good for narrative content to reduce boundary cuts.
50%+: usually unnecessary and increases storage and compute.
Per-model guidance
Chunk size is mostly independent of embedding model; the main constraint is the model’s max input length. Your models all support 8K+ tokens, so 800 chars is safe.

Model	Dimensions	Max input	Suggested chunk size
text-embedding-3-small	1536	8K tokens	512–1024 chars
text-embedding-3-large	3072	8K tokens	512–1024 chars
mistral-embed	1024	8K tokens	512–1024 chars
google/*	768	8K tokens	512–1024 chars
Practical recommendations for MAFI shots
Keep 800 / 200 as a baseline for narrative shot descriptions.
If retrieval feels too coarse: try 512 chars, 100 overlap.
If answers are cut at chunk boundaries: try 1024 chars, 200 overlap.
If you want to tune per model: you could add model-specific defaults in embedding-models.ts, but for your use case a single global setting is usually enough.

Quick evaluation
Precision: Are retrieved chunks too broad or noisy? → Try smaller chunks.
Recall: Are relevant shots missing? → Try larger chunks or more overlap.
Context quality: Does the LLM lack enough context per hit? → Try larger chunks.
Your current 800/200 setup is a reasonable default for narrative content. Adjust based on retrieval quality and LLM answers rather than model-specific rules.