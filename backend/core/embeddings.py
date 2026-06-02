"""
embeddings.py
Manages vector embeddings using ChromaDB + sentence-transformers.
Enables semantic search: "where is auth handled?" → relevant files.
"""

import os
import json
from pathlib import Path
from typing import Optional
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

# Lightweight, fast model — good for code/technical text
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

_model_cache: Optional[SentenceTransformer] = None


def get_embedding_model() -> SentenceTransformer:
    """Load the embedding model (cached after first load)."""
    global _model_cache
    if _model_cache is None:
        _model_cache = SentenceTransformer(EMBEDDING_MODEL)
    return _model_cache


def get_chroma_client(embeddings_dir: str, repo_id: str):
    """Return a ChromaDB client + collection for a specific repo."""
    persist_dir = str(Path(embeddings_dir) / repo_id)
    os.makedirs(persist_dir, exist_ok=True)

    client = chromadb.PersistentClient(
        path=persist_dir,
        settings=Settings(anonymized_telemetry=False),
    )
    collection = client.get_or_create_collection(
        name="codebase",
        metadata={"hnsw:space": "cosine"},
    )
    return client, collection


def build_embeddings(
    repo_id: str,
    summaries: list,
    embeddings_dir: str,
    local_path: str,
) -> bool:
    """
    Embed all file summaries and store in ChromaDB.
    Each document = file path + summary text (rich context for search).
    Returns True if built fresh, False if already existed.
    """
    _, collection = get_chroma_client(embeddings_dir, repo_id)

    # Already populated?
    if collection.count() > 0:
        return False

    model = get_embedding_model()

    documents = []
    metadatas = []
    ids = []

    for item in summaries:
        summary = item["summary"]
        # Build rich text for embedding
        text_parts = [
            f"File: {item['path']}",
            f"Language: {item['language']}",
            f"Purpose: {summary.get('purpose', '')}",
            f"Domain: {summary.get('domain', '')}",
            f"Components: {', '.join(summary.get('key_components', []))}",
            f"Patterns: {', '.join(summary.get('patterns', []))}",
        ]
        doc_text = "\n".join(text_parts)

        doc_id = item["path"].replace("/", "__").replace("\\", "__")

        documents.append(doc_text)
        metadatas.append({
            "path": item["path"],
            "language": item["language"],
            "domain": summary.get("domain", "unknown"),
            "purpose": summary.get("purpose", "")[:500],
            "summary_json": json.dumps(summary),
        })
        ids.append(doc_id)

    if not documents:
        return False

    # Batch embed
    embeddings = model.encode(documents, batch_size=32, show_progress_bar=False).tolist()

    collection.add(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )
    return True


def search_codebase(
    repo_id: str,
    query: str,
    embeddings_dir: str,
    top_k: int = 5,
) -> list:
    """
    Semantic search: given a natural language query, return top-k relevant files.
    Returns list of {path, purpose, domain, score} dicts.
    """
    model = get_embedding_model()
    _, collection = get_chroma_client(embeddings_dir, repo_id)

    if collection.count() == 0:
        return []

    query_embedding = model.encode([query])[0].tolist()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        include=["metadatas", "distances", "documents"],
    )

    output = []
    for i, meta in enumerate(results["metadatas"][0]):
        output.append({
            "path": meta["path"],
            "language": meta.get("language", ""),
            "domain": meta.get("domain", ""),
            "purpose": meta.get("purpose", ""),
            "summary": json.loads(meta.get("summary_json", "{}")),
            "relevance_score": round(1 - results["distances"][0][i], 3),
        })

    return output


def delete_embeddings(repo_id: str, embeddings_dir: str):
    """Delete the ChromaDB store for a repo."""
    import shutil
    persist_dir = Path(embeddings_dir) / repo_id
    if persist_dir.exists():
        shutil.rmtree(persist_dir)