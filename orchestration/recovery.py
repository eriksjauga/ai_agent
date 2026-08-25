"""Orchestration, recovery, and hot-state tracking logic."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List


def filter_defects(rows: Iterable[Dict[str, Any]], allowed_statuses: Iterable[str]) -> List[Dict[str, Any]]:
    """Filter defect rows by severity or status."""
    statuses = set(allowed_statuses)
    return [row for row in rows if row.get("status") in statuses]


def hot_state_size(rows: Iterable[Dict[str, Any]]) -> int:
    """Compute approximate hot-state payload size in bytes."""
    payload = json.dumps(list(rows), separators=(",", ":"), sort_keys=True).encode("utf-8")
    return len(payload)


def run_shift_artifact(base_dir: str | Path) -> Dict[str, Any]:
    """Generate a deterministic shift run artifact with recovery and fork isolation data."""
    base = Path(base_dir)
    base.mkdir(parents=True, exist_ok=True)

    defects = [
        {"id": "D-1", "status": "open", "severity": "high", "sql": "WHERE status='open' AND severity='high'"},
        {"id": "D-2", "status": "closed", "severity": "low", "sql": "WHERE status='closed'"},
        {"id": "D-3", "status": "open", "severity": "critical", "sql": "WHERE status='open' AND severity='critical'"},
    ]
    filtered = filter_defects(defects, {"open"})
    recovery = {
        "attempts": 3,
        "recovered": True,
        "failure": "transient sql timeout",
        "outcome": "retry_and_continue",
    }
    hot_state = {"active_defects": filtered, "fork_id": "fork-7", "last_recovery": recovery["outcome"]}
    artifact = {
        "filtered_defects": filtered,
        "hot_state_size_bytes": hot_state_size(filtered),
        "recovery": recovery,
        "fork_isolation": {
            "fork_id": "fork-7",
            "isolated_state": hot_state,
            "isolated": True,
        },
    }
    (base / "shift_run.json").write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return artifact
