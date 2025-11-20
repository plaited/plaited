-- Plaited Documentation Database Schema
-- Stores code examples, architectural patterns, and release tracking

-- Enable Write-Ahead Logging for better concurrency
PRAGMA journal_mode = WAL;

-- Examples table: Self-contained code examples for public API
CREATE TABLE IF NOT EXISTS examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module TEXT NOT NULL CHECK(module IN ('main', 'testing', 'utils', 'workshop')),
  export_name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  code TEXT NOT NULL,
  dependencies TEXT,
  runtime_context TEXT CHECK(runtime_context IN ('browser', 'node', 'worker', 'any')),
  mcp_tool_compatible INTEGER DEFAULT 0,
  expected_output TEXT,
  github_permalink TEXT,
  derived_from TEXT CHECK(derived_from IN ('story', 'test', 'manual')),
  tags TEXT,
  complexity TEXT CHECK(complexity IN ('basic', 'intermediate', 'advanced')),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Patterns table: Architectural patterns and best practices
CREATE TABLE IF NOT EXISTS patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  code_example TEXT NOT NULL,
  use_cases TEXT,
  anti_patterns TEXT,
  related_patterns TEXT,
  related_apis TEXT,
  related_examples TEXT,
  mcp_tool_compatible INTEGER DEFAULT 0,
  expected_outcome TEXT,
  github_permalink TEXT,
  reference_links TEXT,
  maintainer_notes TEXT,
  tags TEXT,
  complexity TEXT CHECK(complexity IN ('basic', 'intermediate', 'advanced')),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Release changes table: Track database changes per release
CREATE TABLE IF NOT EXISTS release_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  release_version TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK(change_type IN ('added', 'modified', 'removed')),
  table_name TEXT NOT NULL CHECK(table_name IN ('examples', 'patterns')),
  record_id INTEGER,
  export_name TEXT,
  description TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_examples_module ON examples(module);
CREATE INDEX IF NOT EXISTS idx_examples_export_name ON examples(export_name);
CREATE INDEX IF NOT EXISTS idx_examples_category ON examples(category);
CREATE INDEX IF NOT EXISTS idx_examples_runtime_context ON examples(runtime_context);
CREATE INDEX IF NOT EXISTS idx_examples_complexity ON examples(complexity);
CREATE INDEX IF NOT EXISTS idx_examples_mcp_tool_compatible ON examples(mcp_tool_compatible);

CREATE INDEX IF NOT EXISTS idx_patterns_name ON patterns(name);
CREATE INDEX IF NOT EXISTS idx_patterns_category ON patterns(category);
CREATE INDEX IF NOT EXISTS idx_patterns_complexity ON patterns(complexity);
CREATE INDEX IF NOT EXISTS idx_patterns_mcp_tool_compatible ON patterns(mcp_tool_compatible);

CREATE INDEX IF NOT EXISTS idx_release_changes_version ON release_changes(release_version);
CREATE INDEX IF NOT EXISTS idx_release_changes_table ON release_changes(table_name);

-- Full-text search for examples
CREATE VIRTUAL TABLE IF NOT EXISTS examples_fts USING fts5(
  export_name,
  title,
  description,
  code,
  tags,
  content=examples,
  content_rowid=id
);

-- Triggers to keep FTS index in sync with examples table
CREATE TRIGGER IF NOT EXISTS examples_ai AFTER INSERT ON examples BEGIN
  INSERT INTO examples_fts(rowid, export_name, title, description, code, tags)
  VALUES (new.id, new.export_name, new.title, new.description, new.code, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS examples_ad AFTER DELETE ON examples BEGIN
  DELETE FROM examples_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS examples_au AFTER UPDATE ON examples BEGIN
  UPDATE examples_fts
  SET export_name = new.export_name,
      title = new.title,
      description = new.description,
      code = new.code,
      tags = new.tags
  WHERE rowid = new.id;
END;

-- Full-text search for patterns
CREATE VIRTUAL TABLE IF NOT EXISTS patterns_fts USING fts5(
  name,
  title,
  description,
  problem,
  solution,
  code_example,
  tags,
  content=patterns,
  content_rowid=id
);

-- Triggers to keep FTS index in sync with patterns table
CREATE TRIGGER IF NOT EXISTS patterns_ai AFTER INSERT ON patterns BEGIN
  INSERT INTO patterns_fts(rowid, name, title, description, problem, solution, code_example, tags)
  VALUES (new.id, new.name, new.title, new.description, new.problem, new.solution, new.code_example, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS patterns_ad AFTER DELETE ON patterns BEGIN
  DELETE FROM patterns_fts WHERE rowid = old.id;
END;

CREATE TRIGGER IF NOT EXISTS patterns_au AFTER UPDATE ON patterns BEGIN
  UPDATE patterns_fts
  SET name = new.name,
      title = new.title,
      description = new.description,
      problem = new.problem,
      solution = new.solution,
      code_example = new.code_example,
      tags = new.tags
  WHERE rowid = new.id;
END;

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS examples_update_timestamp
AFTER UPDATE ON examples
FOR EACH ROW
BEGIN
  UPDATE examples SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS patterns_update_timestamp
AFTER UPDATE ON patterns
FOR EACH ROW
BEGIN
  UPDATE patterns SET updated_at = strftime('%s', 'now') WHERE id = NEW.id;
END;
