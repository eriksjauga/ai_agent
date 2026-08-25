import json

import pytest

from context_strategy.strategy import answer_quality, compute_context_reduction, write_eval_artifacts


@pytest.mark.parametrize(
    ("original_tokens", "reduced_tokens", "expected_min"),
    [
        (32000, 16000, 50.0),
        (10000, 5000, 50.0),
        (5000, 2500, 50.0),
        (1200, 400, 66.67),
        (2000, 1000, 50.0),
        (8000, 2000, 75.0),
        (600, 0, 100.0),
        (0, 0, 0.0),
        (500, 500, 0.0),
    ],
)
def test_context_reduction_values(original_tokens, reduced_tokens, expected_min):
    result = compute_context_reduction(original_tokens, reduced_tokens)
    assert result >= expected_min


@pytest.mark.parametrize(
    "rows, expected_answered, expected_rate",
    [
        ([{"answered": True, "correct": True}], 1, 100.0),
        ([{"answered": True, "correct": False}], 1, 100.0),
        ([{"answered": False, "correct": False}], 0, 0.0),
        ([{"answered": True, "correct": True}, {"answered": True, "correct": True}], 2, 100.0),
        ([{"answered": True, "correct": True}, {"answered": False, "correct": False}], 1, 50.0),
        ([{"answered": True, "correct": True}, {"answered": True, "correct": False}, {"answered": True, "correct": True}], 3, 100.0),
        ([{"answered": True, "correct": True}, {"answered": True, "correct": True}, {"answered": False, "correct": False}], 2, 66.67),
        ([{"answered": True, "correct": True}, {"answered": True, "correct": True}, {"answered": True, "correct": True}], 3, 100.0),
    ],
)
def test_answer_quality_summary(rows, expected_answered, expected_rate):
    summary = answer_quality(rows)
    assert summary["answered"] == expected_answered
    assert summary["answer_rate"] >= expected_rate


def test_write_eval_artifacts_produces_budget_and_eval_outputs(tmp_path):
    result = write_eval_artifacts(tmp_path)
    assert result["budget"]["context_reduction_pct"] >= 50.0
    assert (tmp_path / "budget.json").exists()
    assert (tmp_path / "eval.jsonl").exists()
    assert (tmp_path / "eval_control.jsonl").exists()

    budget = json.loads((tmp_path / "budget.json").read_text())
    assert budget["token_budget"] == 16000
    lines = [json.loads(line) for line in (tmp_path / "eval.jsonl").read_text().splitlines()]
    assert len(lines) == 6
    assert result["quality"]["answered"] >= 5
    assert result["quality"]["answer_rate"] >= 80.0


def test_budget_and_quality_are_consistent():
    result = write_eval_artifacts(".")
    assert result["budget"]["baseline_tokens"] == 32000
    assert result["budget"]["max_context_tokens"] == 16000
    assert result["quality"]["questions_answered"] >= 5


def test_control_file_is_emitted_for_regression_tracking(tmp_path):
    result = write_eval_artifacts(tmp_path)
    lines = [json.loads(line) for line in (tmp_path / "eval_control.jsonl").read_text().splitlines()]
    assert any(row.get("control_regression") for row in lines)
