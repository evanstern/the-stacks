import type { Database } from "../db/connection.js";
import { createId, parseJson, stringifyJson, type JsonValue } from "../db/rows.js";

type Row = Record<string, unknown>;

export type ReviewItem = {
  id: string;
  corpusId: string;
  targetType: "source" | "document" | "section" | "import_proposal";
  targetId: string;
  status: "pending" | "suggested" | "approved" | "rejected" | "deferred";
  title: string;
  summary: string | null;
  metadata: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type ReviewSuggestion = {
  id: string;
  reviewItemId: string;
  suggestionState: "suggested_approve" | "suggested_reject" | "suggested_defer";
  rationale: string;
  model: string;
  promptVersion: string;
  confidence: number | null;
  metadata: JsonValue;
  createdAt: string;
};

export type ReviewDecision = {
  id: string;
  reviewItemId: string;
  suggestionId: string | null;
  decisionState: "approved" | "rejected" | "deferred";
  rationale: string | null;
  actor: string;
  decidedAt: string;
  metadata: JsonValue;
};

export type ReviewQueueItem = ReviewItem & {
  latestSuggestion: ReviewSuggestion | null;
  latestDecision: ReviewDecision | null;
};

function mapReviewItem(row: Row): ReviewItem {
  return {
    id: row.id as string,
    corpusId: row.corpus_id as string,
    targetType: row.target_type as ReviewItem["targetType"],
    targetId: row.target_id as string,
    status: row.status as ReviewItem["status"],
    title: row.title as string,
    summary: (row.summary as string | null) ?? null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapSuggestion(row: Row): ReviewSuggestion {
  return {
    id: row.id as string,
    reviewItemId: row.review_item_id as string,
    suggestionState: row.suggestion_state as ReviewSuggestion["suggestionState"],
    rationale: row.rationale as string,
    model: row.model as string,
    promptVersion: row.prompt_version as string,
    confidence: (row.confidence as number | null) ?? null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at as string,
  };
}

function mapDecision(row: Row): ReviewDecision {
  return {
    id: row.id as string,
    reviewItemId: row.review_item_id as string,
    suggestionId: (row.suggestion_id as string | null) ?? null,
    decisionState: row.decision_state as ReviewDecision["decisionState"],
    rationale: (row.rationale as string | null) ?? null,
    actor: row.actor as string,
    decidedAt: row.decided_at as string,
    metadata: parseJson(row.metadata_json, {}),
  };
}

export function createReviewRepository(db: Database) {
  return {
    createReviewItem(input: {
      id?: string;
      corpusId: string;
      targetType: ReviewItem["targetType"];
      targetId: string;
      status?: ReviewItem["status"];
      title: string;
      summary?: string | null;
      metadata?: JsonValue;
    }): ReviewItem {
      const id = input.id ?? createId("review_item");
      db.prepare(`
        INSERT INTO review_items (id, corpus_id, target_type, target_id, status, title, summary, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.corpusId,
        input.targetType,
        input.targetId,
        input.status ?? "pending",
        input.title,
        input.summary ?? null,
        stringifyJson(input.metadata, {}),
      );
      return this.getReviewItem(id)!;
    },

    getReviewItem(id: string): ReviewItem | null {
      const row = db.prepare("SELECT * FROM review_items WHERE id = ?").get(id) as Row | undefined;
      return row ? mapReviewItem(row) : null;
    },

    listReviewItems(corpusId: string, status?: ReviewItem["status"]): ReviewItem[] {
      const rows = status
        ? db.prepare("SELECT * FROM review_items WHERE corpus_id = ? AND status = ? ORDER BY created_at").all(corpusId, status)
        : db.prepare("SELECT * FROM review_items WHERE corpus_id = ? ORDER BY created_at").all(corpusId);
      return (rows as Row[]).map(mapReviewItem);
    },

    listPendingQueue(corpusId: string): ReviewQueueItem[] {
      const items = (db.prepare(`
        SELECT * FROM review_items
        WHERE corpus_id = ? AND status IN ('pending', 'suggested', 'deferred')
        ORDER BY updated_at DESC, created_at DESC
      `).all(corpusId) as Row[]).map(mapReviewItem);

      return items.map((item) => ({
        ...item,
        latestSuggestion: this.getLatestSuggestion(item.id),
        latestDecision: this.getLatestDecision(item.id),
      }));
    },

    createSuggestion(input: {
      id?: string;
      reviewItemId: string;
      suggestionState: ReviewSuggestion["suggestionState"];
      rationale: string;
      model: string;
      promptVersion: string;
      confidence?: number | null;
      metadata?: JsonValue;
    }): ReviewSuggestion {
      const id = input.id ?? createId("review_suggestion");
      db.prepare(`
        INSERT INTO review_suggestions (
          id, review_item_id, suggestion_state, rationale, model, prompt_version, confidence, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.reviewItemId,
        input.suggestionState,
        input.rationale,
        input.model,
        input.promptVersion,
        input.confidence ?? null,
        stringifyJson(input.metadata, {}),
      );
      db.prepare("UPDATE review_items SET status = 'suggested', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'pending'").run(
        input.reviewItemId,
      );
      return this.getSuggestion(id)!;
    },

    getSuggestion(id: string): ReviewSuggestion | null {
      const row = db.prepare("SELECT * FROM review_suggestions WHERE id = ?").get(id) as Row | undefined;
      return row ? mapSuggestion(row) : null;
    },

    listSuggestions(reviewItemId: string): ReviewSuggestion[] {
      return (db.prepare("SELECT * FROM review_suggestions WHERE review_item_id = ? ORDER BY created_at").all(reviewItemId) as Row[]).map(
        mapSuggestion,
      );
    },

    getLatestSuggestion(reviewItemId: string): ReviewSuggestion | null {
      const row = db.prepare("SELECT * FROM review_suggestions WHERE review_item_id = ? ORDER BY created_at DESC LIMIT 1").get(reviewItemId) as
        | Row
        | undefined;
      return row ? mapSuggestion(row) : null;
    },

    createDecision(input: {
      id?: string;
      reviewItemId: string;
      suggestionId?: string | null;
      decisionState: ReviewDecision["decisionState"];
      rationale?: string | null;
      actor: string;
      metadata?: JsonValue;
    }): ReviewDecision {
      const id = input.id ?? createId("review_decision");
      db.prepare(`
        INSERT INTO review_decisions (id, review_item_id, suggestion_id, decision_state, rationale, actor, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.reviewItemId,
        input.suggestionId ?? null,
        input.decisionState,
        input.rationale ?? null,
        input.actor,
        stringifyJson(input.metadata, {}),
      );
      db.prepare("UPDATE review_items SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(
        input.decisionState,
        input.reviewItemId,
      );
      return this.getDecision(id)!;
    },

    getDecision(id: string): ReviewDecision | null {
      const row = db.prepare("SELECT * FROM review_decisions WHERE id = ?").get(id) as Row | undefined;
      return row ? mapDecision(row) : null;
    },

    listDecisions(reviewItemId: string): ReviewDecision[] {
      return (db.prepare("SELECT * FROM review_decisions WHERE review_item_id = ? ORDER BY decided_at").all(reviewItemId) as Row[]).map(
        mapDecision,
      );
    },

    getLatestDecision(reviewItemId: string): ReviewDecision | null {
      const row = db.prepare("SELECT * FROM review_decisions WHERE review_item_id = ? ORDER BY decided_at DESC LIMIT 1").get(reviewItemId) as
        | Row
        | undefined;
      return row ? mapDecision(row) : null;
    },
  };
}
