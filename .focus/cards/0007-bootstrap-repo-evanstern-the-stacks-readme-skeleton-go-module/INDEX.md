---
schema_version: 2
id: 7
uuid: 019df5c3-a6e0-7956-8118-1a406c3552d5
title: 'Bootstrap repo: evanstern/the-stacks, README skeleton, Go module init'
type: card
status: done
priority: p1
project: the-stacks
created: 2026-05-05
---

# Bootstrap repo: evanstern/the-stacks

The repo doesn't exist yet. This card brings it into being.

## Steps

1. **Create the repo on GitHub.** `evanstern/the-stacks`, probably public from the start (this is a portfolio piece). Ask Evan whether public-from-start or private-until-M1.
2. **Local clone + Go module.** `go mod init github.com/evanstern/the-stacks`. Go 1.25 to match coda-lite's toolchain.
3. **Initial commit:** - LICENSE (MIT, matches coda-lite) - README.md skeleton with the architectural pitch (sourced
     from `designs/the-stacks.md` "Why this exists" section,
     adapted for outside readers)
   - `.gitignore` for Go + sqlite + asciinema - `cmd/the-stacks/main.go` — empty main - `designs/the-stacks.md` — copy from this orch's designs/
4. **Migrate the focus board into the repo.** When the repo is cloned locally, run `focus init` in the repo root and move these seven cards into it. Annie's `~/agents/annie/.focus/` becomes obsolete — the project repo's `.focus/` is the real board.

## Done when

- `evanstern/the-stacks` exists on GitHub
- Local clone has a working `go build ./...`
- README has the architectural pitch (not just a stub)
- LICENSE, .gitignore, designs/ all in place
- The cards in this board are migrated to the repo's `.focus/`

## Notes

This card is the bridge between "Annie was scaffolded under ~/agents/" and "Annie owns a real GitHub repo." After this lands, Annie's working directory shifts to the repo, not her config dir.

Ask Evan before pushing — naming, visibility, and any account- level decisions are his to make.
