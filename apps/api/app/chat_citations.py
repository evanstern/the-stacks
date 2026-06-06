import re
from collections.abc import Sequence
from typing import Protocol, TypeVar, cast


class CitationContext(Protocol):
    @property
    def chunk_id(self) -> str: ...


class GeneratedCitationAnswer(Protocol):
    @property
    def answer(self) -> str: ...

    @property
    def cited_chunk_ids(self) -> list[str]: ...


ContextT = TypeVar("ContextT", bound=CitationContext)


_CITATION_MARKER_RE = re.compile(r"\[(\d+)\]")
_BRACKET_TOKEN_RE = re.compile(r"\[([^\[\]]+)\]")


def _retrieval_metadata_with_final_citations(
    metadata: dict[str, object], cited_contexts: Sequence[CitationContext]
) -> dict[str, object]:
    trace = metadata.get("trace")
    if not isinstance(trace, dict):
        return metadata
    updated_trace = dict(cast(dict[str, object], trace))
    updated_trace["final_citation_choices"] = [
        {"label": f"[{index}]", "document_chunk_id": context.chunk_id}
        for index, context in enumerate(cited_contexts, start=1)
    ]
    return {**metadata, "trace": updated_trace}


def _validated_citations(
    generation: GeneratedCitationAnswer, contexts: Sequence[ContextT]
) -> list[ContextT]:
    by_id = {context.chunk_id: context for context in contexts}
    cited: list[ContextT] = []
    seen_chunk_ids: set[str] = set()
    invalid_citation_seen = False
    for chunk_id in generation.cited_chunk_ids:
        context = by_id.get(_normalize_generated_citation_id(chunk_id))
        if context is None:
            invalid_citation_seen = True
            continue
        if context.chunk_id not in seen_chunk_ids:
            cited.append(context)
            seen_chunk_ids.add(context.chunk_id)

    marker_contexts = _contexts_from_inline_markers(generation.answer, contexts)
    if marker_contexts:
        marker_ids = {context.chunk_id for context in marker_contexts}
        cited_ids = {context.chunk_id for context in cited}
        if not invalid_citation_seen or marker_ids.issubset(cited_ids):
            return marker_contexts

    if invalid_citation_seen:
        return []
    return cited


def _contexts_from_inline_markers(
    answer: str, contexts: Sequence[ContextT]
) -> list[ContextT]:
    marker_tokens = [
        match.group(1).strip() for match in _BRACKET_TOKEN_RE.finditer(answer)
    ]
    if not marker_tokens:
        return []

    zero_marker_seen = any(token == 0 for token in _numeric_marker_tokens(answer))
    cited: list[ContextT] = []
    seen_chunk_ids: set[str] = set()
    for raw_token in marker_tokens:
        context = _context_from_inline_marker(raw_token, contexts, zero_marker_seen)
        if context is None:
            return []
        if context.chunk_id not in seen_chunk_ids:
            cited.append(context)
            seen_chunk_ids.add(context.chunk_id)
    return cited


def _context_from_inline_marker(
    raw_token: str, contexts: Sequence[ContextT], zero_marker_seen: bool
) -> ContextT | None:
    token = _normalize_generated_citation_id(raw_token)
    if token.isdigit():
        context_index = _context_index_from_numeric_marker(int(token), zero_marker_seen)
        if context_index is None or context_index >= len(contexts):
            return None
        return contexts[context_index]

    matching_contexts = [
        context
        for context in contexts
        if context.chunk_id == token or context.chunk_id.startswith(token)
    ]
    if len(matching_contexts) == 1:
        return matching_contexts[0]
    return None


def _numeric_marker_tokens(answer: str) -> list[int]:
    tokens: list[int] = []
    for match in _BRACKET_TOKEN_RE.finditer(answer):
        token = match.group(1).strip()
        if not token.isdigit():
            continue
        tokens.append(int(token))
    return tokens


