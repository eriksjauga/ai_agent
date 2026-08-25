from claude_harness.validator import validate_harness


def test_validate_harness_ok():
    result = validate_harness('.')
    assert result['status'] == 'OK'
    assert result['required_files'] >= 5
