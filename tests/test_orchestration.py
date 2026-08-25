from orchestration.recovery import filter_defects, hot_state_size, run_shift_artifact


def test_filter_defects_sql_ready():
    defects = [
        {"id": "D-1", "status": "open", "severity": "high"},
        {"id": "D-2", "status": "closed", "severity": "low"},
    ]
    filtered = filter_defects(defects, {"open"})
    assert len(filtered) == 1
    assert filtered[0]["id"] == "D-1"


def test_hot_state_size_under_5_kb():
    defects = [{"id": f"D-{i}", "status": "open", "severity": "high"} for i in range(20)]
    size = hot_state_size(defects)
    assert size < 5000


def test_shift_run_output_has_recovery_and_fork_isolation(tmp_path):
    artifact = run_shift_artifact(tmp_path)
    assert artifact["recovery"]["recovered"] is True
    assert artifact["fork_isolation"]["isolated"] is True
    assert artifact["hot_state_size_bytes"] < 5000
