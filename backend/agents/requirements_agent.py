from __future__ import annotations

from typing import Any, Dict, TypedDict

from langgraph.graph import StateGraph, END
from groq import Groq

from ..config import settings


class RequirementsState(TypedDict, total=False):
    product_name: str
    product_description: str
    target_users: str
    key_features: str
    competitors: str
    constraints: str
    prd: Dict[str, Any]


def _get_client() -> Groq:
    api_key = settings.GROQ_REQUIREMENTS_API_KEY
    if not api_key:
        raise RuntimeError("GROQ_REQUIREMENTS_API_KEY is not set")
    return Groq(api_key=api_key)


def _generate_prd_node(state: RequirementsState) -> RequirementsState:
    client = _get_client()

    system_prompt = """
You are a senior product manager and system architect.

Your job is to transform a short product idea into a comprehensive Product Requirements Document (PRD).

The PRD must include ALL of the following sections, written in clear, detailed prose:

1. Product Overview
2. Problem Statement
3. Target Users
4. Market Analysis
5. Key Features
6. User Stories
7. Functional Requirements
8. Non Functional Requirements
9. Technical Architecture
10. Recommended Tech Stack
11. Database Design
12. API Design
13. System Architecture
14. Security Considerations
15. Performance Considerations
16. Deployment Strategy
17. Project Folder Structure
18. Milestones
19. MVP Scope
20. Future Enhancements

You MUST ALWAYS respond with STRICT JSON only (no extra keys, no prose around it),
matching exactly this schema (field names must match):

{
  "overview": "string",
  "problem_statement": "string",
  "target_users": ["string", "..."],
  "market_analysis": ["string", "..."],
  "features": ["string", "..."],
  "user_stories": ["string", "..."],
  "functional_requirements": ["string", "..."],
  "non_functional_requirements": ["string", "..."],
  "tech_stack": ["string", "..."],
  "system_architecture": ["string", "..."],
  "database_design": ["string", "..."],
  "api_design": ["string", "..."],
  "security": ["string", "..."],
  "performance": ["string", "..."],
  "deployment": ["string", "..."],
  "folder_structure": ["string", "..."],
  "milestones": ["string", "..."],
  "mvp_scope": ["string", "..."],
  "future_enhancements": ["string", "..."]
}

If the user input is short or vague, you must intelligently expand the idea using industry best practices
for modern SaaS / web products, making the PRD long, detailed, and practical.
"""

    user_prompt = f"""
Product name: {state.get("product_name") or ""}

Product description:
{state.get("product_description") or ""}

Target users:
{state.get("target_users") or ""}

Key features:
{state.get("key_features") or ""}

Competitors:
{state.get("competitors") or ""}

Constraints:
{state.get("constraints") or ""}
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.2,
        max_tokens=3500,
    )

    content = response.choices[0].message.content

    # content may be a string or a list of content parts depending on client version
    if isinstance(content, list):
        text = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    else:
        text = str(content)

    import json

    try:
        prd = json.loads(text)
    except json.JSONDecodeError:
        # As a fallback, wrap the raw text
        prd = {"raw": text}

    return {**state, "prd": prd}


_graph = None


def get_requirements_agent():
    global _graph
    if _graph is None:
        workflow = StateGraph(RequirementsState)
        workflow.add_node("generate_prd", _generate_prd_node)
        workflow.set_entry_point("generate_prd")
        workflow.add_edge("generate_prd", END)
        _graph = workflow.compile()
    return _graph


def run_requirements_agent(inputs: Dict[str, Any]) -> Dict[str, Any]:
    graph = get_requirements_agent()
    result: RequirementsState = graph.invoke(inputs)
    return result["prd"]  # type: ignore[index]

