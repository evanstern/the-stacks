# Paperclip runner image for the-stacks agents (INF-20, CTO rulings INF-23 R1-R4).
# Base is Debian 12 (bookworm); Paperclip's own runtime is Debian 13 but this image only
# needs the same CLIs (node/pnpm/backlog/uv/specify/docker CLI), not the same OS release.
# Docker is NOT installed as a daemon here: the CLI talks to the dind sidecar
# (see docker-compose.yml). Published ports are reached at the DOCKER_HOST
# hostname, which scripts/env.mjs derives (spec 127).
# uv pin: stage name, because COPY --from cannot expand variables.
ARG UV_VERSION=0.13.10
FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

FROM node:22-bookworm

ARG BACKLOG_VERSION=1.57.4
ARG SPEC_KIT_TAG=v0.12.5
ARG PRAXISFLUX_TAG=v1.0.2

RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates python3 python3-pip pipx gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && (type gh >/dev/null 2>&1 || (curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /etc/apt/keyrings/gh.gpg \
        && echo "deb [signed-by=/etc/apt/keyrings/gh.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/gh.list \
        && apt-get update && apt-get install -y --no-install-recommends gh)) \
    && rm -rf /var/lib/apt/lists/*

# pnpm pinned by package.json packageManager; pre-warm so no run-time download.
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

# backlog CLI, exact pin (R2). Upgrades need a CTO ruling.
RUN npm install -g backlog.md@${BACKLOG_VERSION}

# uv/uvx, exact pin (INF-30). Static binaries from the official image.
COPY --from=uv /uv /uvx /usr/local/bin/

# spec-kit CLI, tag pin (R3). Never run `specify init`; repo .specify/ is canonical.
ENV PIPX_HOME=/opt/pipx PIPX_BIN_DIR=/usr/local/bin
RUN pipx install "git+https://github.com/github/spec-kit.git@${SPEC_KIT_TAG}" --pip-args=--no-cache-dir \
    && python3 --version \
    && specify --version | grep -F "${SPEC_KIT_TAG#v}"

# praxisflux marketplace clone at the CI-matching tag (R4).
RUN git clone --depth 1 --branch ${PRAXISFLUX_TAG} https://github.com/evanstern/praxisflux.git /opt/praxisflux
ENV PRAXISFLUX_HOME=/opt/praxisflux
# Plugins load via env, independent of Paperclip's per-run CLAUDE_CONFIG_DIR (CTO ruling R5).
ENV CLAUDE_CODE_PLUGIN_DIRS=/opt/praxisflux/pdlc:/opt/praxisflux/spec-bridge:/opt/praxisflux/grounding-wiki:/opt/praxisflux/team-review

# Default for the local reference pod (shared netns). On vm-104 the agent DinD
# sidecar has its own network namespace and Paperclip overrides this with
# DOCKER_HOST=tcp://dind:2376 + TLS (infinitynode.media TASK-101).
ENV DOCKER_HOST=tcp://localhost:2375
