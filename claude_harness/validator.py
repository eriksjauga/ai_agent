"""Simple validator for the repo-scoped Claude harness configuration."""

from __future__ import annotations

from pathlib import Path


def validate_harness(root: str | Path) -> dict:
    """Validate mandatory root config and .claude structure."""
    root_path = Path(root).resolve()
    required = [
        root_path / 'CLAUDE.md',
        root_path / '.claude' / 'rules' / 'core.md',
        root_path / '.claude' / 'rules' / 'typescript.md',
        root_path / '.claude' / 'rules' / 'python.md',
        root_path / '.claude' / 'commands' / 'project-scan.md',
    ]
    missing = [str(path.relative_to(root_path)) for path in required if not path.exists()]
    if missing:
        raise FileNotFoundError(f'Missing harness files: {missing}')

    claude_file = (root_path / 'CLAUDE.md').read_text(encoding='utf-8')
    if '@import' not in claude_file:
        raise ValueError('CLAUDE.md is missing @import directives.')

    return {
        'status': 'OK',
        'root': str(root_path),
        'required_files': len(required),
        'missing': missing,
        'required': [str(path.relative_to(root_path)) for path in required],
    }
