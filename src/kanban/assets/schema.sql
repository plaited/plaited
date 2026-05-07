CREATE TABLE IF NOT EXISTS kanban_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'decomposed', 'closed', 'cancelled')),
  requested_by_actor_type TEXT NOT NULL CHECK (requested_by_actor_type IN ('agent', 'user', 'system')),
  requested_by_actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE ON UPDATE CASCADE,
  parent_work_item_id TEXT REFERENCES work_items(id) ON DELETE SET NULL ON UPDATE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'draft',
      'discovery_ready',
      'formulated',
      'red_pending',
      'red_approved',
      'green_pending',
      'review_pending',
      'merge_ready',
      'merged',
      'cleanup_pending',
      'cleaned',
      'blocked',
      'rejected'
    )
  ),
  spec_path TEXT,
  spec_commit_sha TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_items_request_id ON work_items (request_id);
CREATE INDEX IF NOT EXISTS idx_work_items_parent_work_item_id ON work_items (parent_work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items (status);

CREATE TABLE IF NOT EXISTS work_item_dependencies (
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  depends_on_work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (work_item_id, depends_on_work_item_id),
  CHECK (work_item_id <> depends_on_work_item_id)
);

CREATE INDEX IF NOT EXISTS idx_work_item_dependencies_work_item_id ON work_item_dependencies (work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_dependencies_depends_on_work_item_id
  ON work_item_dependencies (depends_on_work_item_id);

CREATE TABLE IF NOT EXISTS discovery_artifacts (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  artifact_version INTEGER NOT NULL CHECK (artifact_version > 0),
  rules TEXT NOT NULL CHECK (json_valid(rules) = 1 AND json_type(rules) = 'array'),
  examples TEXT NOT NULL CHECK (json_valid(examples) = 1 AND json_type(examples) = 'array'),
  open_questions TEXT NOT NULL CHECK (json_valid(open_questions) = 1 AND json_type(open_questions) = 'array'),
  out_of_scope TEXT NOT NULL CHECK (json_valid(out_of_scope) = 1 AND json_type(out_of_scope) = 'array'),
  collected_at TEXT NOT NULL,
  stale_after_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (
    strftime('%Y-%m-%dT%H:%M:%fZ', collected_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ', stale_after_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ', collected_at) = collected_at
    AND strftime('%Y-%m-%dT%H:%M:%fZ', stale_after_at) = stale_after_at
    AND julianday(stale_after_at) >= julianday(collected_at)
  ),
  UNIQUE (work_item_id, artifact_version)
);

CREATE INDEX IF NOT EXISTS idx_discovery_artifacts_work_item_id ON discovery_artifacts (work_item_id);
CREATE INDEX IF NOT EXISTS idx_discovery_artifacts_stale_after_at ON discovery_artifacts (stale_after_at);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  decision_kind TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'user', 'system')),
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_work_item_id ON decisions (work_item_id);
CREATE INDEX IF NOT EXISTS idx_decisions_decision_kind ON decisions (decision_kind);
CREATE INDEX IF NOT EXISTS idx_decisions_actor_type_actor_id ON decisions (actor_type, actor_id);

CREATE TABLE IF NOT EXISTS decision_evidence_cache_refs (
  decision_id TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  context_db_path TEXT NOT NULL,
  evidence_cache_row_id INTEGER NOT NULL CHECK (evidence_cache_row_id > 0),
  PRIMARY KEY (decision_id, context_db_path, evidence_cache_row_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_evidence_cache_refs_decision_id
  ON decision_evidence_cache_refs (decision_id);

CREATE TABLE IF NOT EXISTS work_item_events (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  event_kind TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json) = 1),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_work_item_events_work_item_id ON work_item_events (work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_events_occurred_at ON work_item_events (occurred_at);

CREATE TRIGGER IF NOT EXISTS trg_work_item_events_no_update
BEFORE UPDATE ON work_item_events
WHEN EXISTS (SELECT 1 FROM work_items WHERE id = OLD.work_item_id)
BEGIN
  SELECT RAISE(ABORT, 'work_item_events is append-only');
END;

CREATE TRIGGER IF NOT EXISTS trg_work_item_events_no_delete
BEFORE DELETE ON work_item_events
WHEN EXISTS (SELECT 1 FROM work_items WHERE id = OLD.work_item_id)
BEGIN
  SELECT RAISE(ABORT, 'work_item_events is append-only');
END;
