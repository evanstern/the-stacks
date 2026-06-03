CORPUS_VERSION ?= default-corpus
CORPUS_IDENTITY_MANIFEST ?= apps/api/corpus/default-dndbeyond-corpus.json
CORPUS_MANIFEST ?= ../.omo/corpus/default-dndbeyond-corpus.lock.json
ARCHIVE_ROOT ?= /data/uploads/sourcebooks
CORPUS_PYTHON ?= $(shell if [ -x .venv/bin/python ]; then printf '%s' '.venv/bin/python'; else printf '%s' 'python'; fi)
CORPUS_CLI = PYTHONPATH=apps/api $(CORPUS_PYTHON) -m app.cli.corpus_seed

.PHONY: compose-config up down test smoke smoke-public corpus-preflight corpus-lock corpus-seed-dry-run corpus-seed corpus-reset-dry-run corpus-reset-confirm corpus-verify

compose-config:
	docker compose config

up:
	docker compose up --build

down:
	docker compose down

test:
	@if command -v pytest >/dev/null 2>&1; then \
		pytest apps/api/tests; \
	else \
		docker compose run --rm api pytest tests; \
	fi

smoke:
	./scripts/smoke.sh

smoke-public:
	./scripts/smoke-public.sh

corpus-preflight:
	$(CORPUS_CLI) preflight

corpus-lock:
	$(CORPUS_CLI) lock --identity-manifest $(CORPUS_IDENTITY_MANIFEST) --archive-root $(ARCHIVE_ROOT) --output $(CORPUS_MANIFEST)

corpus-seed-dry-run:
	$(CORPUS_CLI) seed --dry-run --manifest $(CORPUS_MANIFEST) --archive-root $(ARCHIVE_ROOT) --version $(CORPUS_VERSION)

corpus-seed:
	$(CORPUS_CLI) seed --manifest $(CORPUS_MANIFEST) --archive-root $(ARCHIVE_ROOT) --version $(CORPUS_VERSION)

corpus-reset-dry-run:
	$(CORPUS_CLI) reset --version $(CORPUS_VERSION) --dry-run

corpus-reset-confirm:
	$(CORPUS_CLI) reset --version $(CORPUS_VERSION) --confirm-version $(CORPUS_VERSION)

corpus-verify:
	$(CORPUS_CLI) verify --manifest $(CORPUS_MANIFEST) --archive-root $(ARCHIVE_ROOT) --version $(CORPUS_VERSION)
