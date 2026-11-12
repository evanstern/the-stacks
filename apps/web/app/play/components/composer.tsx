import type { ActorRef } from "@the-stacks/intent";
import { type Ref, useState } from "react";
import { routeSend } from "../send.ts";
import type { TableCommands } from "../source.ts";
import type { ComposerView } from "../view-model.ts";

export type ComposerCommands = Pick<
  TableCommands,
  "sendIntent" | "sendTalk" | "declareAction" | "commit"
>;

const HINT_ID = "composer-hint";
const OOC_LABEL = "You (out of character)";
const isOocLine = (t: string) => /^\s*(\(\(|\/ooc(\s|$))/i.test(t);
const isAskLine = (t: string) =>
  /^\s*(@dm(?![\p{L}\p{N}_-])|\/ask(\s|$))/iu.test(t);

/**
 * The one composer (spec 066 FR-001 to FR-003, FR-022, FR-026). One Send. Every line goes
 * through `routeSend`; a parse refusal shows here and sends nothing.
 */
export function Composer({
  composer,
  commands,
  disabled,
  notice,
  thinking = false,
  inputRef,
}: {
  composer: ComposerView;
  commands: ComposerCommands;
  disabled: boolean;
  notice: string | null;
  /** "The DM is reading the table…" is showing (FR-025). */
  thinking?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState<number>(0);
  const [speakerOpen, setSpeakerOpen] = useState(false);
  const [mentionDismissed, setMentionDismissed] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [interrupting, setInterrupting] = useState(false);

  const speaker = composer.speakers[chosen] ?? composer.speakers[0];
  const lineOoc = isOocLine(text);
  const ooc = (speaker?.ooc ?? false) || lineOoc;
  // The character the line is for: the chosen one, else the first real speaker.
  const real =
    speaker && !speaker.ooc ? speaker : composer.speakers.find((s) => !s.ooc);
  const actor: ActorRef | null = real
    ? real.id === null
      ? { kind: "dm" }
      : { kind: "pc", id: real.id }
    : null;
  const shownLabel = lineOoc ? OOC_LABEL : (speaker?.label ?? OOC_LABEL);
  const empty = text.trim().length === 0;
  const mention = /(?:^|\s)@([\p{L}\p{N}_-]*)$/u.exec(text);
  const mentionOptions =
    mention && mentionDismissed !== text
      ? composer.mentions.filter((m) =>
          m.token.toLowerCase().startsWith(`@${mention[1]?.toLowerCase()}`),
        )
      : [];
  const characterSpeaker = !!real && real.id !== null && !ooc;
  const wouldInterrupt =
    thinking &&
    composer.mode === "free" &&
    characterSpeaker &&
    !isAskLine(text);

  function submit() {
    if (empty || disabled || !composer.canSend || !actor) return;
    setInterrupting(false);
    // The human DM's plain prose stays a `talk` line: no Intent kind carries a DM voice.
    if (composer.dm && !ooc && !/^\s*[/@*"(&$#]/.test(text)) {
      if (commands.sendTalk({ text, channel: "ic", characterId: null })) {
        setText("");
        setRefusal(null);
      }
      return;
    }
    const route = routeSend(text, {
      ooc: speaker?.ooc ?? false,
      actor,
      characterId: real?.id ?? null,
      mode: composer.mode,
      active: composer.active,
    });
    if (route.kind === "refused") {
      setRefusal(route.message);
      return;
    }
    setRefusal(null);
    let sent: boolean;
    if (route.kind === "declare-commit") {
      const actionId = `act-${crypto.randomUUID()}`;
      // OQ-3: back to back; the source keeps the first refusal.
      sent = commands.declareAction({ ...route.declare, actionId });
      if (sent) commands.commit({ actionId, authority: "active-player" });
    } else {
      sent = commands.sendIntent(route.intent);
    }
    if (sent) setText("");
  }

  return (
    <form
      aria-label="Composer"
      className="flex flex-col gap-2 border-t border-border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (wouldInterrupt && !interrupting) {
          setInterrupting(true);
          return;
        }
        submit();
      }}
    >
      <div className="relative flex gap-2">
        <div className="relative">
          <button
            type="button"
            aria-label="Speaker"
            aria-haspopup="listbox"
            aria-expanded={speakerOpen}
            disabled={composer.speakers.length < 2}
            onClick={() => setSpeakerOpen((o) => !o)}
            className="h-10 max-w-40 truncate rounded-md border border-border px-3 text-sm hover:bg-accent disabled:opacity-70"
          >
            {shownLabel}
          </button>
          {speakerOpen && (
            <div
              role="listbox"
              aria-label="Speaker"
              className="absolute bottom-11 left-0 z-10 min-w-48 rounded-md border border-border bg-card p-1 shadow"
            >
              {composer.speakers.map((s, i) => (
                <div
                  key={`${s.id ?? "none"}-${s.ooc}`}
                  role="option"
                  aria-selected={i === chosen}
                  tabIndex={0}
                  onClick={() => {
                    setChosen(i);
                    setSpeakerOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setChosen(i);
                      setSpeakerOpen(false);
                    }
                  }}
                  className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-accent aria-selected:font-medium"
                >
                  {s.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="relative flex-1">
          <input
            ref={inputRef}
            aria-label="Message"
            aria-describedby={composer.active ? HINT_ID : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setInterrupting(false);
            }}
            placeholder="Say something"
            className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
          />
          {mentionOptions.length > 0 && (
            <div
              role="listbox"
              aria-label="Mention"
              className="absolute bottom-11 left-0 z-10 min-w-48 rounded-md border border-border bg-card p-1 shadow"
            >
              {mentionOptions.map((m) => (
                <div
                  key={m.token}
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onClick={() =>
                    setText(text.replace(/@[\p{L}\p{N}_-]*$/u, `${m.token} `))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setText(
                        text.replace(/@[\p{L}\p{N}_-]*$/u, `${m.token} `),
                      );
                    } else if (e.key === "Escape") setMentionDismissed(text);
                  }}
                  className="cursor-pointer rounded px-2 py-1 text-sm hover:bg-accent"
                >
                  {m.token}{" "}
                  <span className="text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={disabled || empty || !composer.canSend}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {wouldInterrupt ? "Send — interrupts the DM" : "Send"}
        </button>
      </div>

      {interrupting && (
        <fieldset className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted p-2 text-sm">
          <legend className="sr-only">Interrupt the DM?</legend>
          <span aria-hidden="true">Interrupt the DM?</span>
          <button
            type="button"
            onClick={submit}
            className="rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground hover:bg-primary/90"
          >
            I'm sure
          </button>
          <button
            type="button"
            onClick={() => setInterrupting(false)}
            className="rounded-md border border-border px-3 py-1 hover:bg-accent"
          >
            Wait
          </button>
        </fieldset>
      )}
      {composer.active && (
        <p id={HINT_ID} className="text-xs text-muted-foreground">
          Enter commits your turn
        </p>
      )}
      {!composer.canSend && composer.hint && (
        <p className="text-xs text-muted-foreground">{composer.hint}</p>
      )}
      {(refusal ?? notice) && (
        <p role="alert" className="text-sm text-destructive">
          {refusal ?? notice}
        </p>
      )}
    </form>
  );
}
