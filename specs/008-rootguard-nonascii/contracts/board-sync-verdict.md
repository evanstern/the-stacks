# Contract: board-sync verdict (`classifyBoardSyncCommit`)

Signature (unchanged): `classifyBoardSyncCommit(args, effDir, realProjectDir)`.

Returns one of:

| Result | When |
|---|---|
| `{ ok: true }` | every explicit pathspec, or with none every staged path, is under `backlog/` |
| `{ ok: false, reason: 'staged-outside', token }` | a staged path is outside `backlog/`; `token` is that path **verbatim** (no C-quoting) |
| `{ ok: false, reason: 'pathspec-outside', token }` | an explicit pathspec is outside `backlog/` |
| `{ ok: false, reason: 'nothing-staged' }` | no pathspecs and an empty staged set |
| `{ ok: false, reason: 'staged-query-failed' }` | the git query exits nonzero |

The only behavioral change: staged paths are read verbatim, so non-ASCII
`backlog/` paths now return `{ ok: true }`, and `token` is human-readable.
