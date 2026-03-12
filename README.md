# Agente Fílmico MAFI

A prompt-based interface for exploring audiovisual archives. Ask questions in natural language and receive curated selections of films with contextual commentary—powered by LLMs and semantic search over your media collection.

---

## What is Agente Fílmico?

**Agente Fílmico** is a digital tool that lets users *converse* with a film archive. Instead of browsing catalogs or filtering by metadata, visitors ask questions in plain language. An AI curatorial agent retrieves relevant shots, interprets the collection, and responds with commentary and playlists.

This prototype showcases the **MAFI (Mapa Fílmico de un País)** collection—short documentaries by the Chilean Film Collective MAFI. Working with 50 annotated films, we're testing how conversational interaction can open new ways to access archival materials.

> *What happens when you can talk to a film collection?* Agente Fílmico explores this question by introducing prompting as a new form of interface for audiovisual exploration.

---

## Unlocking the MAFI Collective

The [MAFI collective](https://mafi.tv/) (founded 2010) produced over 360 short documentaries—a unique audiovisual map of Chile. Their work has circulated in galleries, festivals, and the Chilean press, but the archive has remained largely inaccessible to casual exploration.

Agente Fílmico changes that. By combining:

- **Hybrid AI + human curation** — Shots are annotated through a mix of automated and manual strategies
- **Semantic search** — Embeddings let users find films by theme, mood, or concept, not just keywords
- **Conversational interface** — Natural-language prompts replace rigid search forms

…we make the MAFI archive explorable through dialogue. Users can ask about landscapes, social themes, specific regions, or creative approaches—and receive curated playlists with context.

---

## For Your Own Media Archive

Agente Fílmico is **open source** and designed so other archives can adapt it for their own collections. Whether you run a film archive, museum, or digital heritage project, you can deploy a similar conversational interface over your media.

### What You Get

- **Conversational exploration** — Users ask questions; the system returns relevant items with commentary
- **Curatorial playlists** — Each response can include a structured playlist artifact (films, timestamps, links)
- **Multilingual** — The interface supports multiple languages; the agent responds in the user's language
- **Admin panel** — Manage your corpus, tune prompts, and control embeddings without touching code

### Admin Overview

The admin panel at `/admin` gives you full control over your archive instance:

| Section | Purpose |
|--------|---------|
| **Shots** | Add, edit, and delete items in your media corpus. Each shot has metadata (title, description, URL, etc.) used for retrieval. |
| **Embed** | Refresh embeddings when you change the embedding model or add new shots. Runs the vector pipeline over your database. |
| **Settings** | Configure system prompts, chat models, embedding models, chunk sizes, and retrieval behaviour. No code changes required. |

**Setup:** Add your email to `ADMIN_EMAILS` in `.env` to access the admin panel. See [Technical Documentation](docs/TECHNICAL.md) for full configuration details.

### Adapting for Your Collection

1. **Import your metadata** — Shots live in the database; you can seed them via migrations, scripts, or the admin UI.
2. **Run embeddings** — Use the Embed page (or `pnpm ingest:mafi`) to generate vectors for semantic search.
3. **Tune prompts** — In Settings, adjust the Agente Fílmico prompt to match your collection’s tone and language.
4. **Choose models** — Select embedding and chat models that fit your budget and language needs.

The codebase keeps corpus, prompts, and retrieval modular—so you can plug in a different collection or disable the archive mode entirely without changing the core chat UI.

---

## Quick Start

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Copy `.env.example` to `.env.local` and fill in your database and API keys. See [docs/TECHNICAL.md](docs/TECHNICAL.md) for environment variables and deployment.

---

## Documentation

- **[Technical Documentation](docs/TECHNICAL.md)** — Architecture, configuration, ingestion, and development setup
- **[Chunk size and RAG](docs/CHUNK-SIZE-AND-RAG.md)** — Tuning retrieval quality

---

## Credits

**Project leads and investigators:** Pablo Núñez and Antonio Luco  
**Research and Development:** Ignacio Rojas and [David Vandenbogaerde](https://d17e.dev)  
**Films produced by:** the MAFI Collective

This project derives from the original Film Concierge / Agente Fílmico by Ignacio Rojas. Supported by [Stimuleringsfonds Digital Culture](https://www.stimuleringsfonds.nl/en/info). In collaboration with [Netherlands Film Academy](https://www.filmacademie.ahk.nl/en/graduates/2025/projects/ai-greenhouse-cultivating-responsible-engagement-with-ai-in-filmmaking/), AI Greenhouse programme.

Open source under [MIT License](LICENSE.md).
