# POC Milestone — Week 2: LLM Sequencing & EDL Generation

## Goal
Build the sequencing layer that takes a user query, retrieves candidate clips via the film agent, and uses an LLM to generate a structured Edit Decision List (EDL) with narrative rationale. Run first real EDLs. Begin prompt strategy comparison.

---

## Prerequisites from Week 1
- `poc/metadata/generated/*.json` — populated for all seed clips
- Film agent returning clip IDs + relevance scores for a query
- Clips normalized and keyframes available

---

## Branch
Continue on `poc/film-agent-edl` from Week 1.

New folders:

```
poc/
  sequencing/
    prompts/
      v1_single_shot.txt
      v2_chain_of_thought.txt
      v3_role_prompted.txt
    edl_schema/
      edl.schema.json
    generate_edl.py
    evaluate_edl.py
    run_experiments.py
  outputs/
    edls/                   # generated EDL JSON files
    experiments/            # comparative prompt experiment results
```

---

## Step 1 — Define the EDL Schema

Create `poc/sequencing/edl_schema/edl.schema.json`:

```json
{
  "edl_id": "string (uuid)",
  "generated_at": "ISO timestamp",
  "query": "string",
  "prompt_strategy": "single_shot | chain_of_thought | role_prompted",
  "model": "string",

  "narrative_arc": "string — one sentence describing the intended arc",

  "total_duration_estimate": "float (seconds)",
  "cut_count": "integer",

  "cuts": [
    {
      "position": "integer (1-based)",
      "clip_id": "string",
      "in_point": "float (seconds)",
      "out_point": "float (seconds)",
      "duration": "float (seconds)",
      "narrative_role": "opener | context_setter | turning_point | evidence | emotional_beat | closer",
      "rationale": "string — why this clip at this position"
    }
  ],

  "editorial_notes": "string — overall notes on pacing, flow, or limitations",
  "candidate_clips_considered": "integer",
  "candidate_clips_used": "integer"
}
```

---

## Step 2 — Metadata Loader

Build a utility that loads and formats clip metadata for injection into prompts.

```python
# sequencing/metadata_loader.py
import json
from pathlib import Path
from typing import Optional

METADATA_DIR = Path("poc/metadata/generated")

def load_all_metadata() -> dict[str, dict]:
    records = {}
    for f in METADATA_DIR.glob("*.json"):
        data = json.loads(f.read_text())
        records[data["clip_id"]] = data
    return records

def format_clip_for_prompt(clip: dict, include_transcript: bool = True) -> str:
    """Render a clip metadata record as a concise prompt-ready text block."""
    lines = [
        f"CLIP ID: {clip['clip_id']}",
        f"Duration: {clip['duration']:.1f}s",
        f"Suggested edit: {clip['edit_points']['suggested_in']:.1f}s → {clip['edit_points']['suggested_out']:.1f}s",
        f"Shot types: {', '.join(clip['visual']['shot_types'])}",
        f"Setting: {clip['visual']['setting']}",
        f"Pacing: {clip['visual']['pacing']}",
        f"Mood: {clip['semantic']['mood']}",
        f"Themes: {', '.join(clip['semantic']['themes'])}",
        f"Narrative roles available: {', '.join(clip['editorial']['narrative_roles'])}",
        f"Description: {clip['visual']['scene_description']}",
        f"Summary: {clip['semantic']['summary']}",
    ]
    if include_transcript and clip["transcript"]["full_text"]:
        excerpt = clip["transcript"]["full_text"][:300]
        lines.append(f"Transcript excerpt: {excerpt}...")
    return "\n".join(lines)

def format_candidates_for_prompt(clip_ids: list[str]) -> str:
    all_meta = load_all_metadata()
    blocks = []
    for i, cid in enumerate(clip_ids, 1):
        if cid not in all_meta:
            continue
        blocks.append(f"--- CANDIDATE {i} ---\n{format_clip_for_prompt(all_meta[cid])}")
    return "\n\n".join(blocks)
```

---

## Step 3 — Prompt Strategies

