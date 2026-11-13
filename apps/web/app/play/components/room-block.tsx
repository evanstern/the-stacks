import type { StreamItem } from "../stream.ts";

type Room = Extract<StreamItem, { kind: "room" }>;

/** A scene start (FR-008): heading, description, ways on as plain text, and the party. */
export function RoomBlock({ room }: { room: Room }) {
  return (
    <section
      data-kind="room"
      className="rounded-md border border-border bg-card p-3 text-sm"
    >
      <h3 className="font-semibold">{room.heading}</h3>
      {room.description && <p className="mt-1">{room.description}</p>}
      {room.ways.length > 0 && (
        <p className="mt-1">
          Ways on: {room.ways.map((w) => w.label).join(", ")}
        </p>
      )}
      <p className="mt-1 text-muted-foreground">{room.party}</p>
    </section>
  );
}
