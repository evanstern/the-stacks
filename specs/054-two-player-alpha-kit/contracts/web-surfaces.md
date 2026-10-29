# Contract: web surfaces

No modal anywhere. Slide-outs use `apps/web/app/components/panel.tsx` (the `Sheet` wrapper).
`apps/web/test/no-dialog.test.mjs` stays green.

## Sign-in card: redeem toggle

Shown to every signed-out visitor, on every route (the root gate renders the card).

- The card shows a `Have an invitation?` button under the sign-in form.
- Pressing it swaps the card in place: title `Redeem an invitation`; fields `Invitation token`,
  `Username`, `Display name`, `Password` (`autocomplete="new-password"`); a `Create account`
  submit button; a `Back to sign in` button.
- Submit stays disabled until the page is hydrated, as sign-in does.
- The token is trimmed before submit. It never enters the URL.
- Submit calls `POST /auth/invitations/redeem`. On 201 the app revalidates and the visitor lands
  signed in as a player.
- Failure messages show inline with `role="alert"`:
  - 400 with a `token` issue: `This invitation is invalid, expired, or already redeemed.`
  - 409: `That username is already taken.`
  - 400 with other issues: each issue message.
  - anything else: `Something went wrong. Try again.`

## Settings: Invite a player

Shown only when the signed-in user's role is `operator`.

- Section heading `Invite a player`.
- A number field `Expires in (days)`, default 7, minimum 1, maximum 30.
- A `Create invitation` button. It calls `POST /auth/invitations` with `{ expiresInDays }`.
- On 201: a read-only field holding the token, a `Copy` button, the text
  `Expires <local date and time>.`, and the note
  `This token shows once. Send it to the player by a private channel.`
- The token is held only in component state. Creating another replaces it.
- A failure shows `Could not create an invitation.` inline.

## Play route: Start scene slide-out

Shown only when the signed-in user is the operator, the table is live (not a fixture), replay
has caught up, and the session has no scene.

- The table header shows a `Start scene` button. It opens a right-hand slide-out titled
  `Start scene`.
- On open, the slide-out calls `GET /dm/seeds` and offers a `Seed` select (title, then id).
- For each human seat of the chosen seed, a select labelled with the character name offers the
  humans present at the table (`displayName`), from the live presence list, plus an empty choice.
- A note lists the seed's AI companions by name.
- `Start` stays disabled until every seat has a user and no user holds two seats.
- `Start` calls `POST /dm/sessions/:sessionId/start` with `{ seedId, seats }`.
- On 202: the slide-out closes and the header shows `Scene start queued.` until the scene event
  arrives.
- A 400 shows each issue message inline beside its seat, or under the form when the path is
  not a seat. A 409 shows its message inline.
- When a seated user leaves the table, their choice stays; the server accepts it.

Amendment, TASK-0167 (additive, 2026-10-28): "Play route: Start scene slide-out".

The `Start scene` button shows only while the server's scene-start state is `none`. While the state
is `queued`, the header shows `Scene start queued.` While it is `pending` (a human DM has not yet
carried out the suggestion), the header shows `Scene start waiting for the DM.` The header polls the
state every 5 s while it is `queued` or `pending`. Detail:
`specs/059-start-scene-queued/contracts/scene-start-state.md`.
