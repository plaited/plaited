PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('pattern', 'anti-pattern', 'stale-doc', 'boundary-rule', 'question')),
  status TEXT NOT NULL CHECK (status IN ('candidate', 'validated', 'retired')),
  summary TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_kind ON findings(kind);

CREATE TABLE IF NOT EXISTS finding_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  line INTEGER,
  symbol TEXT,
  excerpt TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_finding_evidence_finding_id ON finding_evidence(finding_id);
CREATE INDEX IF NOT EXISTS idx_finding_evidence_path ON finding_evidence(path);

CREATE TABLE IF NOT EXISTS evidence_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool TEXT NOT NULL,
  topic TEXT NOT NULL,
  cache_key TEXT,
  summary TEXT,
  command TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  input_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_cache_key ON evidence_cache(tool, topic, cache_key)
WHERE cache_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_cache_tool_topic ON evidence_cache(tool, topic);
CREATE INDEX IF NOT EXISTS idx_evidence_cache_created_at ON evidence_cache(created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_findings_updated_at
AFTER UPDATE ON findings
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE findings
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_evidence_cache_updated_at
AFTER UPDATE ON evidence_cache
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE evidence_cache
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
