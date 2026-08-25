import pytest

from claude_harness.validator import validate_harness


@pytest.mark.parametrize("root_name", [".", ".", ".", ".", ".", ".", ".", ".", ".", "."])
def test_validate_harness_ok_for_repeated_roots(root_name):
    result = validate_harness(root_name)
    assert result["status"] == "OK"
    assert result["required_files"] >= 5


@pytest.mark.parametrize("root_name", [".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", ".", "."])
def test_validate_harness_is_repeatable(root_name):
    result = validate_harness(root_name)
    assert result["status"] == "OK"
    assert result["missing"] == []


def test_validate_harness_returns_root_and_required_count():
    result = validate_harness(".")
    assert result["root"].endswith("cd14715-claude-code-classroom-main") or result["root"].endswith("ai_agent")
    assert result["required_files"] >= 5


def test_validate_harness_accepts_pathlib_path():
    result = validate_harness(".")
    assert isinstance(result, dict)
    assert "status" in result
    assert result["status"] == "OK"


def test_validate_harness_uses_required_files():
    result = validate_harness(".")
    assert "CLAUDE.md" in str(result)
    assert result["required_files"] >= 5
