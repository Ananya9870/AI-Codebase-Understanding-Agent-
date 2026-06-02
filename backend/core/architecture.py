"""
architecture.py
Generates a high-level architecture summary of the codebase.
Groups files by domain, identifies layers (API, DB, auth, etc.),
and produces a human-readable + structured overview via LLM.
"""

import json
from collections import defaultdict
from backend.utils.cache import load_cache, save_cache


ARCHITECTURE_PROMPT = """You are a senior software architect reviewing a codebase.

Below is a structured summary of the project's files, grouped by domain:

{domain_groups}

Key metrics:
- Total files analyzed: {total_files}
- Primary languages: {languages}
- Most imported/shared files: {core_files}

Based on this, generate a detailed architecture overview in JSON format:
{{
  "project_type": "e.g. REST API, Full-stack web app, CLI tool, Library",
  "overview": "2-3 sentence high-level description of what this system does",
  "layers": [
    {{
      "name": "Layer name (e.g. API Layer, Business Logic, Data Layer)",
      "description": "What this layer does",
      "files": ["key files in this layer"]
    }}
  ],
  "modules": [
    {{
      "name": "Module name (e.g. Authentication, Payments, User Management)",
      "description": "What this module handles",
      "entry_points": ["main files for this module"],
      "domain": "auth | payment | database | api | ui | config | utils | other"
    }}
  ],
  "tech_stack": {{
    "framework": "detected framework (Flask, Django, Express, React, etc.)",
    "database": "detected DB (PostgreSQL, MongoDB, SQLite, etc. or 'unknown')",
    "auth_method": "JWT, session, OAuth, etc. or 'unknown'",
    "other": ["other notable libraries/tools"]
  }},
  "data_flow": "Brief description of how data flows through the system",
  "entry_points": ["main entry point files like app.py, index.js, main.go"]
}}

Respond ONLY with valid JSON. No markdown, no explanation."""


def group_by_domain(summaries: list) -> dict:
    """Group file summaries by their detected domain."""
    groups = defaultdict(list)
    for item in summaries:
        domain = item["summary"].get("domain", "unknown")
        groups[domain].append({
            "path": item["path"],
            "purpose": item["summary"].get("purpose", ""),
            "components": item["summary"].get("key_components", [])[:3],
        })
    return dict(groups)


def format_domain_groups(groups: dict) -> str:
    """Format domain groups into a readable string for the LLM prompt."""
    lines = []
    for domain, files in groups.items():
        lines.append(f"\n[{domain.upper()} - {len(files)} files]")
        for f in files[:8]:  # cap per domain to avoid huge prompts
            components = ", ".join(f["components"][:3]) if f["components"] else "none listed"
            lines.append(f"  • {f['path']}: {f['purpose']} (components: {components})")
    return "\n".join(lines)


def generate_architecture_summary(
    repo_id: str,
    summaries: list,
    graph_data: dict,
    structure: dict,
    llm_client,
    cache_dir: str,
    model: str = "claude-sonnet-4-20250514",
) -> dict:
    """
    Generate a comprehensive architecture summary for the repo.
    Combines file summaries + graph data → LLM → structured overview.
    """
    cache_key = f"architecture_{repo_id}"
    cached = load_cache(cache_dir, cache_key)
    if cached:
        return cached

    # Build context
    domain_groups = group_by_domain(summaries)
    domain_text = format_domain_groups(domain_groups)

    # Language stats
    lang_stats = structure.get("stats", {}).get("languages", {})
    top_langs = sorted(lang_stats.items(), key=lambda x: x[1], reverse=True)[:4]
    languages_str = ", ".join(f"{lang} ({count} files)" for lang, count in top_langs)

    # Core/hub files from graph
    most_imported = graph_data.get("stats", {}).get("most_imported", [])
    core_files_str = ", ".join(f["id"] for f in most_imported[:5])

    prompt = ARCHITECTURE_PROMPT.format(
        domain_groups=domain_text,
        total_files=len(summaries),
        languages=languages_str,
        core_files=core_files_str or "none detected",
    )

    try:
        from backend.core.file_summarizer import call_llm
        raw = call_llm(llm_client, prompt, max_tokens=2000)
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
    except Exception as e:
        result = {
            "project_type": "Unknown",
            "overview": f"Architecture analysis failed: {str(e)[:100]}",
            "layers": [],
            "modules": [],
            "tech_stack": {},
            "data_flow": "",
            "entry_points": [],
        }

    # Enrich with raw data
    result["domain_breakdown"] = {
        domain: len(files) for domain, files in domain_groups.items()
    }
    result["total_files_analyzed"] = len(summaries)

    save_cache(cache_dir, cache_key, result)
    return result