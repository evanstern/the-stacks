COMPOSE ?= docker compose
CORPUS_VERSION ?= default-corpus
CORPUS_IDENTITY_MANIFEST ?= apps/api/corpus/default-dndbeyond-corpus.json
CORPUS_MANIFEST ?= ../.omo/corpus/default-dndbeyond-corpus.lock.json
ARCHIVE_ROOT ?= /data/uploads/sourcebooks
CORPUS_PYTHON ?= $(shell if [ -x .venv/bin/python ]; then printf '%s' '.venv/bin/python'; elif command -v python3 >/dev/null 2>&1; then printf '%s' 'python3'; else printf '%s' 'python'; fi)
CORPUS_CLI = PYTHONPATH=apps/api $(CORPUS_PYTHON) -m app.cli.corpus_seed
EVAL_EMBEDDINGS_PYTHON ?= $(CORPUS_PYTHON)
EVAL_EMBEDDINGS_PROVIDER ?= deterministic
EVAL_EMBEDDINGS_FORMAT ?= json
EVAL_EMBEDDINGS_TOP_K ?= 3
EVAL_EMBEDDINGS_FIXTURE ?= apps/api/tests/fixtures/embeddings/gold.fixture.json
EVAL_EMBEDDINGS_ARGS ?=

.PHONY: compose-config up down test smoke smoke-public etl-live-smoke eval-embeddings corpus-preflight corpus-lock corpus-seed-dry-run corpus-seed corpus-reset-dry-run corpus-reset-confirm corpus-verify corpus-doctor

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
		docker compose run --rm --no-deps -T -v "$${PWD}:/workspace" -w /workspace api pytest apps/api/tests; \
	fi

smoke:
	./scripts/smoke.sh

smoke-public:
	./scripts/smoke-public.sh

etl-live-smoke:
	docker compose up -d --wait postgres qdrant
	docker compose run --rm -T --build \
		-e PYTHONPATH=/app \
		-e DATABASE_URL=postgresql+psycopg://thestacks:thestacks@postgres:5432/thestacks \
		-e QDRANT_URL=http://qdrant:6333 \
		-e QDRANT_COLLECTION=$${QDRANT_COLLECTION:-etl_live_smoke_chunks} \
		-v "$${PWD}/scripts:/app/scripts:ro" \
		api python scripts/etl_live_smoke.py

eval-embeddings:
	$(EVAL_EMBEDDINGS_PYTHON) scripts/eval_embeddings.py \
		--fixture $(EVAL_EMBEDDINGS_FIXTURE) \
		--provider $(EVAL_EMBEDDINGS_PROVIDER) \
		--format $(EVAL_EMBEDDINGS_FORMAT) \
		--top-k $(EVAL_EMBEDDINGS_TOP_K) \
		$(EVAL_EMBEDDINGS_ARGS)

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

corpus-doctor:
	@if ! $(COMPOSE) ps --status running --services | grep -qx api; then \
		printf '%s\n' 'corpus-doctor requires the compose api service to be running.' >&2; \
		printf '%s\n' 'Start the target stack first, then rerun make corpus-doctor.' >&2; \
		printf '%s\n' 'Start production with: docker compose -f docker-compose.prod.yml --env-file .env.production up -d --wait api worker web' >&2; \
		printf '%s\n' 'Then run: make corpus-doctor COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"' >&2; \
		exit 1; \
	fi
	@if ! $(COMPOSE) exec -T api python -m app.cli.corpus_seed --help 2>&1 | grep -qw doctor; then \
		printf '%s\n' 'The running api container does not include the corpus doctor command.' >&2; \
		printf '%s\n' 'Rebuild/recreate the api service with the latest code, then rerun corpus-doctor.' >&2; \
		printf '%s\n' 'Production rebuild: docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build --force-recreate api worker web' >&2; \
		exit 1; \
	fi
	$(COMPOSE) exec -T api python -m app.cli.corpus_seed doctor --check-qdrant
