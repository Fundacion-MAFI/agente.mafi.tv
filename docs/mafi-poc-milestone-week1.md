# POC Milestone — Week 1: Metadata Schema & Generation Pipeline

## Goal
Define the clip metadata schema and run the offline generation pipeline across a seed set of 20–30 clips. Output is a populated JSON metadata store that Week 2 can consume directly.

---

## Branch Setup

```bash
git checkout -b poc/film-agent-edl
```

Suggested folder structure within the project:

```
poc/
  metadata/
    schema/
      clip_metadata.schema.json   # JSON Schema definition
    generated/                    # Output: one .json per clip
    raw_keyframes/                # Extracted keyframe images
  pipeline/
    extract_keyframes.py
    generate_metadata.py
    validate_metadata.py
    run_pipeline.sh
  clips/                          # Symlink or path to normalized clip files
  requirements.txt
```

---

## Step 1 — Finalize the Metadata Schema

Create `poc/metadata/schema/clip_metadata.schema.json`.

### Schema Definition

```json
{
  "clip_id": "string",
  "filename": "string",
  "duration": "float (seconds)",
  "fps": "float",
  "resolution": "string (e.g. 1920x1080)",

  "edit_points": {
    "suggested_in": "float",
    "suggested_out": "float",
    "notes": "string (optional)"
  },

  "transcript": {
    "full_text": "string",
    "segments": [
      {
        "start": "float",
        "end": "float",
        "text": "string",
        "speaker": "string (optional)"
      }
    ]
  },

  "visual": {
    "shot_types": ["wide | medium | close-up | aerial | detail | insert"],
    "scene_description": "string (2–3 sentences from keyframe analysis)",
    "dominant_colors": ["string"],
    "setting": "string (indoor | outdoor | mixed)",
    "pacing": "slow | medium | fast"
  },

  "semantic": {
    "summary": "string (2–3 sentences)",
    "themes": ["string (max 10 tags)"],
    "mood": "string (e.g. contemplative, urgent, hopeful, tense)",
    "keywords": ["string"]
  },

  "editorial": {
    "narrative_roles": ["opener | context_setter | turning_point | evidence | emotional_beat | closer"],
    "works_as_standalone": "boolean",
    "contains_speech": "boolean",
    "contains_music": "boolean"
  },

  "embedding_id": "string (reference to vector store record)"
}
```

**Decision point:** `narrative_roles` is an array — a clip can serve multiple roles depending on context. The sequencing LLM will select the relevant role per edit.

---

## Step 2 — Clip Normalization Check

Before generation, verify your seed clips are consistent. Run this check script:

```python
# pipeline/check_normalization.py
import subprocess, json, sys
from pathlib import Path

REQUIRED = {"codec": "h264", "fps": 25.0, "width": 1920, "height": 1080}

def probe(path):
    result = subprocess.run([
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", str(path)
    ], capture_output=True, text=True)
    streams = json.loads(result.stdout)["streams"]
    video = next(s for s in streams if s["codec_type"] == "video")
    return {
        "codec": video["codec_name"],
        "fps": eval(video["r_frame_rate"]),  # fraction string
        "width": video["width"],
        "height": video["height"]
    }

clips_dir = Path("poc/clips")
issues = []
for clip in clips_dir.glob("*.mp4"):
    info = probe(clip)
    for k, v in REQUIRED.items():
        if info[k] != v:
            issues.append(f"{clip.name}: {k} is {info[k]}, expected {v}")

if issues:
    print("Normalization issues found:")
    for i in issues: print(f"  - {i}")
    sys.exit(1)
else:
    print(f"All {len(list(clips_dir.glob('*.mp4')))} clips pass normalization check.")
```

If clips need normalizing:
```bash
ffmpeg -i input.mp4 -vf scale=1920:1080 -r 25 -c:v libx264 -crf 18 -c:a aac -ar 48000 output.mp4
```

---

## Step 3 — Keyframe Extraction

Extract 3–5 representative keyframes per clip for vision model analysis.

```python
# pipeline/extract_keyframes.py
import subprocess
from pathlib import Path

def extract_keyframes(clip_path: Path, output_dir: Path, n_frames: int = 4):
    output_dir.mkdir(parents=True, exist_ok=True)
    duration = get_duration(clip_path)
    interval = duration / (n_frames + 1)
    
    for i in range(1, n_frames + 1):
        timestamp = interval * i
        out_file = output_dir / f"frame_{i:02d}.jpg"
        subprocess.run([
            "ffmpeg", "-ss", str(timestamp), "-i", str(clip_path),
            "-frames:v", "1", "-q:v", "2", str(out_file)
        ], capture_output=True)

def get_duration(clip_path: Path) -> float:
    result = subprocess.run([
        "ffprobe", "-v", "quiet", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(clip_path)
    ], capture_output=True, text=True)
    return float(result.stdout.strip())
```

---

## Step 4 — Transcription with Whisper

```python
# pipeline/transcribe.py
import whisper
from pathlib import Path

model = whisper.load_model("medium")  # or "large-v3" for best quality

def transcribe_clip(clip_path: Path) -> dict:
    result = model.transcribe(str(clip_path), word_timestamps=False)
    return {
        "full_text": result["text"].strip(),
        "segments": [
            {
                "start": s["start"],
                "end": s["end"],
                "text": s["text"].strip()
            }
            for s in result["segments"]
        ]
    }
```

