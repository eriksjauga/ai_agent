import json
from pathlib import Path

from context_strategy.strategy import answer_quality, compute_context_reduction, write_eval_artifacts


def test_context_reduction_is_at_least_50_percent():
    reduction = compute_context_reduction(32000, 16000)
    assert reduction >= 50.0


def test_strategy_answers_most_questions():
    rows = [
        {"answered": True, "correct": True},
        {"answered": True, "correct": True},
        {"answered": True, "correct": False},
        {"answered": True, "correct": True},
        {"answered": True, "correct": True},
        {"answered": False, "correct": False},
    ]
    summary = answer_quality(rows)
    assert summary["answered"] >= 5
    assert summary["answer_rate"] >= 80.0


def test_eval_artifacts_are_written(tmp_path):
    result = write_eval_artifacts(tmp_path)
    assert result["budget"]["context_reduction_pct"] >= 50.0
    assert (tmp_path / "budget.json").exists()
    assert (tmp_path / "eval.jsonl").exists()
    assert (tmp_path / "eval_control.jsonl").exists()

    budget = json.loads((tmp_path / "budget.json").read_text())
    assert budget["token_budget"] == 16000
    lines = [json.loads(line) for line in (tmp_path / "eval.jsonl").read_text().splitlines()]
    assert len(lines) == 6
