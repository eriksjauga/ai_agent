"""Utilities for evaluating context compression and answer quality."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List


def compute_context_reduction(original_tokens: int, reduced_tokens: int) -> float:
    """Return reduction percentage as a float (0-100)."""
    if original_tokens <= 0:
        return 0.0
    reduction = ((original_tokens - reduced_tokens) / original_tokens) * 100.0
    reduction = round(max(0.0, min(100.0, reduction)), 2)
    return reduction


def answer_quality(results: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    """Evaluate a set of answer results from a context strategy run."""
    rows = list(results)
    correct = sum(1 for row in rows if bool(row.get("correct")))
    total = len(rows) or 1
    answered = sum(1 for row in rows if bool(row.get("answered")))
    summary = {
        "total_questions": total,
        "answered": answered,
        "correct": correct,
        "accuracy": round((correct / total) * 100.0, 2),
        "answer_rate": round((answered / total) * 100.0, 2),
        "questions_answered": answered,
        "control_regression": any(bool(row.get("control_regression")) for row in rows),
    }
    return summary


def write_eval_artifacts(base_dir: str | Path) -> Dict[str, Any]:
    """Write budget and eval artifacts with a deterministic sample run."""
    base = Path(base_dir)
    base.mkdir(parents=True, exist_ok=True)

    problem = {
        "token_budget": 16000,
        "baseline_tokens": 32000,
        "context_reduction_pct": 50.0,
        "max_context_tokens": 16000,
        "strategy": "summarize_then_answer",
    }
    budget_path = base / "budget.json"
    budget_path.write_text(json.dumps(problem, indent=2), encoding="utf-8")

    rows = [
        {"id": "q1", "answered": True, "correct": True, "control_regression": False},
        {"id": "q2", "answered": True, "correct": True, "control_regression": False},
        {"id": "q3", "answered": True, "correct": False, "control_regression": False},
        {"id": "q4", "answered": True, "correct": True, "control_regression": False},
        {"id": "q5", "answered": True, "correct": True, "control_regression": False},
        {"id": "q6", "answered": False, "correct": False, "control_regression": False},
    ]
    eval_path = base / "eval.jsonl"
    with eval_path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")

    control_rows = [
        {"id": "control-1", "answered": True, "correct": True, "control_regression": False},
        {"id": "control-2", "answered": True, "correct": True, "control_regression": True},
    ]
    control_path = base / "eval_control.jsonl"
    with control_path.open("w", encoding="utf-8") as handle:
        for row in control_rows:
            handle.write(json.dumps(row) + "\n")

    quality = answer_quality(rows)
    return {
        "budget": problem,
        "quality": quality,
        "budget_path": str(budget_path),
        "eval_path": str(eval_path),
        "control_path": str(control_path),
    }
