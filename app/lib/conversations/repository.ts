import type { Database } from "../db/connection.js";
import { createId, parseJson, rowToBoolean, stringifyJson, type JsonValue } from "../db/rows.js";

type Row = Record<string, unknown>;

export type Conversation = {
  id: string;
  corpusId: string;
  title: string | null;
  status: string;
  metadata: JsonValue;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  model: string | null;
  metadata: JsonValue;
  createdAt: string;
};

export type RetrievalRun = {
  id: string;
  conversationId: string | null;
  messageId: string | null;
  corpusId: string;
  query: string;
  retrievalMode: string;
  retrievedChunks: string[];
  scores: JsonValue;
  modelInputs: JsonValue;
  promptContextHash: string | null;
  finalAnswer: string | null;
  noEvidence: boolean;
  createdAt: string;
};

export type Citation = {
  id: string;
  retrievalRunId: string;
  messageId: string | null;
  chunkId: string | null;
  documentId: string | null;
  sourceId: string | null;
  ordinal: number;
  quote: string | null;
  rationale: string | null;
  metadata: JsonValue;
  createdAt: string;
};

export type WorkflowRun = {
  id: string;
  corpusId: string | null;
  workflowKind: string;
  threadId: string;
  status: string;
  targetType: string | null;
  targetId: string | null;
  inputRefs: JsonValue;
  outputRefs: JsonValue;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapConversation(row: Row): Conversation {
  return {
    id: row.id as string,
    corpusId: row.corpus_id as string,
    title: (row.title as string | null) ?? null,
    status: row.status as string,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapMessage(row: Row): Message {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as Message["role"],
    content: row.content as string,
    model: (row.model as string | null) ?? null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at as string,
  };
}

function mapRetrievalRun(row: Row): RetrievalRun {
  return {
    id: row.id as string,
    conversationId: (row.conversation_id as string | null) ?? null,
    messageId: (row.message_id as string | null) ?? null,
    corpusId: row.corpus_id as string,
    query: row.query as string,
    retrievalMode: row.retrieval_mode as string,
    retrievedChunks: parseJson(row.retrieved_chunks_json, []),
    scores: parseJson(row.scores_json, {}),
    modelInputs: parseJson(row.model_inputs_json, {}),
    promptContextHash: (row.prompt_context_hash as string | null) ?? null,
    finalAnswer: (row.final_answer as string | null) ?? null,
    noEvidence: rowToBoolean(row.no_evidence),
    createdAt: row.created_at as string,
  };
}

function mapCitation(row: Row): Citation {
  return {
    id: row.id as string,
    retrievalRunId: row.retrieval_run_id as string,
    messageId: (row.message_id as string | null) ?? null,
    chunkId: (row.chunk_id as string | null) ?? null,
    documentId: (row.document_id as string | null) ?? null,
    sourceId: (row.source_id as string | null) ?? null,
    ordinal: row.ordinal as number,
    quote: (row.quote as string | null) ?? null,
    rationale: (row.rationale as string | null) ?? null,
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at as string,
  };
}

function mapWorkflowRun(row: Row): WorkflowRun {
  return {
    id: row.id as string,
    corpusId: (row.corpus_id as string | null) ?? null,
    workflowKind: row.workflow_kind as string,
    threadId: row.thread_id as string,
    status: row.status as string,
    targetType: (row.target_type as string | null) ?? null,
    targetId: (row.target_id as string | null) ?? null,
    inputRefs: parseJson(row.input_refs_json, []),
    outputRefs: parseJson(row.output_refs_json, []),
    error: (row.error as string | null) ?? null,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createConversationRepository(db: Database) {
  return {
    createConversation(input: { id?: string; corpusId: string; title?: string | null; status?: string; metadata?: JsonValue }): Conversation {
      const id = input.id ?? createId("conversation");
      db.prepare("INSERT INTO conversations (id, corpus_id, title, status, metadata_json) VALUES (?, ?, ?, ?, ?)").run(
        id,
        input.corpusId,
        input.title ?? null,
        input.status ?? "active",
        stringifyJson(input.metadata, {}),
      );
      return this.getConversation(id)!;
    },

    getConversation(id: string): Conversation | null {
      const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Row | undefined;
      return row ? mapConversation(row) : null;
    },

    addMessage(input: { id?: string; conversationId: string; role: Message["role"]; content: string; model?: string | null; metadata?: JsonValue }): Message {
      const id = input.id ?? createId("message");
      db.prepare("INSERT INTO messages (id, conversation_id, role, content, model, metadata_json) VALUES (?, ?, ?, ?, ?, ?)").run(
        id,
        input.conversationId,
        input.role,
        input.content,
        input.model ?? null,
        stringifyJson(input.metadata, {}),
      );
      db.prepare("UPDATE conversations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(input.conversationId);
      return this.getMessage(id)!;
    },

    getMessage(id: string): Message | null {
      const row = db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Row | undefined;
      return row ? mapMessage(row) : null;
    },

    listMessages(conversationId: string): Message[] {
      return (db.prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at").all(conversationId) as Row[]).map(mapMessage);
    },

    createRetrievalRun(input: {
      id?: string;
      conversationId?: string | null;
      messageId?: string | null;
      corpusId: string;
      query: string;
      retrievalMode: string;
      retrievedChunks?: string[];
      scores?: JsonValue;
      modelInputs?: JsonValue;
      promptContextHash?: string | null;
      finalAnswer?: string | null;
      noEvidence?: boolean;
    }): RetrievalRun {
      const id = input.id ?? createId("retrieval");
      db.prepare(`
        INSERT INTO retrieval_runs (
          id, conversation_id, message_id, corpus_id, query, retrieval_mode, retrieved_chunks_json,
          scores_json, model_inputs_json, prompt_context_hash, final_answer, no_evidence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.conversationId ?? null,
        input.messageId ?? null,
        input.corpusId,
        input.query,
        input.retrievalMode,
        stringifyJson(input.retrievedChunks, []),
        stringifyJson(input.scores, {}),
        stringifyJson(input.modelInputs, {}),
        input.promptContextHash ?? null,
        input.finalAnswer ?? null,
        input.noEvidence ? 1 : 0,
      );
      return this.getRetrievalRun(id)!;
    },

    getRetrievalRun(id: string): RetrievalRun | null {
      const row = db.prepare("SELECT * FROM retrieval_runs WHERE id = ?").get(id) as Row | undefined;
      return row ? mapRetrievalRun(row) : null;
    },

    createCitation(input: {
      id?: string;
      retrievalRunId: string;
      messageId?: string | null;
      chunkId?: string | null;
      documentId?: string | null;
      sourceId?: string | null;
      ordinal: number;
      quote?: string | null;
      rationale?: string | null;
      metadata?: JsonValue;
    }): Citation {
      const id = input.id ?? createId("citation");
      db.prepare(`
        INSERT INTO citations (
          id, retrieval_run_id, message_id, chunk_id, document_id, source_id, ordinal, quote, rationale, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.retrievalRunId,
        input.messageId ?? null,
        input.chunkId ?? null,
        input.documentId ?? null,
        input.sourceId ?? null,
        input.ordinal,
        input.quote ?? null,
        input.rationale ?? null,
        stringifyJson(input.metadata, {}),
      );
      return this.getCitation(id)!;
    },

    getCitation(id: string): Citation | null {
      const row = db.prepare("SELECT * FROM citations WHERE id = ?").get(id) as Row | undefined;
      return row ? mapCitation(row) : null;
    },

    listCitations(retrievalRunId: string): Citation[] {
      return (db.prepare("SELECT * FROM citations WHERE retrieval_run_id = ? ORDER BY ordinal").all(retrievalRunId) as Row[]).map(mapCitation);
    },

    createWorkflowRun(input: {
      id?: string;
      corpusId?: string | null;
      workflowKind: string;
      threadId: string;
      status: string;
      targetType?: string | null;
      targetId?: string | null;
      inputRefs?: JsonValue;
      outputRefs?: JsonValue;
      error?: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
    }): WorkflowRun {
      const id = input.id ?? createId("workflow");
      db.prepare(`
        INSERT INTO workflow_runs (
          id, corpus_id, workflow_kind, thread_id, status, target_type, target_id,
          input_refs_json, output_refs_json, error, started_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.corpusId ?? null,
        input.workflowKind,
        input.threadId,
        input.status,
        input.targetType ?? null,
        input.targetId ?? null,
        stringifyJson(input.inputRefs, []),
        stringifyJson(input.outputRefs, []),
        input.error ?? null,
        input.startedAt ?? null,
        input.finishedAt ?? null,
      );
      return this.getWorkflowRun(id)!;
    },

    getWorkflowRun(id: string): WorkflowRun | null {
      const row = db.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(id) as Row | undefined;
      return row ? mapWorkflowRun(row) : null;
    },

    listWorkflowRunsForTarget(input: { targetType: string; targetId: string }): WorkflowRun[] {
      return (db.prepare("SELECT * FROM workflow_runs WHERE target_type = ? AND target_id = ? ORDER BY created_at").all(
        input.targetType,
        input.targetId,
      ) as Row[]).map(mapWorkflowRun);
    },

    updateWorkflowRun(input: {
      id: string;
      status: string;
      outputRefs?: JsonValue;
      error?: string | null;
      finishedAt?: string | null;
    }): WorkflowRun {
      db.prepare(`
        UPDATE workflow_runs
        SET status = ?, output_refs_json = COALESCE(?, output_refs_json), error = ?,
            finished_at = COALESCE(?, finished_at), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `).run(input.status, input.outputRefs ? stringifyJson(input.outputRefs, []) : null, input.error ?? null, input.finishedAt ?? null, input.id);
      return this.getWorkflowRun(input.id)!;
    },
  };
}
