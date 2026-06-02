"""
file_summarizer.py
Uses an LLM to generate a short, structured summary for each source file.
Supports Anthropic, Groq, and OpenAI via a unified call interface.
"""

import os
import json
from typing import Optional
from pathlib import Path
from backend.utils.file_utils import truncate_content
from backend.utils.cache import load_cache, save_cache


SUMMARY_PROMPT = """You are analyzing a source code file from a software project.

File path: {file_path}
Language: {language}

File content:
```
{content}
```

Provide a concise JSON summary with these fields:
{{
  "purpose": "One sentence: what this file does",
  "key_components": ["list of main classes/functions/exports"],
  "dependencies": ["files or modules this file imports/depends on"],
  "patterns": ["design patterns used, e.g. REST API, middleware, ORM model"],
  "domain": "which feature area this belongs to (auth, payment, database, UI, etc.)"
}}

Respond ONLY with valid JSON. No explanation, no markdown fences."""


def get_model_for_provider(client) -> str:
    """Return the right model string based on client type."""
    cname = type(client).__name__.lower()
    if "groq" in cname:
        return "llama-3.3-70b-versatile"
    elif "openai" in cname:
        return "gpt-4o-mini"
    else:
        return "claude-sonnet-4-20250514"


def call_llm(client, prompt: str, max_tokens: int = 500) -> str:
    """Unified LLM call — works with Anthropic, Groq, and OpenAI."""
    cname = type(client).__name__.lower()
    model = get_model_for_provider(client)

    if "anthropic" in cname:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()

    else:
        # Groq and OpenAI share the same interface
        response = client.chat.completions.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()


def summarize_file(
    file_path: str,
    content: str,
    language: str,
    llm_client,
) -> dict:
    """Generate a structured summary for one file."""
    truncated = truncate_content(content, max_chars=3500)
    prompt = SUMMARY_PROMPT.format(
        file_path=file_path,
        language=language,
        content=truncated,
    )

    try:
        raw = call_llm(llm_client, prompt, max_tokens=500)
        # Strip markdown fences if model adds them
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        return {
            "purpose": f"Could not summarize: {str(e)[:80]}",
            "key_components": [],
            "dependencies": [],
            "patterns": [],
            "domain": "unknown",
        }


def summarize_all_files(
    repo_id: str,
    local_path: str,
    code_files: list,
    llm_client,
    cache_dir: str,
    max_files: int = 100,
    progress_callback=None,
) -> list:
    """Summarize all code files, using disk cache to avoid repeat LLM calls."""
    cache_key = f"summaries_{repo_id}"
    cached = load_cache(cache_dir, cache_key)
    if cached:
        return cached

    results = []
    files_to_process = code_files[:max_files]
    total = len(files_to_process)

    for i, file_info in enumerate(files_to_process):
        rel_path = file_info["path"]
        language = file_info["language"]

        full_path = Path(local_path) / rel_path
        try:
            content = full_path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        if not content.strip():
            continue

        summary = summarize_file(rel_path, content, language, llm_client)
        results.append({
            "path": rel_path,
            "language": language,
            "size_kb": file_info["size_kb"],
            "summary": summary,
        })

        if progress_callback:
            progress_callback(i + 1, total, rel_path)

    save_cache(cache_dir, cache_key, results)
    return results