### Strategy 1: Single Shot (`prompts/v1_single_shot.txt`)

```
You are a documentary film editor. You have been given a user query and a set of 
candidate clips retrieved from a documentary archive.

Your task is to create an Edit Decision List (EDL) for a short edited sequence of 
{target_duration_min}–{target_duration_max} seconds that responds to the query with 
a clear narrative arc.

Rules:
- Select between 4 and 8 clips
- Total duration must be between {target_duration_min} and {target_duration_max} seconds
- Use the suggested in/out points unless you have a strong reason to adjust them
- Every cut must serve a narrative purpose
- The sequence must have a beginning, middle, and end

Return ONLY a valid JSON object matching this structure — no markdown, no explanation:
{edl_schema}

USER QUERY:
{query}

CANDIDATE CLIPS:
{candidates}
```

---

### Strategy 2: Chain of Thought (`prompts/v2_chain_of_thought.txt`)

```
You are a documentary film editor. Work through the following steps carefully.

USER QUERY: {query}

STEP 1 — NARRATIVE ARC
Before selecting any clips, define the narrative arc your edit will follow.
Write 3–5 sentences describing: the opening tone, how the story develops, 
what emotional or informational journey the viewer takes, and how it resolves.

STEP 2 — CLIP ASSIGNMENT
Review the candidate clips below. For each arc position 
(opener / context_setter / turning_point / evidence / emotional_beat / closer),
identify which clip best fits and why.

STEP 3 — EDL OUTPUT
Now produce the final EDL as a JSON object matching this structure:
{edl_schema}

Total duration target: {target_duration_min}–{target_duration_max} seconds.
Return your STEP 1 and STEP 2 reasoning, followed by the JSON block for STEP 3.

CANDIDATE CLIPS:
{candidates}
```

---

### Strategy 3: Role Prompted (`prompts/v3_role_prompted.txt`)

```
You are an experienced documentary film editor with 20 years of experience 
cutting social issue documentaries for festivals and broadcast. You have a 
strong instinct for pacing, emotional arc, and what makes a non-fiction 
sequence feel considered rather than assembled.

A researcher has given you access to a clip archive and asked you to cut a 
{target_duration_min}–{target_duration_max} second sequence responding to this query:

"{query}"

You have the following clips available. Select the ones that will make the 
strongest edit, in the right order, with tight in/out points.

{candidates}

Return your edit as a JSON object:
{edl_schema}

Also include a brief `editorial_notes` field explaining your pacing decisions 
and any reservations you have about the available material.
```

---

## Step 4 — EDL Generator

```python
# sequencing/generate_edl.py
import json, uuid
from datetime import datetime
from pathlib import Path
from openai import OpenAI
from metadata_loader import format_candidates_for_prompt

client = OpenAI()

EDL_SCHEMA_SUMMARY = """
{
  "edl_id": "...",
  "generated_at": "...",
  "query": "...",
  "prompt_strategy": "...",
  "model": "...",
  "narrative_arc": "...",
  "total_duration_estimate": 0.0,
  "cut_count": 0,
  "cuts": [
    {
      "position": 1,
      "clip_id": "...",
      "in_point": 0.0,
      "out_point": 0.0,
      "duration": 0.0,
      "narrative_role": "...",
      "rationale": "..."
    }
  ],
  "editorial_notes": "...",
  "candidate_clips_considered": 0,
  "candidate_clips_used": 0
}
"""

TARGET_MIN = 60
TARGET_MAX = 120

def load_prompt(strategy: str, query: str, candidate_ids: list[str]) -> str:
    template = Path(f"prompts/{strategy}.txt").read_text()
    candidates_text = format_candidates_for_prompt(candidate_ids)
    return template.format(
        query=query,
        candidates=candidates_text,
        edl_schema=EDL_SCHEMA_SUMMARY,
        target_duration_min=TARGET_MIN,
        target_duration_max=TARGET_MAX
    )

def generate_edl(
    query: str,
    candidate_clip_ids: list[str],
    strategy: str = "v1_single_shot",
    model: str = "gpt-4o"
) -> dict:
    
    prompt = load_prompt(strategy, query, candidate_clip_ids)
    
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=2000,
        temperature=0.4  # low temp for structural consistency
    )
    
    raw = response.choices[0].message.content.strip()
    
    # Extract JSON block if CoT response wraps it in prose
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "{" in raw and raw.index("{") > 0:
        raw = raw[raw.index("{"):]
    
    edl = json.loads(raw)
    
    # Inject generation metadata
    edl["edl_id"] = str(uuid.uuid4())
    edl["generated_at"] = datetime.utcnow().isoformat()
    edl["query"] = query
    edl["prompt_strategy"] = strategy
    edl["model"] = model
    edl["candidate_clips_considered"] = len(candidate_clip_ids)
    edl["candidate_clips_used"] = len(edl.get("cuts", []))
    
    return edl


def save_edl(edl: dict, output_dir: Path = Path("poc/outputs/edls")) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{edl['edl_id'][:8]}_{edl['prompt_strategy']}.json"
    out_path = output_dir / filename
    out_path.write_text(json.dumps(edl, indent=2))
    print(f"EDL saved: {out_path}")
    return out_path
```