def _context_index_from_numeric_marker(
    token: int, zero_marker_seen: bool
) -> int | None:
    if token == 0:
        return 0 if zero_marker_seen else None
    return token - 1


def _has_unsupported_citation_placement(answer: str) -> bool:
    if not answer.strip():
        return True
    if _has_duplicate_adjacent_citation_marker(answer):
        return True
    for line in answer.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("```"):
            continue
        if stripped.count("|") >= 2:
            continue
        if _contains_invalid_bracket_token(stripped):
            return True
    return False


def _has_duplicate_adjacent_citation_marker(answer: str) -> bool:
    previous_label: str | None = None
    previous_end = -1
    for match in _CITATION_MARKER_RE.finditer(answer):
        label = match.group(1)
        if (
            label == previous_label
            and answer[previous_end : match.start()].strip() == ""
        ):
            return True
        previous_label = label
        previous_end = match.end()
    return False


def _contains_invalid_bracket_token(line: str) -> bool:
    for match in _BRACKET_TOKEN_RE.finditer(line):
        token = match.group(1).strip()
        if token.isdigit():
            continue
        return True
    return False


def _repair_citation_markers(
    answer: str,
    cited_contexts: Sequence[CitationContext],
    contexts: Sequence[CitationContext],
) -> str | None:
    if not _BRACKET_TOKEN_RE.search(answer):
        if not cited_contexts:
            return answer
        labels = "".join(
            f"[{index}]" for index, _ in enumerate(cited_contexts, start=1)
        )
        return f"{answer.rstrip()} {labels}"

    repaired_parts: list[str] = []
    last_index = 0
    zero_marker_seen = any(token == 0 for token in _numeric_marker_tokens(answer))
    for match in _BRACKET_TOKEN_RE.finditer(answer):
        repaired_parts.append(answer[last_index : match.start()])
        token = _normalize_generated_citation_id(match.group(1))
        numeric_label = int(token) if token.isdigit() else None
        if numeric_label is not None:
            context_index = _context_index_from_numeric_marker(
                numeric_label, zero_marker_seen
            )
            if context_index is None or context_index >= len(contexts):
                return None
            label = _label_for_context(contexts[context_index], cited_contexts)
            if label is None:
                return None
            repaired_parts.append(f"[{label}]")
        else:
            label = _label_for_citation_token(token, cited_contexts)
            if label is None:
                return None
            repaired_parts.append(f"[{label}]")
        last_index = match.end()
    repaired_parts.append(answer[last_index:])
    return "".join(repaired_parts)


def _label_for_context(
    target_context: CitationContext, cited_contexts: Sequence[CitationContext]
) -> int | None:
    for index, context in enumerate(cited_contexts, start=1):
        if context.chunk_id == target_context.chunk_id:
            return index
    return None


def _label_for_citation_token(
    token: str, cited_contexts: Sequence[CitationContext]
) -> int | None:
    matching_labels = [
        index
        for index, context in enumerate(cited_contexts, start=1)
        if context.chunk_id == token or context.chunk_id.startswith(token)
    ]
    if len(matching_labels) == 1:
        return matching_labels[0]
    return None


def _normalize_generated_citation_id(chunk_id: str) -> str:
    normalized = chunk_id.strip()
    if normalized.startswith("chunk_id="):
        return normalized.removeprefix("chunk_id=").strip()
    return normalized


def _citation_markers_match_contexts(
    answer: str, cited_contexts: Sequence[CitationContext]
) -> bool:
    marker_labels: list[int] = []
    seen_labels: set[int] = set()
    for match in _CITATION_MARKER_RE.finditer(answer):
        label = int(match.group(1))
        if label not in seen_labels:
            seen_labels.add(label)
            marker_labels.append(label)
    if not marker_labels:
        return not cited_contexts
    expected_labels = list(range(1, len(cited_contexts) + 1))
    return marker_labels == expected_labels
