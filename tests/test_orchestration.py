import pytest

from orchestration.recovery import filter_defects, hot_state_size, run_shift_artifact


@pytest.mark.parametrize(
    "rows, allowed, expected",
    [
        ([{"id": "D-1", "status": "open"}], {"open"}, [{"id": "D-1", "status": "open"}]),
        ([{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "closed"}], {"open"}, [{"id": "D-1", "status": "open"}]),
        ([{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "open"}], {"open"}, [{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "open"}]),
        ([{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "triaged"}], {"open", "triaged"}, [{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "triaged"}]),
        ([{"id": "D-1", "status": "closed"}], {"open"}, []),
        ([{"id": "D-1", "status": "open", "severity": "critical"}], {"open"}, [{"id": "D-1", "status": "open", "severity": "critical"}]),
        ([{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "open"}, {"id": "D-3", "status": "closed"}], {"open"}, [{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "open"}]),
        ([{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "open"}, {"id": "D-3", "status": "open"}], {"open"}, [{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "open"}, {"id": "D-3", "status": "open"}]),
        ([{"id": "D-1", "status": "triaged"}], {"triaged"}, [{"id": "D-1", "status": "triaged"}]),
        ([{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "triaged"}], {"open"}, [{"id": "D-1", "status": "open"}]),
        ([{"id": "D-1", "status": "closed"}, {"id": "D-2", "status": "triaged"}], {"open", "triaged"}, [{"id": "D-2", "status": "triaged"}]),
    ],
)
def test_filter_defects_sql_ready(rows, allowed, expected):
    filtered = filter_defects(rows, allowed)
    assert filtered == expected


@pytest.mark.parametrize(
    "rows, expected_upper_bound",
    [
        ([{"id": "D-1", "status": "open"}], 5000),
        ([{"id": "D-1", "status": "open"}, {"id": "D-2", "status": "open"}], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(5)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(10)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(15)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(20)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(25)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(30)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(40)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(50)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(60)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(70)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(80)], 5000),
        ([{"id": "D-1", "status": "open"} for _ in range(90)], 5000),
    ],
)
def test_hot_state_size_under_5_kb(rows, expected_upper_bound):
    size = hot_state_size(rows)
    assert size < expected_upper_bound


def test_shift_run_output_has_recovery_and_fork_isolation(tmp_path):
    artifact = run_shift_artifact(tmp_path)
    assert artifact["recovery"]["recovered"] is True
    assert artifact["fork_isolation"]["isolated"] is True
    assert artifact["hot_state_size_bytes"] < 5000


def test_shift_run_writes_json_file(tmp_path):
    artifact = run_shift_artifact(tmp_path)
    assert (tmp_path / "shift_run.json").exists()
    assert artifact["filtered_defects"]


def test_recovery_metadata_and_fork_ids_are_stable():
    artifact = run_shift_artifact(".")
    assert artifact["recovery"]["outcome"] == "retry_and_continue"
    assert artifact["fork_isolation"]["fork_id"] == "fork-7"
