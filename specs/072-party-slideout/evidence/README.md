# Spec 072 evidence: Party slide-out in Brave

- Date: 2026-11-02
- App commit: e9235d69 (Phases 1 and 2; the app image was rebuilt from this tree)
- Browser: Brave headless, CDP, Node built-ins only
- Fixture: `turn-mode-combat?as=<Ana>&through=21` (mid-combat, Bram's turn active)
- Command: `node specs/072-party-slideout/evidence/shoot.mjs .handoff/072-operator.json`
  (credentials file is gitignored; local-stack operator)

Shots: `shots/party-{1280,390}-{light,dark}.png`

```
PASS sign-in
PASS 1280-light party trigger present
PASS 1280-light panel open
PASS 1280-light initiative order with active turn
PASS 1280-light "Your character" badge
PASS 1280-light "AI companion" label
PASS 1280-light no dialog/aria-modal (count 0)
PASS 1280-light no page scroll (scrollHeight 800 <= innerHeight 800)
PASS 1280-dark party trigger present
PASS 1280-dark panel open
PASS 1280-dark initiative order with active turn
PASS 1280-dark "Your character" badge
PASS 1280-dark "AI companion" label
PASS 1280-dark no dialog/aria-modal (count 0)
PASS 1280-dark no page scroll (scrollHeight 800 <= innerHeight 800)
PASS 390-light party trigger present
PASS 390-light panel open
PASS 390-light initiative order with active turn
PASS 390-light "Your character" badge
PASS 390-light "AI companion" label
PASS 390-light no dialog/aria-modal (count 0)
PASS 390-light no page scroll (scrollHeight 844 <= innerHeight 844)
PASS 390-dark party trigger present
PASS 390-dark panel open
PASS 390-dark initiative order with active turn
PASS 390-dark "Your character" badge
PASS 390-dark "AI companion" label
PASS 390-dark no dialog/aria-modal (count 0)
PASS 390-dark no page scroll (scrollHeight 844 <= innerHeight 844)
```
