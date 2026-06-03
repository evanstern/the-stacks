from importlib import import_module

corpus_seed = import_module("app.cli.corpus_seed")


def test_preflight_passes_when_upstream_lifecycle_primitives_exist() -> None:
    results = corpus_seed.run_preflight()

    names = [result.name for result in results]
    details = "\n".join(result.detail for result in results)
    assert names == [check.name for check in corpus_seed.PREFLIGHT_CHECKS]
    assert "upload batches" in details
    assert "runtime versions" in details
    assert "active pointer" in details
    assert "dry-run teardown" in details
    assert "version-scoped" in details


def test_preflight_fails_closed_with_prerequisite_plan_reference() -> None:
    def missing_primitive() -> str:
        raise RuntimeError("simulated missing active pointer")

    checks = [corpus_seed.PreflightCheck("active pointer", missing_primitive)]

    try:
        _ = corpus_seed.run_preflight(checks)
    except corpus_seed.PreflightError as exc:
        assert corpus_seed.PREREQUISITE_PLAN in str(exc)
        assert "simulated missing active pointer" in str(exc)
        assert exc.failures[0].name == "active pointer"
    else:
        raise AssertionError("preflight did not fail closed for a missing primitive")


def test_preflight_cli_reports_success(capsys) -> None:
    exit_code = corpus_seed.main(["preflight"])

    captured = capsys.readouterr()
    assert exit_code == 0
    assert "OK upload batches" in captured.out
    assert "OK runtime lifecycle" in captured.out
    assert captured.err == ""


def test_preflight_cli_exits_nonzero_on_missing_primitive(monkeypatch, capsys) -> None:
    def fail_preflight():
        raise corpus_seed.PreflightError([corpus_seed.PreflightFailure("immutable archives", "simulated missing primitive")])

    monkeypatch.setattr(corpus_seed, "run_preflight", fail_preflight)

    exit_code = corpus_seed.main(["preflight"])

    captured = capsys.readouterr()
    assert exit_code == 1
    assert corpus_seed.PREREQUISITE_PLAN in captured.err
    assert "simulated missing primitive" in captured.err


def test_cli_help_lists_preflight(capsys) -> None:
    try:
        _ = corpus_seed.main(["--help"])
    except SystemExit as exc:
        assert exc.code == 0
    else:
        raise AssertionError("argparse help did not exit")

    captured = capsys.readouterr()
    assert "preflight" in captured.out