---

## Step 5 — Film Agent Integration

Wrap your existing film agent call to fit the pipeline:

```python
# sequencing/film_agent_adapter.py

def query_film_agent(query: str, top_k: int = 10) -> list[str]:
    """
    Calls the existing film agent and returns an ordered list of clip IDs.
    Replace the body with your actual film agent call.
    """
    # --- Replace with your actual call ---
    # results = film_agent.search(query, top_k=top_k)
    # return [r.clip_id for r in results]
    # -------------------------------------
    raise NotImplementedError("Wire up your film agent here")
```

Keep this adapter thin — the goal is that the sequencing layer stays decoupled from whatever RAG implementation you're running.

---

## Step 6 — Experiment Runner

This generates EDLs for multiple queries × multiple strategies for comparison.

```python
# sequencing/run_experiments.py
import json
from pathlib import Path
from film_agent_adapter import query_film_agent
from generate_edl import generate_edl, save_edl

# Define your test queries
TEST_QUERIES = [
    "the impact of drought on rural farming communities",
    "children's daily life in urban informal settlements",
    "women leading environmental restoration projects",
    "the tension between industrial development and indigenous land rights",
    "moments of community resilience after natural disaster",
]

STRATEGIES = ["v1_single_shot", "v2_chain_of_thought", "v3_role_prompted"]

results_log = []

for query in TEST_QUERIES:
    print(f"\nQuery: {query}")
    candidate_ids = query_film_agent(query, top_k=10)
    print(f"  Retrieved {len(candidate_ids)} candidates")
    
    for strategy in STRATEGIES:
        print(f"  Running strategy: {strategy}")
        try:
            edl = generate_edl(query, candidate_ids, strategy=strategy)
            path = save_edl(edl)
            results_log.append({
                "query": query,
                "strategy": strategy,
                "edl_id": edl["edl_id"],
                "cut_count": edl["cut_count"],
                "duration_estimate": edl["total_duration_estimate"],
                "path": str(path),
                "status": "ok"
            })
        except Exception as e:
            print(f"    ERROR: {e}")
            results_log.append({
                "query": query,
                "strategy": strategy,
                "status": "error",
                "error": str(e)
            })

# Save experiment log
log_path = Path("poc/outputs/experiments/run_log.json")
log_path.parent.mkdir(parents=True, exist_ok=True)
log_path.write_text(json.dumps(results_log, indent=2))
print(f"\nExperiment log saved: {log_path}")
```

---

## Step 7 — Basic EDL Validation & Sanity Check

