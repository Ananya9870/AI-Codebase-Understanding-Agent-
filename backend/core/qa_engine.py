"""
qa_engine.py
RAG-based Q&A pipeline for answering developer questions about a codebase.
Flow: question → semantic search → retrieve context → LLM → answer
"""

from pathlib import Path
from backend.core.embeddings import search_codebase


QA_SYSTEM_PROMPT = """You are an expert software engineer helping a developer understand a codebase.
You have access to summaries of the codebase files. Answer questions accurately and helpfully.
When referencing code, mention specific file paths. Be concise but complete.
If you're uncertain, say so rather than guessing."""

QA_PROMPT_TEMPLATE = """A developer is asking about the codebase. Here are the most relevant files:

{context}

Developer's question: {question}

Please answer the question based on the codebase information above.
- Reference specific file paths when relevant
- If the answer involves multiple files, explain how they interact
- If the question can't be answered from the available context, say so clearly
- Keep the answer practical and developer-focused"""


def format_context(search_results: list, local_path: str, top_k: int = 5) -> str:
    """Format search results into a context string for the LLM."""
    lines = []
    for i, result in enumerate(search_results[:top_k], 1):
        summary = result.get("summary", {})
        lines.append(f"[File {i}] {result['path']}")
        lines.append(f"  Purpose: {result['purpose']}")
        lines.append(f"  Domain: {result['domain']}")

        components = summary.get("key_components", [])
        if components:
            lines.append(f"  Key components: {', '.join(components[:5])}")

        patterns = summary.get("patterns", [])
        if patterns:
            lines.append(f"  Patterns: {', '.join(patterns[:3])}")

        deps = summary.get("dependencies", [])
        if deps:
            lines.append(f"  Depends on: {', '.join(deps[:4])}")

        lines.append("")

    return "\n".join(lines)


def answer_question(
    repo_id: str,
    question: str,
    local_path: str,
    embeddings_dir: str,
    architecture: dict,
    llm_client,
    model: str = "claude-sonnet-4-20250514",
    top_k: int = 6,
) -> dict:
    """
    Answer a developer question about the codebase using RAG.
    Returns {answer, sources, confidence}.
    """
    # Step 1: Semantic search for relevant files
    search_results = search_codebase(
        repo_id=repo_id,
        query=question,
        embeddings_dir=embeddings_dir,
        top_k=top_k,
    )

    if not search_results:
        return {
            "answer": "I couldn't find relevant files to answer this question. The codebase may not have been indexed yet.",
            "sources": [],
            "confidence": "low",
        }

    # Step 2: Build context
    context = format_context(search_results, local_path)

    # Add architecture context for broad questions
    arch_context = ""
    if any(word in question.lower() for word in ["architecture", "overview", "structure", "how does", "flow"]):
        overview = architecture.get("overview", "")
        data_flow = architecture.get("data_flow", "")
        if overview:
            arch_context = f"\nSystem overview: {overview}\nData flow: {data_flow}\n"

    full_context = arch_context + context

    prompt = QA_PROMPT_TEMPLATE.format(context=full_context, question=question)

    # Step 3: LLM answer
    try:
        from backend.core.file_summarizer import call_llm
        full_prompt = QA_SYSTEM_PROMPT + "\n\n" + prompt
        answer = call_llm(llm_client, full_prompt, max_tokens=1000)
        confidence = "high" if search_results[0]["relevance_score"] > 0.7 else "medium"
    except Exception as e:
        answer = f"Failed to generate answer: {str(e)}"
        confidence = "low"

    return {
        "answer": answer,
        "sources": [
            {
                "path": r["path"],
                "purpose": r["purpose"],
                "domain": r["domain"],
                "relevance": r["relevance_score"],
            }
            for r in search_results[:4]
        ],
        "confidence": confidence,
    }


def get_suggested_questions(architecture: dict) -> list:
    """Generate useful starter questions based on the detected architecture."""
    modules = architecture.get("modules", [])
    layers = architecture.get("layers", [])
    tech = architecture.get("tech_stack", {})

    questions = [
        "Where is authentication handled?",
        "What is the main entry point of the application?",
        "How is the database accessed?",
        "Where are the API routes defined?",
    ]

    # Add module-specific questions
    for mod in modules[:3]:
        name = mod.get("name", "")
        if name and name.lower() not in ["unknown", "other", "utils"]:
            questions.append(f"How does the {name} module work?")

    # Tech-specific questions
    framework = tech.get("framework", "")
    if framework and framework.lower() not in ["unknown", ""]:
        questions.append(f"How is {framework} configured in this project?")

    auth = tech.get("auth_method", "")
    if auth and auth.lower() not in ["unknown", ""]:
        questions.append(f"How does {auth} authentication work here?")

    return questions[:8]