Use `whisper medium` for the POC — good balance of speed and accuracy. Upgrade to `large-v3` for final paper examples.

---

## Step 5 — LLM Metadata Generation

Use GPT-4o (or Claude) with keyframes + transcript to populate the remaining fields.

```python
# pipeline/generate_metadata.py
import base64, json
from pathlib import Path
from openai import OpenAI

client = OpenAI()

METADATA_PROMPT = """
You are a documentary film analyst. Given keyframes from a short clip and its transcript, 
return a JSON object with exactly these fields:

{
  "visual": {
    "shot_types": [],          // list from: wide, medium, close-up, aerial, detail, insert
    "scene_description": "",   // 2-3 sentence visual description
    "setting": "",             // indoor | outdoor | mixed
    "pacing": ""               // slow | medium | fast
  },
  "semantic": {
    "summary": "",             // 2-3 sentences covering what this clip is about
    "themes": [],              // up to 10 thematic tags
    "mood": "",                // single mood descriptor
    "keywords": []             // up to 15 keywords for retrieval
  },
  "editorial": {
    "narrative_roles": [],     // list from: opener, context_setter, turning_point, 
                               //   evidence, emotional_beat, closer
    "works_as_standalone": false,
    "contains_speech": false,
    "contains_music": false
  },
  "edit_points": {
    "suggested_in": 0.0,       // seconds — natural edit-in point
    "suggested_out": 0.0,      // seconds — natural edit-out point
    "notes": ""
  }
}

Return ONLY valid JSON. No markdown, no explanation.

Transcript:
{transcript}

Clip duration: {duration} seconds
"""

def encode_image(image_path: Path) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def generate_clip_metadata(
    clip_id: str,
    transcript: dict,
    keyframe_paths: list[Path],
    duration: float
) -> dict:
    
    image_content = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{encode_image(kf)}",
                "detail": "low"
            }
        }
        for kf in keyframe_paths
    ]
    
    prompt = METADATA_PROMPT.format(
        transcript=transcript["full_text"],
        duration=round(duration, 1)
    )
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": image_content + [{"type": "text", "text": prompt}]
            }
        ],
        max_tokens=1000
    )
    
    return json.loads(response.choices[0].message.content)
```

---

## Step 6 — Assemble & Validate Full Metadata Record

```python
# pipeline/run_pipeline.py
import json
from pathlib import Path
from transcribe import transcribe_clip
from extract_keyframes import extract_keyframes, get_duration
from generate_metadata import generate_clip_metadata

CLIPS_DIR = Path("poc/clips")
KEYFRAMES_DIR = Path("poc/metadata/raw_keyframes")
OUTPUT_DIR = Path("poc/metadata/generated")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

for clip_path in sorted(CLIPS_DIR.glob("*.mp4")):
    clip_id = clip_path.stem
    out_file = OUTPUT_DIR / f"{clip_id}.json"
    
    if out_file.exists():
        print(f"Skipping {clip_id} (already generated)")
        continue
    
    print(f"Processing {clip_id}...")
    
    duration = get_duration(clip_path)
    
    kf_dir = KEYFRAMES_DIR / clip_id
    extract_keyframes(clip_path, kf_dir)
    keyframes = sorted(kf_dir.glob("*.jpg"))
    
    transcript = transcribe_clip(clip_path)
    llm_data = generate_clip_metadata(clip_id, transcript, keyframes, duration)

    # Probe basic video info
    import subprocess
    probe = subprocess.run([
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_streams", "-show_format", str(clip_path)
    ], capture_output=True, text=True)
    probe_data = json.loads(probe.stdout)
    video_stream = next(s for s in probe_data["streams"] if s["codec_type"] == "video")

    record = {
        "clip_id": clip_id,
        "filename": clip_path.name,
        "duration": duration,
        "fps": eval(video_stream["r_frame_rate"]),
        "resolution": f"{video_stream['width']}x{video_stream['height']}",
        "transcript": transcript,
        **llm_data
    }
    
    with open(out_file, "w") as f:
        json.dump(record, f, indent=2)
    
    print(f"  ✓ Saved {out_file}")
```

---

## Step 7 — Validation

```python
# pipeline/validate_metadata.py
import json
from pathlib import Path

REQUIRED_FIELDS = [
    "clip_id", "duration", "transcript", "visual",
    "semantic", "editorial", "edit_points"
]

issues = []
for f in Path("poc/metadata/generated").glob("*.json"):
    data = json.load(open(f))
    for field in REQUIRED_FIELDS:
        if field not in data:
            issues.append(f"{f.name}: missing '{field}'")
    if data.get("duration", 0) < 5:
        issues.append(f"{f.name}: suspiciously short duration")

if issues:
    print(f"{len(issues)} validation issues:")
    for i in issues: print(f"  - {i}")
else:
    print(f"All records valid ✓")
```

---

## Requirements

```
# poc/requirements.txt
openai>=1.0.0
openai-whisper
ffmpeg-python
pydantic>=2.0
jsonschema
numpy
Pillow
```

---

## Definition of Done — Week 1

- [ ] `clip_metadata.schema.json` committed and reviewed
- [ ] All seed clips pass normalization check
- [ ] Pipeline runs end-to-end on at least one clip
- [ ] 20–30 clips fully processed with no validation errors
- [ ] All generated metadata files committed to `poc/metadata/generated/`
- [ ] At least one human spot-check of a generated record for quality assessment
- [ ] `README.md` in `poc/` describing how to run the pipeline
