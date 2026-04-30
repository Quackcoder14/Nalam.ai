"""
agents/graph.py
---------------
Compiles three LangGraph directed graphs for nalam.ai:

  context_graph      → guardrails → retriever → biographer
  intervention_graph → guardrails → retriever → intervention
  simulation_graph   → guardrails → retriever → twin

After guardrails, a conditional edge skips remaining nodes if
access was denied, routing directly to END.
"""

import logging
from langgraph.graph import StateGraph, END, START

from .state import NalamState
from .guardrails import guardrails_node
from .retriever import retriever_node
from .biographer import biographer_node
from .intervention import intervention_node
from .twin import twin_node

logger = logging.getLogger(__name__)


def _denied(state: NalamState) -> str:
    """Conditional edge: route to END if guardrails denied access."""
    return "end" if state.get("guardrail_denied") else "continue"


# ── Context Graph: guardrails → retriever → biographer ────────────────────────
def build_context_graph():
    g = StateGraph(NalamState)
    g.add_node("guardrails",  guardrails_node)
    g.add_node("retriever",   retriever_node)
    g.add_node("biographer",  biographer_node)

    g.add_edge(START, "guardrails")
    g.add_conditional_edges(
        "guardrails",
        _denied,
        {"continue": "retriever", "end": END},
    )
    g.add_edge("retriever",  "biographer")
    g.add_edge("biographer", END)
    return g.compile()


# ── Intervention Graph: guardrails → retriever → intervention ─────────────────
def build_intervention_graph():
    g = StateGraph(NalamState)
    g.add_node("guardrails",   guardrails_node)
    g.add_node("retriever",    retriever_node)
    g.add_node("intervention", intervention_node)

    g.add_edge(START, "guardrails")
    g.add_conditional_edges(
        "guardrails",
        _denied,
        {"continue": "retriever", "end": END},
    )
    g.add_edge("retriever",    "intervention")
    g.add_edge("intervention", END)
    return g.compile()


# ── Simulation Graph: guardrails → retriever → twin ──────────────────────────
def build_simulation_graph():
    g = StateGraph(NalamState)
    g.add_node("guardrails", guardrails_node)
    g.add_node("retriever",  retriever_node)
    g.add_node("twin",       twin_node)

    g.add_edge(START, "guardrails")
    g.add_conditional_edges(
        "guardrails",
        _denied,
        {"continue": "retriever", "end": END},
    )
    g.add_edge("retriever", "twin")
    g.add_edge("twin",      END)
    return g.compile()


# ── Compiled singletons (imported by main.py) ─────────────────────────────────
logger.info("Compiling LangGraph graphs...")
context_graph      = build_context_graph()
intervention_graph = build_intervention_graph()
simulation_graph   = build_simulation_graph()
logger.info("All graphs compiled.")
