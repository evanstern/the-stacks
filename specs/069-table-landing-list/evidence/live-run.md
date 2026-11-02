# Live run: Table landing list (TASK-0175, spec 069 Phase 3)

Stack `stacks-task-0175`, `DM_FAKE_SCRIPT=greyhollow-live` (boot log: `DM script mode: greyhollow-live (9 calls, 1 dice)`), Brave headless, no provider key. Script: `shoot.mjs`.

```
PASS step 2 player2 redeemed and signed in
PASS step 4 operator lists B before A (newest first): B@0 A@1
PASS step 4 operator rows carry scene titles
PASS step 4 player2 lists A only, marked player (1 rows)
PASS step 4 player2 never lists B
PASS step 4 GET /api/tables with no cookie is 401
PASS step 4 operator landing links B then A
PASS step 4 player2 landing links A and not B
PASS (8) no-modal at operator|player2 x 1280|390 x light|dark: 0 dialogs
PASS step 5 entry navigates to /play/<sessionId>
```

Shots: `shots/landing-<operator|player2>-<1280|390>-<light|dark>.png` (eight files). The dark shots were read by eye: titles, relation and time are legible.

Note: the operator's rows read "Player" because the operator was also seated in both tables (precedence dm > player > started).
