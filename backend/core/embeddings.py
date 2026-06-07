"""
embeddings.py
Manages vector embeddings using ChromaDB with its built-in
default embedding function (no torch/sentence-transformers needed).
Saves ~350MB RAM — critical for Render free tier (512MB limit).
"""

import os
import json
import shutil
from pathlib import Path
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions


def get_chroma_client(embeddings_dir: str, repo_id: str):
    """Return a ChromaDB client + collection for a specific repo."""
    persist_dir = str(Path(embeddings_dir) / repo_id)
    os.makedirs(persist_dir, exist_ok=True)

    client = chromadb.PersistentClient(
        path=persist_dir,
        settings=Settings(anonymized_telemetry=False),
    )

    # Use ChromaDB's built-in default embedding function (ONNX-based, no torch)
    ef = embedding_functions.DefaultEmbeddingFunction()

    collection = client.get_or_create_collection(
        name="codebase",
        metadata={"hnsw:space": "cosine"},
        embedding_function=ef,
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
    Returns True if built fresh, False if already existed.
    """
    _, collection = get_chroma_client(embeddings_dir, repo_id)

    if collection.count() > 0:
        return False

    documents = []
    metadatas = []
    ids = []

    for item in summaries:
        summary = item["summary"]
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

    # ChromaDB auto-embeds using its built-in function
    collection.add(
        documents=documents,
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
    """
    _, collection = get_chroma_client(embeddings_dir, repo_id)

    if collection.count() == 0:
        return []

    results = collection.query(
        query_texts=[query],
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
    persist_dir = Path(embeddings_dir) / repo_id
    if persist_dir.exists():
        shutil.rmtree(persist_dir)