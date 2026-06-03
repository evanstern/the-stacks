"""Tests that README.md documents the default corpus seed workflow correctly."""

from pathlib import Path

import pytest

README = Path(__file__).resolve().parent.parent.parent.parent / "README.md"
MAKEFILE = Path(__file__).resolve().parent.parent.parent.parent / "Makefile"

REQUIRED_MAKE_TARGETS = [
    "corpus-preflight",
    "corpus-lock",
    "corpus-seed-dry-run",
    "corpus-seed",
    "corpus-reset-dry-run",
    "corpus-reset-confirm",
    "corpus-verify",
]


@pytest.fixture()
def readme_text() -> str:
    return README.read_text(encoding="utf-8")


@pytest.fixture()
def makefile_text() -> str:
    return MAKEFILE.read_text(encoding="utf-8")


def test_documented_make_targets_exist(readme_text: str, makefile_text: str) -> None:
    for target in REQUIRED_MAKE_TARGETS:
        assert target in readme_text, f"README missing Make target: {target}"
        assert f"{target}:" in makefile_text or f"{target} " in makefile_text, (
            f"Makefile missing target: {target}"
        )


def test_docs_include_corpus_safety_warnings(readme_text: str) -> None:
    assert "must not be downloaded" in readme_text.lower() or "not be downloaded by the tool" in readme_text.lower(), (
        "README must warn that archives are not downloaded"
    )
    assert "committed to the repository" in readme_text.lower() or "not be committed" in readme_text.lower(), (
        "README must warn that archives must not be committed"
    )
    assert "never mutate the active" in readme_text.lower() or "activation is a separate" in readme_text.lower(), (
        "README must state that seed/reset does not auto-activate"
    )


def test_docs_reference_archive_filenames(readme_text: str) -> None:
    for filename in ("phb-2014.zip", "dmg-2014.zip", "mm-2014.zip"):
        assert filename in readme_text, f"README missing archive filename: {filename}"


def test_docs_reference_env_vars(readme_text: str) -> None:
    for var in ("CORPUS_VERSION", "CORPUS_IDENTITY_MANIFEST", "CORPUS_MANIFEST", "ARCHIVE_ROOT"):
        assert var in readme_text, f"README missing env var: {var}"


def test_docs_include_troubleshooting(readme_text: str) -> None:
    for term in ("Missing archive", "Hash mismatch", "Active-version refusal", "Count mismatch", "Prerequisite failure"):
        assert term in readme_text, f"README missing troubleshooting entry: {term}"
