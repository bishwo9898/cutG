SHELL := /bin/sh

.DEFAULT_GOAL := help

.PHONY: help setup up down restart status logs migrate seed dev test reset wait-for-postgres

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Install dependencies, prepare the environment, and initialize local data
	pnpm install --config.confirmModulesPurge=false
	@test -f .env || cp .env.example .env
	$(MAKE) up
	$(MAKE) wait-for-postgres
	$(MAKE) migrate
	$(MAKE) seed

up: ## Start PostgreSQL, Redis, and private object storage
	docker compose up -d postgres redis minio minio-init

down: ## Stop local containers without deleting data
	docker compose down

restart: ## Restart PostgreSQL, Redis, and private object storage
	docker compose restart postgres redis minio

status: ## Show container status and health
	docker compose ps

logs: ## Follow PostgreSQL, Redis, and MinIO logs
	docker compose logs -f postgres redis minio minio-init

migrate: ## Apply database migrations
	pnpm db:migrate

seed: ## Recreate development seed data
	pnpm db:seed

dev: ## Start the API, web, and AI worker development servers
	pnpm dev

test: ## Start the test database and run the test suite
	docker compose up -d --wait postgres-test
	pnpm test

reset: ## Delete local data, recreate infrastructure, migrate, and seed
	@printf "This deletes local PostgreSQL, Redis, and MinIO data. Continue? [y/N] "; \
	read answer; \
	case "$$answer" in \
		y|Y|yes|YES) ;; \
		*) printf "Reset cancelled.\n"; exit 0 ;; \
	esac; \
	docker compose down --volumes; \
	$(MAKE) up; \
	$(MAKE) wait-for-postgres; \
	$(MAKE) migrate; \
	$(MAKE) seed

wait-for-postgres:
	@printf "Waiting for PostgreSQL"
	@until docker compose exec -T postgres pg_isready -U barber_user -d barber_saas >/dev/null 2>&1; do \
		printf "."; \
		sleep 1; \
	done
	@printf " ready.\n"
