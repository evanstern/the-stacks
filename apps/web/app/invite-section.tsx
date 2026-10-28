import { useState } from "react";
import { type IssuedInvitation, issueInvitation } from "./auth";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";

const FAILED = "Could not create an invitation.";

export type CreateResult =
  | { ok: true; invitation: IssuedInvitation }
  | { ok: false; message: string };

/** Create an invitation; any failure maps to one inline message. */
export async function createInvitation(
  expiresInDays: number,
): Promise<CreateResult> {
  try {
    return { ok: true, invitation: await issueInvitation(expiresInDays) };
  } catch {
    return { ok: false, message: FAILED };
  }
}

/**
 * Operator-only (research R8). The token lives in component state only:
 * creating another replaces it, leaving the page drops it.
 */
export function InviteSection({
  initialInvitation = null,
  initialError = null,
}: {
  initialInvitation?: IssuedInvitation | null;
  initialError?: string | null;
}) {
  const [days, setDays] = useState(7);
  const [invitation, setInvitation] = useState(initialInvitation);
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setPending(true);
    setError(null);
    setCopied(false);
    const result = await createInvitation(days);
    if (result.ok) setInvitation(result.invitation);
    else setError(result.message);
    setPending(false);
  }

  async function copy() {
    if (!invitation) return;
    try {
      await navigator.clipboard.writeText(invitation.token);
      setCopied(true);
    } catch {
      // The field is selectable; copying by hand still works.
    }
  }

  return (
    <section className="mt-8 flex max-w-sm flex-col gap-3">
      <h2 className="text-base font-semibold">Invite a player</h2>
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-days">Expires in (days)</Label>
        <Input
          id="invite-days"
          type="number"
          min={1}
          max={30}
          value={days}
          onChange={(event) => setDays(Number(event.target.value))}
        />
      </div>
      <Button type="button" onClick={create} disabled={pending}>
        Create invitation
      </Button>
      {invitation && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              readOnly
              aria-label="Invitation token"
              value={invitation.token}
              onFocus={(event) => event.target.select()}
            />
            <Button type="button" variant="outline" onClick={copy}>
              Copy
            </Button>
          </div>
          {copied && <p className="text-sm">Copied.</p>}
          <p className="text-sm">
            Expires {new Date(invitation.expiresAt).toLocaleString()}.
          </p>
          <p className="text-sm text-muted-foreground">
            This token shows once. Send it to the player by a private channel.
          </p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
