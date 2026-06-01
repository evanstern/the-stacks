.PHONY: compose-config up down test smoke

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