```python
# sequencing/validate_edl.py
import json
from pathlib import Path

def validate_edl(edl: dict) -> list[str]:
    issues = []
    
    cuts = edl.get("cuts", [])
    
    if not cuts:
        issues.append("No cuts in EDL")
        return issues
    
    if not (4 <= len(cuts) <= 8):
        issues.append(f"Unusual cut count: {len(cuts)} (expected 4–8)")
    
    total = sum(c["out_point"] - c["in_point"] for c in cuts)
    if not (50 <= total <= 140):
        issues.append(f"Total duration {total:.1f}s outside expected range (60–120s)")
    
    for cut in cuts:
        if cut["in_point"] >= cut["out_point"]:
            issues.append(f"Cut {cut['position']} ({cut['clip_id']}): in_point >= out_point")
        if cut["duration"] < 3:
            issues.append(f"Cut {cut['position']} ({cut['clip_id']}): very short duration ({cut['duration']:.1f}s)")
        if not cut.get("rationale"):
            issues.append(f"Cut {cut['position']}: missing rationale")
    
    # Check for duplicate clips
    clip_ids = [c["clip_id"] for c in cuts]
    if len(clip_ids) != len(set(clip_ids)):
        issues.append("Duplicate clip IDs in EDL")
    
    return issues


if __name__ == "__main__":
    for f in Path("poc/outputs/edls").glob("*.json"):
        edl = json.loads(f.read_text())
        issues = validate_edl(edl)
        status = "✓" if not issues else f"✗ {len(issues)} issue(s)"
        print(f"{f.name}: {status}")
        for issue in issues:
            print(f"  - {issue}")
```

---

## Step 8 — Human Review Format

Generate a readable review sheet for each EDL — useful for the expert review session in Week 3/4 and for the paper.

```python
# sequencing/render_review_sheet.py
import json
from pathlib import Path

def render_review_sheet(edl: dict) -> str:
    lines = [
        f"EDL REVIEW SHEET",
        f"{'='*60}",
        f"Query:    {edl['query']}",
        f"Strategy: {edl['prompt_strategy']}",
        f"Model:    {edl['model']}",
        f"Duration: ~{edl['total_duration_estimate']:.0f}s | {edl['cut_count']} cuts",
        f"",
        f"Narrative Arc:",
        f"  {edl.get('narrative_arc', 'N/A')}",
        f"",
        f"{'─'*60}",
    ]
    
    for cut in edl["cuts"]:
        lines += [
            f"  [{cut['position']}] {cut['clip_id']}",
            f"      In: {cut['in_point']:.1f}s  Out: {cut['out_point']:.1f}s  ({cut['duration']:.1f}s)",
            f"      Role: {cut['narrative_role']}",
            f"      Rationale: {cut['rationale']}",
            f""
        ]
    
    if edl.get("editorial_notes"):
        lines += [f"Editorial Notes:", f"  {edl['editorial_notes']}", ""]
    
    return "\n".join(lines)


for f in Path("poc/outputs/edls").glob("*.json"):
    edl = json.loads(f.read_text())
    sheet = render_review_sheet(edl)
    out = f.with_suffix(".txt")
    out.write_text(sheet)
    print(f"Review sheet: {out}")
```

---

## Definition of Done — Week 2

- [ ] EDL schema committed and reviewed
- [ ] All three prompt strategies implemented
- [ ] `generate_edl.py` runs end-to-end against at least one real query
- [ ] Film agent adapter wired to actual film agent
- [ ] Experiment runner executed for all 5 test queries × 3 strategies = 15 EDLs
- [ ] All 15 EDLs pass structural validation
- [ ] Human-readable review sheets generated for all EDLs
- [ ] First internal review: team reads 3–5 EDLs and notes qualitative impressions
- [ ] Notes committed in `poc/outputs/experiments/observations.md` capturing:
  - Which strategy produces the most coherent arcs?
  - Where does the LLM struggle (clip selection, pacing, rationale quality)?
  - What metadata fields proved most / least useful to the prompt?

---

## What to Watch For

**Good signs**
- LLM correctly identifies an opener/closer structure without being told which clips to use
- Rationale text references specific visual or thematic details from metadata
- Chain-of-thought produces noticeably different (more structured) arcs than single-shot

**Warning signs**
- LLM repeatedly picks the same clips regardless of query
- Duration estimates cluster around a single value regardless of clip selection
- Rationale text is generic ("this clip is relevant to the topic")

These observations directly feed the paper's findings section.
