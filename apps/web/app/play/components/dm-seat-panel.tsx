import { useState } from "react";
import { Label } from "~/components/ui/label";
import type { DmSeatView } from "../dm-seat.ts";
import { dmSeatReason } from "../frames.ts";
import type { DmSeatInput } from "../source.ts";

export const DM_SEAT_PANEL_ID = "dm-seat-panel";

const BUTTON =
  "rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";
const FIELD =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

/** The seat request for a picked user; a blank reason gets the default. */
export function seatInput(userId: string, reason: string): DmSeatInput {
  return {
    reason: reason.trim() || dmSeatReason("seat"),
    after: { kind: "human", userId },
  };
}

/** The request that returns the seat to the AI DM. */
export function returnInput(reason: string): DmSeatInput {
  return {
    reason: reason.trim() || dmSeatReason("return"),
    after: { kind: "ai" },
  };
}

/** The operator's DM seat body. Renders inside the shared slide-out `Panel`. */
export function DmSeatPanel({
  view,
  onSeat,
}: {
  view: DmSeatView;
  onSeat: (input: DmSeatInput) => boolean;
}) {
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState("");
  const done = (ok: boolean) => {
    if (ok) {
      setReason("");
      setPicked("");
    }
  };
  const { holder, candidates } = view;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {holder.kind === "ai" ? "AI DM" : holder.label} holds the seat.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dm-seat-reason">Reason (optional)</Label>
        <textarea
          id="dm-seat-reason"
          rows={2}
          className={FIELD}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      {candidates === null && (
        <p className="text-sm text-muted-foreground">
          Waiting for the people at the table.
        </p>
      )}
      {candidates?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No one else at the table can take the seat.
        </p>
      )}
      {candidates && candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="dm-seat-pick">Seat a human DM</Label>
          <select
            id="dm-seat-pick"
            className={FIELD}
            value={picked}
            onChange={(event) => setPicked(event.target.value)}
          >
            <option value="">Choose a person</option>
            {candidates.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${BUTTON} self-start`}
            disabled={picked === ""}
            onClick={() => done(onSeat(seatInput(picked, reason)))}
          >
            Seat as DM
          </button>
        </div>
      )}
      {view.canReturn && (
        <div className="flex flex-col gap-1">
          {view.pendingCount !== null && view.pendingCount > 0 && (
            <p className="text-sm">
              Pending proposals stay pending under the AI DM:{" "}
              {view.pendingCount}. Decide them first.
            </p>
          )}
          <button
            type="button"
            className={`${BUTTON} self-start`}
            onClick={() => done(onSeat(returnInput(reason)))}
          >
            Return the seat to the AI DM
          </button>
        </div>
      )}
    </div>
  );
}
