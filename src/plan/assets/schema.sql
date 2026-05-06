CREATE TABLE IF NOT EXISTS plan_migrations (
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
  execution_branch_ref TEXT,
  execution_worktree_path TEXT,
  execution_target_ref TEXT,
  execution_prepared_at TEXT,
  cleanup_branch_prune_after_at TEXT,
  cleanup_worktree_removed_at TEXT,
  cleanup_branch_pruned_at TEXT,
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

CREATE TABLE IF NOT EXISTS gate_decisions (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  gate_name TEXT NOT NULL CHECK (
    gate_name IN ('formulation', 'red_approval', 'frontier_verification', 'merge_simulation')
  ),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'user', 'system')),
  actor_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  discovery_artifact_id TEXT REFERENCES discovery_artifacts(id) ON DELETE SET NULL ON UPDATE CASCADE,
  discovery_artifact_updated_at_snapshot TEXT,
  spec_commit_sha TEXT,
  drift_stale_approval_decision_id TEXT REFERENCES gate_decisions(id) ON DELETE SET NULL ON UPDATE CASCADE,
  drift_signature TEXT,
  decided_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (work_item_id, gate_name, decided_at)
);

CREATE INDEX IF NOT EXISTS idx_gate_decisions_work_item_id ON gate_decisions (work_item_id);
CREATE INDEX IF NOT EXISTS idx_gate_decisions_gate_name ON gate_decisions (gate_name);
CREATE INDEX IF NOT EXISTS idx_gate_decisions_actor_type_actor_id ON gate_decisions (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_gate_decisions_drift_stale_approval_decision_id
  ON gate_decisions (drift_stale_approval_decision_id);

CREATE TABLE IF NOT EXISTS gate_decision_evidence_cache_refs (
  gate_decision_id TEXT NOT NULL REFERENCES gate_decisions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  context_db_path TEXT NOT NULL,
  evidence_cache_row_id INTEGER NOT NULL CHECK (evidence_cache_row_id > 0),
  PRIMARY KEY (gate_decision_id, context_db_path, evidence_cache_row_id)
);

CREATE INDEX IF NOT EXISTS idx_gate_decision_evidence_cache_refs_gate_decision_id
  ON gate_decision_evidence_cache_refs (gate_decision_id);

CREATE TABLE IF NOT EXISTS gate_decision_failures (
  gate_decision_id TEXT NOT NULL REFERENCES gate_decisions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  failure_category TEXT NOT NULL CHECK (
    failure_category IN (
      'expected_behavior_fail',
      'missing_impl',
      'env_fail',
      'flaky_fail',
      'frontier_deadlock_detected',
      'frontier_truncated',
      'frontier_execution_error',
      'required_checks_missing',
      'required_checks_failed',
      'merge_conflict_detected',
      'merge_simulation_execution_error'
    )
  ),
  check_name TEXT NOT NULL,
  detail TEXT NOT NULL,
  PRIMARY KEY (gate_decision_id, failure_category, check_name)
);

CREATE INDEX IF NOT EXISTS idx_gate_decision_failures_gate_decision_id
  ON gate_decision_failures (gate_decision_id);

CREATE TABLE IF NOT EXISTS check_runs (
  id TEXT PRIMARY KEY,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE ON UPDATE CASCADE,
  gate_decision_id TEXT REFERENCES gate_decisions(id) ON DELETE SET NULL ON UPDATE CASCADE,
  check_name TEXT NOT NULL,
  check_type TEXT NOT NULL CHECK (
    check_type IN ('tests', 'types', 'behavioral_frontier', 'merge_simulation', 'custom')
  ),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'passed', 'failed', 'cancelled')),
  required_gate TEXT NOT NULL CHECK (
    required_gate IN ('none', 'red_approval', 'frontier_verification')
  ),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (completed_at IS NULL OR started_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_check_runs_work_item_id ON check_runs (work_item_id);
CREATE INDEX IF NOT EXISTS idx_check_runs_status ON check_runs (status);
CREATE INDEX IF NOT EXISTS idx_check_runs_required_gate ON check_runs (required_gate);

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
