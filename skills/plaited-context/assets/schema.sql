PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('source', 'skill', 'doc', 'other')),
  ext TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  content TEXT NOT NULL,
  indexed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_kind ON files(kind);
CREATE INDEX IF NOT EXISTS idx_files_indexed_at ON files(indexed_at DESC);

CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  line INTEGER NOT NULL,
  FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE,
  UNIQUE (file_path, name, kind, line)
);

CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_file_path ON symbols(file_path);

CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  specifier TEXT NOT NULL,
  line INTEGER NOT NULL,
  is_type INTEGER NOT NULL DEFAULT 0 CHECK (is_type IN (0, 1)),
  FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_imports_specifier ON imports(specifier);
CREATE INDEX IF NOT EXISTS idx_imports_file_path ON imports(file_path);

CREATE TABLE IF NOT EXISTS exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  line INTEGER NOT NULL,
  FOREIGN KEY (file_path) REFERENCES files(path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exports_name ON exports(name);
CREATE INDEX IF NOT EXISTS idx_exports_file_path ON exports(file_path);

CREATE TABLE IF NOT EXISTS skills (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  license TEXT,
  compatibility TEXT,
  indexed_at TEXT NOT NULL,
  FOREIGN KEY (path) REFERENCES files(path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);

CREATE TABLE IF NOT EXISTS docs (
  path TEXT PRIMARY KEY,
  title TEXT,
  body TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  FOREIGN KEY (path) REFERENCES files(path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_docs_indexed_at ON docs(indexed_at DESC);

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

CREATE TABLE IF NOT EXISTS context_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  mode TEXT NOT NULL,
  paths_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_context_runs_created_at ON context_runs(created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_findings_updated_at
AFTER UPDATE ON findings
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE findings
  SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = NEW.id;
END;
