---
schema_version: 2
id: 9
uuid: 019df5e7-52c2-7430-8cc3-655269cd0144
title: Upgrade local Go toolchain to 1.25 to match go.mod declaration
type: card
status: done
priority: p1
project: the-stacks
created: 2026-05-05
---

# Upgrade local Go toolchain to 1.25 to match go.mod declaration

## Why

`go.mod` declares `go 1.25.0` to match coda-lite's toolchain (the sibling Go projects in this stack are all on 1.25). The local `go` binary in this environment is `1.22.2`. Empty-main `go build ./...` passes via Go's forward-compatibility, but the moment we pull a dependency that uses 1.23+ stdlib features (any iter.Seq, range-over-func, etc.) the build will fail.

## Steps

1. Install Go 1.25.x (probably via `go install golang.org/dl/go1.25.0@latest && go1.25.0 download`, or the distro path)
2. Verify `go version` reports 1.25.x
3. Confirm `go build ./...` still works in `the-stacks`

## Done when

- Local `go version` >= 1.25.0
- `go build ./...` in this repo passes under 1.25
- The `toolchain` directive in `go.mod` (if any) is correct

## Notes

Surfaced 2026-05-05 during card #7 (bootstrap repo). The mismatch didn't bite because main.go is empty. Will bite during #5 when we pull sqlite-vec, an Ollama client, or anything else.

p1 because it's a blocker for #5.
