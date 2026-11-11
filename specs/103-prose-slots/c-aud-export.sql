-- C-AUD read-only export of B2 session bb4952dc (specs/103-prose-slots/plan.md "C-AUD replay").
\set sid '''bb4952dc-8600-48e8-a15f-2f4cf154625d'''
SELECT json_build_object(
  'sessionId', :sid,
  'events', (SELECT coalesce(json_agg(json_build_object(
      'seq', seq, 'actor', actor, 'type', type, 'payload', payload,
      'payloadVersion', payload_version, 'visibility', visibility, 'ts', ts) ORDER BY seq), '[]')
    FROM events WHERE session_id = :sid::uuid),
  'jobs', (SELECT coalesce(json_agg(json_build_object(
      'id', id, 'kind', kind, 'status', status, 'attempts', attempts, 'input', input,
      'result', result, 'createdAt', created_at, 'finishedAt', finished_at) ORDER BY created_at), '[]')
    FROM jobs WHERE session_id = :sid::uuid AND kind IN ('turn', 'floor', 'companion', 'chronicle')),
  'calls', (SELECT coalesce(json_agg(json_build_object(
      'jobId', job_id, 'purpose', purpose, 'promptVersion', prompt_version,
      'callAttempt', call_attempt, 'outcome', outcome) ORDER BY id), '[]')
    FROM dm_model_calls WHERE session_id = :sid::uuid)
);
