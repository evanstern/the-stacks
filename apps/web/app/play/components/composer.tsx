import { useState } from "react";
import type { DeclareInput, TalkInput } from "../source.ts";
import type { ComposerView } from "../view-model.ts";

type MessageType = "talk" | "action";

function Radio({
  name,
  value,
  checked,
  disabled,
  label,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm ${
        checked ? "bg-accent font-medium" : ""
      } ${disabled ? "opacity-50" : "cursor-pointer hover:bg-accent"}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      {label}
    </label>
  );
}

export function Composer({
  composer,
  onTalk,
  onDeclare,
  disabled,
  notice,
  initialType = "talk",
}: {
  composer: ComposerView;
  onTalk: (input: TalkInput) => boolean;
  onDeclare: (input: DeclareInput) => boolean;
  disabled: boolean;
  notice: string | null;
  /** Initial message type; a test seam, the table always starts on Talk. */
  initialType?: MessageType;
}) {
  const [type, setType] = useState<MessageType>(initialType);
  const [channel, setChannel] = useState<"ic" | "ooc">("ic");
  const [scope, setScope] = useState<"character" | "party">("character");
  const [chosen, setChosen] = useState<string | null>(null);
  const [text, setText] = useState("");

  const characterId =
    composer.characters.find((c) => c.characterId === chosen)?.characterId ??
    composer.characters[0]?.characterId ??
    null;
  const effectiveType: MessageType = composer.actionAvailable ? type : "talk";
  const empty = text.trim().length === 0;

  function submit() {
    if (empty || disabled) return;
    const sent =
      effectiveType === "talk"
        ? onTalk({
            text,
            channel,
            characterId: channel === "ic" ? characterId : null,
          })
        : onDeclare({
            text,
            scope,
            characterId: scope === "character" ? characterId : null,
          });
    if (sent) setText("");
  }

  return (
    <form
      aria-label="Composer"
      className="flex flex-col gap-2 border-t border-border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Message type"
          className="flex flex-wrap gap-2"
        >
          <Radio
            name="message-type"
            value="talk"
            label="Talk"
            checked={effectiveType === "talk"}
            onChange={() => setType("talk")}
          />
          <Radio
            name="message-type"
            value="action"
            label="Action"
            checked={effectiveType === "action"}
            disabled={!composer.actionAvailable}
            onChange={() => setType("action")}
          />
        </div>

        {effectiveType === "talk" ? (
          <div
            role="radiogroup"
            aria-label="Channel"
            className="flex flex-wrap gap-2"
          >
            <Radio
              name="channel"
              value="ic"
              label="In character"
              checked={channel === "ic"}
              onChange={() => setChannel("ic")}
            />
            <Radio
              name="channel"
              value="ooc"
              label="Out of character"
              checked={channel === "ooc"}
              onChange={() => setChannel("ooc")}
            />
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label="Scope"
            className="flex flex-wrap gap-2"
          >
            <Radio
              name="scope"
              value="character"
              label="This character"
              checked={scope === "character"}
              onChange={() => setScope("character")}
            />
            <Radio
              name="scope"
              value="party"
              label="Whole party"
              checked={scope === "party"}
              onChange={() => setScope("party")}
            />
          </div>
        )}

        {composer.characters.length > 0 &&
          (effectiveType === "action" || channel === "ic") && (
            <select
              aria-label="Character"
              value={characterId ?? ""}
              onChange={(e) => setChosen(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {composer.characters.map((c) => (
                <option key={c.characterId} value={c.characterId}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
      </div>

      <div className="flex gap-2">
        <input
          aria-label={effectiveType === "talk" ? "Message" : "Action"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            effectiveType === "talk" ? "Say something" : "Describe your action"
          }
          className="h-10 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
        />
        <button
          type="submit"
          disabled={disabled || empty}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {effectiveType === "talk" ? "Send" : "Declare"}
        </button>
      </div>

      {!composer.actionAvailable && composer.actionHint && (
        <p className="text-xs text-muted-foreground">{composer.actionHint}</p>
      )}
      {notice && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}
    </form>
  );
}
