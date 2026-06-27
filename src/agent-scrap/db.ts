// import { Database } from 'bun:sqlite'
// import { mkdirSync, unlinkSync } from 'node:fs'
// import { dirname, resolve } from 'node:path'
// import * as z from 'zod'
// import type { JsonObject, SnapshotMessage } from '../behavioral.ts'
// import type { SERVER_TO_CONTROLLER_EVENTS } from '../shared/shared.constants.ts'
// import type { AttrsMessage, DisconnectMessage, ImportModuleMessage, RenderMessage } from '../shared/shared.schemas.ts'
// import { JsonObjectSchema } from '../shared.ts'

// const DB_PATH = '.plaited/context.sqlite'

// let db: Database | undefined

// const getDbPath = () => resolve(process.cwd(), DB_PATH)

// const ensureDbDir = () => mkdirSync(dirname(getDbPath()), { recursive: true })

// const getDb = (): Database => {
//   if (db) return db
//   ensureDbDir()
//   db = new Database(getDbPath(), { create: true })
//   db.exec('PRAGMA journal_mode = WAL')
//   db.exec('PRAGMA foreign_keys = ON')

//   db.run(`
//     CREATE TABLE IF NOT EXISTS topics (
//       id TEXT PRIMARY KEY,
//       name TEXT,
//       description TEXT,
//       memory TEXT CHECK(length(memory) <= 2200),
//       user TEXT CHECK(length(user) <= 1375),
//       created_at INTEGER DEFAULT (unixepoch())
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS packages (
//       id INTEGER PRIMARY KEY,
//       name TEXT UNIQUE NOT NULL,
//       version TEXT,
//       path TEXT NOT NULL,
//       type TEXT CHECK(type IN ('workspace', 'npm')) NOT NULL,
//       discovered_at INTEGER,
//       last_modified INTEGER
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS package_exports (
//       id INTEGER PRIMARY KEY,
//       package_id INTEGER REFERENCES packages(id),
//       export_type TEXT CHECK(export_type IN ('behaviors', 'templates', 'skills')) NOT NULL,
//       file_path TEXT,
//       name TEXT
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS topic_packages (
//       topic_id TEXT REFERENCES topics(id),
//       package_id INTEGER REFERENCES packages(id),
//       loaded_at INTEGER,
//       PRIMARY KEY (topic_id, package_id)
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS templates (
//       id INTEGER PRIMARY KEY,
//       export_id INTEGER REFERENCES package_exports(id),
//       name TEXT NOT NULL,
//       scale TEXT,
//       input_schema TEXT,
//       file_path TEXT
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS behaviors (
//       id INTEGER PRIMARY KEY,
//       export_id INTEGER REFERENCES package_exports(id),
//       name TEXT NOT NULL,
//       events TEXT,
//       file_path TEXT
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS skills (
//       id INTEGER PRIMARY KEY,
//       export_id INTEGER REFERENCES package_exports(id),
//       name TEXT NOT NULL,
//       description TEXT,
//       tags TEXT,
//       frontmatter TEXT,
//       file_path TEXT
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS topic_event_log (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       topic_id TEXT NOT NULL REFERENCES topics(id),
//       step INTEGER,
//       kind TEXT NOT NULL,
//       created_at INTEGER DEFAULT (unixepoch())
//     )
//   `)
//   db.run(`CREATE INDEX IF NOT EXISTS idx_event_log_topic ON topic_event_log(topic_id)`)
//   db.run(`CREATE INDEX IF NOT EXISTS idx_event_log_topic_step ON topic_event_log(topic_id, step)`)
//   db.run(`CREATE INDEX IF NOT EXISTS idx_event_log_topic_kind ON topic_event_log(topic_id, kind)`)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS event_pending_bids (
//       event_id INTEGER PRIMARY KEY REFERENCES topic_event_log(id),
//       threads TEXT NOT NULL
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS event_frontiers (
//       event_id INTEGER PRIMARY KEY REFERENCES topic_event_log(id),
//       status TEXT NOT NULL,
//       candidates TEXT NOT NULL,
//       enabled TEXT NOT NULL
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS event_selections (
//       event_id INTEGER PRIMARY KEY REFERENCES topic_event_log(id),
//       event_type TEXT NOT NULL,
//       detail TEXT,
//       ingress INTEGER
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS event_deadlocks (
//       event_id INTEGER PRIMARY KEY REFERENCES topic_event_log(id)
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS event_feedback_errors (
//       event_id INTEGER PRIMARY KEY REFERENCES topic_event_log(id),
//       event_type TEXT,
//       detail TEXT,
//       error TEXT NOT NULL
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS event_runtime_errors (
//       event_id INTEGER PRIMARY KEY REFERENCES topic_event_log(id),
//       error TEXT NOT NULL
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS event_add_thread_errors (
//       event_id INTEGER PRIMARY KEY REFERENCES topic_event_log(id),
//       label TEXT NOT NULL,
//       error TEXT NOT NULL
//     )
//   `)

//   db.run(`
//     CREATE TABLE IF NOT EXISTS ui_events (
//       id INTEGER PRIMARY KEY,
//       topic_id TEXT REFERENCES topics(id),
//       type TEXT CHECK(type IN ('render', 'attrs', 'import', 'disconnect')) NOT NULL,
//       version TEXT,
//       target TEXT,
//       html TEXT,
//       swap TEXT,
//       attr TEXT,
//       registry TEXT,
//       created_at INTEGER DEFAULT (unixepoch())
//     )
//   `)

//   return db
// }

// /** Close connection, delete file, and reset singleton. For tests only. */
// export const resetDb = () => {
//   if (db) {
//     db.close()
//     db = undefined
//   }
//   try {
//     unlinkSync(getDbPath())
//   } catch {
//     // file may not exist
//   }
// }

// // ---------------------------------------------------------------------------
// // PUBLIC: recordSnapshot
// // ---------------------------------------------------------------------------

// type PendingBidsMessage = {
//   kind: 'pending_bids'
//   step: number
//   threads: Array<{
//     label: string
//     priority: number
//     ingress?: true
//     topic?: string
//     request?: { type: string; detail?: JsonObject }
//     waitFor?: Array<{ type: string; topic?: string }>
//     block?: Array<{ type: string; topic?: string }>
//     interrupt?: Array<{ type: string; topic?: string }>
//   }>
// }

// type RecordableSnapshot = SnapshotMessage | PendingBidsMessage

// export const recordSnapshot = (topicId: string, message: RecordableSnapshot) => {
//   const database = getDb()

//   database.transaction(() => {
//     const step = 'step' in message ? message.step : null
//     const row = database
//       .query('INSERT INTO topic_event_log (topic_id, step, kind) VALUES (?, ?, ?) RETURNING id')
//       .get(topicId, step, message.kind) as { id: number }
//     const eventId = row.id

//     switch (message.kind) {
//       case 'selection': {
//         database
//           .query('INSERT INTO event_selections (event_id, event_type, detail, ingress) VALUES (?, ?, ?, ?)')
//           .run(
//             eventId,
//             message.selected.type,
//             message.selected.detail === undefined ? null : JSON.stringify(message.selected.detail),
//             message.selected.ingress === undefined ? null : 1,
//           )
//         break
//       }
//       case 'frontier': {
//         database
//           .query('INSERT INTO event_frontiers (event_id, status, candidates, enabled) VALUES (?, ?, ?, ?)')
//           .run(eventId, message.status, JSON.stringify(message.candidates), JSON.stringify(message.enabled))
//         break
//       }
//       case 'deadlock': {
//         database.query('INSERT INTO event_deadlocks (event_id) VALUES (?)').run(eventId)
//         break
//       }
//       case 'feedback_error': {
//         database
//           .query('INSERT INTO event_feedback_errors (event_id, event_type, detail, error) VALUES (?, ?, ?, ?)')
//           .run(
//             eventId,
//             message.type ?? null,
//             message.detail === undefined ? null : JSON.stringify(message.detail),
//             message.error,
//           )
//         break
//       }
//       case 'runtime_error': {
//         database.query('INSERT INTO event_runtime_errors (event_id, error) VALUES (?, ?)').run(eventId, message.error)
//         break
//       }
//       case 'add_thread_error': {
//         database
//           .query('INSERT INTO event_add_thread_errors (event_id, label, error) VALUES (?, ?, ?)')
//           .run(eventId, message.label, message.error)
//         break
//       }
//       case 'pending_bids': {
//         database
//           .query('INSERT INTO event_pending_bids (event_id, threads) VALUES (?, ?)')
//           .run(eventId, JSON.stringify(message.threads))
//         break
//       }
//     }
//   })()
// }

// // ---------------------------------------------------------------------------
// // PUBLIC: queryEvents
// // ---------------------------------------------------------------------------

// const parseDetail = (v: unknown): JsonObject | null =>
//   v == null ? null : JsonObjectSchema.parse(JSON.parse(v as string))

// const parseIngress = (v: unknown): boolean | null => (v == null ? null : v === 1 || v === true)

// const SelectionRowSchema = z
//   .object({
//     seq: z.number(),
//     step: z.number().nullable(),
//     kind: z.literal('selection'),
//     created_at: z.number(),
//     event_type: z.string(),
//     selected_detail: z.string().nullable(),
//     ingress: z.number().nullable(),
//   })
//   .transform(({ selected_detail, ingress, ...rest }) => ({
//     ...rest,
//     selected_detail: parseDetail(selected_detail),
//     ingress: parseIngress(ingress),
//   }))

// const DeadlockRowSchema = z.object({
//   seq: z.number(),
//   step: z.number().nullable(),
//   kind: z.literal('deadlock'),
//   created_at: z.number(),
// })

// const FrontierRowSchema = z.object({
//   seq: z.number(),
//   step: z.number().nullable(),
//   kind: z.literal('frontier'),
//   created_at: z.number(),
//   status: z.string(),
//   candidates: z.string(),
//   enabled: z.string(),
// })

// const FeedbackErrorRowSchema = z
//   .object({
//     seq: z.number(),
//     step: z.number().nullable(),
//     kind: z.literal('feedback_error'),
//     created_at: z.number(),
//     event_type: z.string().nullable(),
//     feedback_detail: z.string().nullable(),
//     error: z.string(),
//   })
//   .transform(({ feedback_detail, ...rest }) => ({
//     ...rest,
//     feedback_detail: parseDetail(feedback_detail),
//   }))

// const RuntimeErrorRowSchema = z.object({
//   seq: z.number(),
//   step: z.number().nullable(),
//   kind: z.literal('runtime_error'),
//   created_at: z.number(),
//   error: z.string(),
// })

// const AddThreadErrorRowSchema = z.object({
//   seq: z.number(),
//   step: z.number().nullable(),
//   kind: z.literal('add_thread_error'),
//   created_at: z.number(),
//   label: z.string(),
//   error: z.string(),
// })

// const PendingBidsRowSchema = z.object({
//   seq: z.number(),
//   step: z.number().nullable(),
//   kind: z.literal('pending_bids'),
//   created_at: z.number(),
//   threads: z.string(),
// })

// const TopicEventRowSchema = z.discriminatedUnion('kind', [
//   SelectionRowSchema,
//   DeadlockRowSchema,
//   FrontierRowSchema,
//   FeedbackErrorRowSchema,
//   RuntimeErrorRowSchema,
//   AddThreadErrorRowSchema,
//   PendingBidsRowSchema,
// ])

// type TopicEventRow = z.output<typeof TopicEventRowSchema>

// export const queryEvents = ({
//   topic,
//   kind,
//   event_type,
//   label_match,
//   limit,
// }: {
//   topic: string
//   kind?: string
//   event_type?: string
//   label_match?: string
//   limit?: number
// }): TopicEventRow[] => {
//   const database = getDb()

//   if (kind) {
//     return queryByKind(database, topic, kind, { event_type, label_match, limit })
//   }

//   // No kind filter: UNION ALL across all detail tables
//   const limitClause = limit === undefined ? '' : `LIMIT ${limit}`
//   const sql = `
//     SELECT l.id AS seq, l.step, l.kind, l.created_at,
//            s.event_type, s.detail AS selected_detail, s.ingress,
//            NULL AS status, NULL AS candidates, NULL AS enabled,
//            NULL AS threads,
//            NULL AS error, NULL AS label,
//            NULL AS feedback_detail
//     FROM topic_event_log l
//     JOIN event_selections s ON s.event_id = l.id
//     WHERE l.topic_id = ?
//     UNION ALL
//     SELECT l.id, l.step, l.kind, l.created_at,
//            NULL, NULL, NULL,
//            f.status, f.candidates, f.enabled,
//            NULL, NULL, NULL, NULL
//     FROM topic_event_log l
//     JOIN event_frontiers f ON f.event_id = l.id
//     WHERE l.topic_id = ?
//     UNION ALL
//     SELECT l.id, l.step, l.kind, l.created_at,
//            NULL, NULL, NULL,
//            NULL, NULL, NULL,
//            NULL, NULL, NULL, NULL
//     FROM topic_event_log l
//     JOIN event_deadlocks d ON d.event_id = l.id
//     WHERE l.topic_id = ?
//     UNION ALL
//     SELECT l.id, l.step, l.kind, l.created_at,
//            fe.event_type, NULL, NULL,
//            NULL, NULL, NULL,
//            NULL, fe.error, NULL, fe.detail AS feedback_detail
//     FROM topic_event_log l
//     JOIN event_feedback_errors fe ON fe.event_id = l.id
//     WHERE l.topic_id = ?
//     UNION ALL
//     SELECT l.id, l.step, l.kind, l.created_at,
//            NULL, NULL, NULL,
//            NULL, NULL, NULL,
//            NULL, re.error, NULL, NULL
//     FROM topic_event_log l
//     JOIN event_runtime_errors re ON re.event_id = l.id
//     WHERE l.topic_id = ?
//     UNION ALL
//     SELECT l.id, l.step, l.kind, l.created_at,
//            NULL, NULL, NULL,
//            NULL, NULL, NULL,
//            NULL, ate.error, ate.label, NULL
//     FROM topic_event_log l
//     JOIN event_add_thread_errors ate ON ate.event_id = l.id
//     WHERE l.topic_id = ?
//     UNION ALL
//     SELECT l.id, l.step, l.kind, l.created_at,
//            NULL, NULL, NULL,
//            NULL, NULL, NULL,
//            pb.threads, NULL, NULL, NULL
//     FROM topic_event_log l
//     JOIN event_pending_bids pb ON pb.event_id = l.id
//     WHERE l.topic_id = ?
//     ORDER BY seq DESC
//     ${limitClause}
//   `

//   const raw = database.query(sql).all(topic, topic, topic, topic, topic, topic, topic)
//   return raw.map((row) => TopicEventRowSchema.parse(row))
// }

// const queryByKind = (
//   database: Database,
//   topic: string,
//   kind: string,
//   {
//     event_type,
//     label_match,
//     limit,
//   }: {
//     event_type?: string
//     label_match?: string
//     limit?: number
//   },
// ): TopicEventRow[] => {
//   const limitClause = limit === undefined ? '' : `LIMIT ${limit}`

//   switch (kind) {
//     case 'selection': {
//       const conditions = ['l.topic_id = ?']
//       const params: (string | number)[] = [topic]
//       if (event_type !== undefined) {
//         conditions.push('s.event_type = ?')
//         params.push(event_type)
//       }
//       const sql = `
//         SELECT l.id AS seq, l.step, l.kind, l.created_at,
//                s.event_type, s.detail AS selected_detail, s.ingress
//         FROM topic_event_log l
//         JOIN event_selections s ON s.event_id = l.id
//         WHERE ${conditions.join(' AND ')}
//         ORDER BY l.id DESC
//         ${limitClause}
//       `
//       const raw = database.query(sql).all(...params)
//       return raw.map((row) => SelectionRowSchema.parse(row))
//     }
//     case 'pending_bids': {
//       const conditions = ['l.topic_id = ?']
//       const params: (string | number)[] = [topic]
//       if (label_match !== undefined) {
//         conditions.push(
//           `EXISTS (SELECT 1 FROM json_each(pb.threads) AS t WHERE json_extract(t.value, '$.label') LIKE ?)`,
//         )
//         params.push(`%${label_match}%`)
//       }
//       const sql = `
//         SELECT l.id AS seq, l.step, l.kind, l.created_at, pb.threads
//         FROM topic_event_log l
//         JOIN event_pending_bids pb ON pb.event_id = l.id
//         WHERE ${conditions.join(' AND ')}
//         ORDER BY l.id DESC
//         ${limitClause}
//       `
//       return database
//         .query(sql)
//         .all(...params)
//         .map((row) => PendingBidsRowSchema.parse(row))
//     }
//     case 'frontier': {
//       const sql = `
//         SELECT l.id AS seq, l.step, l.kind, l.created_at,
//                f.status, f.candidates, f.enabled
//         FROM topic_event_log l
//         JOIN event_frontiers f ON f.event_id = l.id
//         WHERE l.topic_id = ?
//         ORDER BY l.id DESC
//         ${limitClause}
//       `
//       return database
//         .query(sql)
//         .all(topic)
//         .map((row) => FrontierRowSchema.parse(row))
//     }
//     case 'deadlock': {
//       const sql = `
//         SELECT l.id AS seq, l.step, l.kind, l.created_at
//         FROM topic_event_log l
//         JOIN event_deadlocks d ON d.event_id = l.id
//         WHERE l.topic_id = ?
//         ORDER BY l.id DESC
//         ${limitClause}
//       `
//       return database
//         .query(sql)
//         .all(topic)
//         .map((row) => DeadlockRowSchema.parse(row))
//     }
//     case 'feedback_error': {
//       const conditions = ['l.topic_id = ?']
//       const params: (string | number)[] = [topic]
//       if (event_type !== undefined) {
//         conditions.push('fe.event_type = ?')
//         params.push(event_type)
//       }
//       const sql = `
//         SELECT l.id AS seq, l.step, l.kind, l.created_at,
//                fe.event_type, fe.detail AS feedback_detail, fe.error
//         FROM topic_event_log l
//         JOIN event_feedback_errors fe ON fe.event_id = l.id
//         WHERE ${conditions.join(' AND ')}
//         ORDER BY l.id DESC
//         ${limitClause}
//       `
//       return database
//         .query(sql)
//         .all(...params)
//         .map((row) => FeedbackErrorRowSchema.parse(row))
//     }
//     case 'runtime_error': {
//       const sql = `
//         SELECT l.id AS seq, l.step, l.kind, l.created_at, re.error
//         FROM topic_event_log l
//         JOIN event_runtime_errors re ON re.event_id = l.id
//         WHERE l.topic_id = ?
//         ORDER BY l.id DESC
//         ${limitClause}
//       `
//       return database
//         .query(sql)
//         .all(topic)
//         .map((row) => RuntimeErrorRowSchema.parse(row))
//     }
//     case 'add_thread_error': {
//       const conditions = ['l.topic_id = ?']
//       const params: (string | number)[] = [topic]
//       if (label_match !== undefined) {
//         conditions.push('ate.label LIKE ?')
//         params.push(`%${label_match}%`)
//       }
//       const sql = `
//         SELECT l.id AS seq, l.step, l.kind, l.created_at, ate.label, ate.error
//         FROM topic_event_log l
//         JOIN event_add_thread_errors ate ON ate.event_id = l.id
//         WHERE ${conditions.join(' AND ')}
//         ORDER BY l.id DESC
//         ${limitClause}
//       `
//       return database
//         .query(sql)
//         .all(...params)
//         .map((row) => AddThreadErrorRowSchema.parse(row))
//     }
//     default:
//       return []
//   }
// }

// // ---------------------------------------------------------------------------
// // LEGACY (preserved from original db.ts)
// // ---------------------------------------------------------------------------

// export const recordUiEvent = ({
//   topicId,
//   type,
//   event,
// }: {
//   topicId: string
//   type: keyof typeof SERVER_TO_CONTROLLER_EVENTS
//   event: RenderMessage | AttrsMessage | ImportModuleMessage | DisconnectMessage
// }) => {
//   const detail = 'detail' in event ? (event.detail as Record<string, unknown>) : undefined
//   getDb()
//     .query(
//       'INSERT INTO ui_events (topic_id, type, version, target, html, swap, attr, registry) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
//     )
//     .run(
//       topicId,
//       type,
//       (detail?.version as string | undefined) ?? null,
//       detail && 'target' in detail ? (detail.target as string) : null,
//       detail && 'html' in detail ? (detail.html as string) : null,
//       detail && 'swap' in detail ? (detail.swap as string) : null,
//       detail && 'attr' in detail ? JSON.stringify(detail.attr) : null,
//       detail && 'registry' in detail ? JSON.stringify(detail.registry) : null,
//     )
// }

// export const upsertTopic = ({
//   id,
//   name,
//   description,
//   memory,
//   user,
// }: {
//   id: string
//   name?: string
//   description?: string
//   memory?: string
//   user?: string
// }) => {
//   const database = getDb()
//   const exists = database.query('SELECT 1 FROM topics WHERE id = ?').get(id)

//   if (exists) {
//     const sets: string[] = []
//     const values: (string | null)[] = []
//     if (name !== undefined) {
//       sets.push('name = ?')
//       values.push(name)
//     }
//     if (description !== undefined) {
//       sets.push('description = ?')
//       values.push(description)
//     }
//     if (memory !== undefined) {
//       sets.push('memory = ?')
//       values.push(memory)
//     }
//     if (user !== undefined) {
//       sets.push('user = ?')
//       values.push(user)
//     }
//     if (sets.length === 0) return
//     database.query(`UPDATE topics SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
//   } else {
//     database
//       .query('INSERT INTO topics (id, name, description, memory, user) VALUES (?, ?, ?, ?, ?)')
//       .run(id, name ?? null, description ?? null, memory ?? null, user ?? null)
//   }
// }

// export const upsertPackages = (
//   packages: Array<{
//     name: string
//     version?: string
//     path: string
//     type: 'workspace' | 'npm'
//     exports: {
//       behaviors?: Array<{ name: string; filePath: string; events?: string[] }>
//       templates?: Array<{ name: string; filePath: string; scale?: string; inputSchema?: string }>
//       skills?: Array<{ name: string; filePath: string; description?: string; tags?: string[]; frontmatter?: unknown }>
//     }
//   }>,
// ) => {
//   const database = getDb()
//   database.transaction(() => {
//     for (const pkg of packages) {
//       database
//         .query(
//           `INSERT INTO packages (name, version, path, type, discovered_at, last_modified)
//            VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
//            ON CONFLICT(name) DO UPDATE SET
//              version = excluded.version,
//              path = excluded.path,
//              type = excluded.type,
//              last_modified = unixepoch()`,
//         )
//         .run(pkg.name, pkg.version ?? null, pkg.path, pkg.type)

//       const packageRow = database.query('SELECT id FROM packages WHERE name = ?').get(pkg.name) as { id: number } | null
//       if (!packageRow) continue
//       const packageId = packageRow.id

//       database.query('DELETE FROM package_exports WHERE package_id = ?').run(packageId)
//       database
//         .query('DELETE FROM templates WHERE export_id IN (SELECT id FROM package_exports WHERE package_id = ?)')
//         .run(packageId)
//       database
//         .query('DELETE FROM behaviors WHERE export_id IN (SELECT id FROM package_exports WHERE package_id = ?)')
//         .run(packageId)
//       database
//         .query('DELETE FROM skills WHERE export_id IN (SELECT id FROM package_exports WHERE package_id = ?)')
//         .run(packageId)

//       for (const exportType of ['behaviors', 'templates', 'skills'] as const) {
//         const items = pkg.exports[exportType]
//         if (!items) continue
//         for (const item of items) {
//           database
//             .query('INSERT INTO package_exports (package_id, export_type, file_path, name) VALUES (?, ?, ?, ?)')
//             .run(packageId, exportType, item.filePath, item.name)

//           const exportRow = database
//             .query('SELECT id FROM package_exports WHERE package_id = ? AND export_type = ? AND name = ?')
//             .get(packageId, exportType, item.name) as { id: number } | null
//           if (!exportRow) continue
//           const exportId = exportRow.id

//           if (exportType === 'behaviors' && 'events' in item) {
//             database
//               .query('INSERT INTO behaviors (export_id, name, events, file_path) VALUES (?, ?, ?, ?)')
//               .run(exportId, item.name, item.events ? JSON.stringify(item.events) : null, item.filePath)
//           }
//           if (exportType === 'templates' && 'scale' in item) {
//             database
//               .query('INSERT INTO templates (export_id, name, scale, input_schema, file_path) VALUES (?, ?, ?, ?, ?)')
//               .run(exportId, item.name, item.scale ?? null, item.inputSchema ?? null, item.filePath)
//           }
//           if (exportType === 'skills' && 'frontmatter' in item) {
//             database
//               .query(
//                 'INSERT INTO skills (export_id, name, description, tags, frontmatter, file_path) VALUES (?, ?, ?, ?, ?, ?)',
//               )
//               .run(
//                 exportId,
//                 item.name,
//                 item.description ?? null,
//                 item.tags ? JSON.stringify(item.tags) : null,
//                 item.frontmatter ? JSON.stringify(item.frontmatter) : null,
//                 item.filePath,
//               )
//           }
//         }
//       }
//     }
//   })()
// }

// export const linkTopicPackage = (topicId: string, packageId: number) => {
//   getDb()
//     .query(
//       'INSERT INTO topic_packages (topic_id, package_id, loaded_at) VALUES (?, ?, unixepoch()) ON CONFLICT DO NOTHING',
//     )
//     .run(topicId, packageId)
// }

// export const getTopicContext = (id: string): { memory: string | null; user: string | null } | undefined => {
//   return (
//     (getDb().query('SELECT memory, user FROM topics WHERE id = ?').get(id) as {
//       memory: string | null
//       user: string | null
//     } | null) ?? undefined
//   )
// }
