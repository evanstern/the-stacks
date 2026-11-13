import type { StreamItem } from "../stream.ts";

type Roll = Extract<StreamItem, { kind: "roll" }>;

/** A roll row (FR-008, FR-026): the summary line, expanding to dice, total and outcome. */
export function RollRow({ roll }: { roll: Roll }) {
  return (
    <details
      data-kind="roll"
      className="rounded-md border border-border px-2 py-1 text-sm"
    >
      <summary className="cursor-pointer break-words">{roll.summary}</summary>
      <div className="mt-1 flex flex-col gap-1 text-muted-foreground">
        {roll.dice.map((die) => (
          <p key={`${die.sides}-${die.faces.join(",")}-${die.kept.join(",")}`}>
            d{die.sides}:{" "}
            {faceKeys(die.faces).map(({ face, key }, j) =>
              die.kept[j] === false ? (
                <span key={key}>
                  {j > 0 && ", "}
                  <s>
                    {face}
                    <span className="sr-only">, dropped</span>
                  </s>
                </span>
              ) : (
                <span key={key}>
                  {j > 0 && ", "}
                  {face}
                </span>
              ),
            )}
          </p>
        ))}
        {roll.detail.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </details>
  );
}

/** Keys for a die's faces: the face plus its occurrence count, so repeated faces stay unique. */
function faceKeys(faces: number[]) {
  const seen = new Map<number, number>();
  return faces.map((face) => {
    const n = (seen.get(face) ?? 0) + 1;
    seen.set(face, n);
    return { face, key: `${face}-${n}` };
  });
}
