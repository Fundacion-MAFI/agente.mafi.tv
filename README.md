<h1 align="center">Film Agent</h1>

Film Agent is a Next.js App Router experience that combines the Vercel AI SDK with a retrieval pipeline over the MAFI audiovisual archive. The app streams chat completions, generates curated playlists, and stores conversations and artifacts in Postgres-backed tables.

---

## Features

* **Next.js App Router**

  * Advanced routing for seamless navigation and performance
  * React Server Components (RSCs) and Server Actions for server-side rendering

* **AI SDK**

  * Unified API for generating text, structured objects, and tool calls with LLMs
  * Hooks for building dynamic chat and generative interfaces
  * Supports OpenAI (default), Anthropic, Fireworks, and other providers

* **UI Layer**

  * [shadcn/ui](https://ui.shadcn.com) components
  * Styling with [Tailwind CSS](https://tailwindcss.com)
  * Accessible component primitives from [Radix UI](https://radix-ui.com)

* **Data Persistence**

  * [Neon Serverless Postgres](https://vercel.com/marketplace/neon) for chats, users, and artifacts
  * [Vercel Blob](https://vercel.com/storage/blob) for file storage where needed

* **Auth**

  * [Auth.js](https://authjs.dev) for simple and secure authentication

---

## Modular Architecture

Film Agent is structured around three main layers: system prompts, corpus, and interface.

### System Prompt

Conversation runs through layered prompts:

* A friendly baseline assistant prompt
* Geolocation hints
* An artifacts/tool guide for code/doc generation
* A specialized Spanish curation prompt for **Archivo** mode (`AGENTE_FILMICO_SYSTEM_PROMPT`)

All prompts live in:

```ts
// lib/ai/prompts.ts
```

This keeps the assistant’s behavior explicitly modular and easy to tweak.

### Corpus (Archivo Mode)

The archive-specific context is only used when the user selects **Archivo** mode:

1. The API handler retrieves relevant MAFI shots via embeddings.
2. Those shots are passed to the playlist generator.
3. The system streams both:

   * Chat text, and
   * A structured playlist document (“playlist artifact”) back to the UI.

This separation allows you to plug in a different corpus (or disable Archivo entirely) without changing the core chat UI.

### Interface and Routing

The main chat API route:

```ts
// app/(chat)/api/chat/route.ts
```

orchestrates both flows:

* **Archivo mode**
  Streams an object response for the playlist and writes an artifact to the database.

* **Regular chat mode**
  Streams chat completions (with tool calls) without touching the archive.

Because these flows are isolated, you can swap corpora, adjust prompts, or turn Archivo mode off while keeping the same UI and routing.

---

## Configuration and Customization

### Change the System Prompt

Edit `lib/ai/prompts.ts` to:

* Adjust the base assistant tone
* Update artifact/tool prompts
* Modify the Archivo-specific Spanish curation instructions

The same file also defines the request-hint wrapper, so you can inject or remove context derived from geo headers or other metadata.

### Switch Models or APIs

Model aliases and providers are defined in:

```ts
// lib/ai/providers.ts
```

By default, it wires aliases like:

* `chat-model`
* `film-agent`
* `title-model`
* `artifact-model`

to the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), using OpenAI models (`gpt-4o`, `gpt-4o-mini`) as defaults.

You can override the Archivo gateway using:

* `AI_GATEWAY_FILM_AGENT_BASE_URL`
* `AI_GATEWAY_FILM_AGENT_API_KEY`

Update these bindings to point at different providers or specific model IDs as needed.

### Control Length / Verbosity

Response length is controlled at two levels:

* Chat completions are limited with `stepCountIs(5)` and streamed with word-level smoothing.
* Archivo responses are condensed via `buildPlaylistSummary`.

You can adjust these behaviors in:

```ts
// app/(chat)/api/chat/route.ts
```

Modify the stop conditions or summary helpers to make replies shorter, longer, or more detailed.

---

## Collection and Data Layer

### Ingestion

The MAFI archive is stored as Markdown files in:

```bash
data/mafi-shots/
```

The ingestion script:

```ts
// scripts/ingest-mafi-shots.ts
```

does the following:

1. Reads Markdown files from `data/mafi-shots`.
2. Normalizes metadata.
3. Computes embeddings via `generateShotEmbeddings`.
4. Upserts both shots and their vectors into Postgres tables.

You can point this script to a different directory or schema to onboard another corpus.

### Retrieval

The retrieval logic is implemented in:

```ts
// lib/ai/mafi-retrieval.ts
```

It:

1. Embeds the user query with `embedMany` (through the AI Gateway).
2. Runs a `pgvector` similarity search against the `shot_embeddings` table.
3. Caches embeddings and results in memory with TTL limits.

To switch to another database, replace the Postgres client and similarity query while keeping the retrieval interface stable.

### Persistence

Database queries live in:

```ts
// lib/db/queries.ts
```

They use Drizzle ORM with `postgres-js` to manage:

* Users
* Chats
* Messages
* Documents (artifacts)
* Votes or feedback

To target a different provider, replace the Postgres client and adjust the Drizzle schema mappings while keeping the query helpers intact.

---

## Model Providers

This template uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) to access multiple AI models through a unified interface.

* **Default models**: OpenAI `gpt-4o`, `gpt-4o-mini` (via the gateway)
* **Extension**: Easily extend to Anthropic, Fireworks, and other providers by updating `lib/ai/providers.ts` and your environment variables.

---

## Running Locally

1. Copy `.env.example` to `.env.local` (or `.env`) and fill in the required environment variables.

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Run database migrations:

   ```bash
   pnpm db:migrate
   ```

4. Start the development server:

   ```bash
   pnpm dev
   ```

Your app should now be available at:

```text
http://localhost:3000
```

---

## Archive Ingestion Workflow

The MAFI archive in `data/mafi-shots/` is ingested automatically after `pnpm install` thanks to the `postinstall` script:

```bash
pnpm db:migrate && pnpm ingest:mafi
```

The same migration + ingestion pair also runs before `next build`, so Vercel deployments always migrate and ingest during the build step without extra configuration.

The ingestion script:

* Verifies that the shots tables exist
* Instructs you to run the migration if they are missing

You can also run the ingestion manually whenever you add or update Markdown files to refresh the database incrementally:

```bash
pnpm ingest:mafi
```

To remove database records for files that no longer exist locally, pass the `--prune` flag:

```bash
pnpm ingest:mafi -- --prune
```