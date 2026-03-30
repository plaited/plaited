import { Database, type SQLQueryBindings } from 'bun:sqlite'
import { behavioral } from '../behavioral/behavioral.ts'
import { AGENT_CORE_EVENTS } from './agent.constants.ts'
import {
  AgentToolErrorDetailSchema,
  AgentToolExecuteDetailSchema,
  AgentToolResultDetailSchema,
  FactoriesUpdatedDetailSchema,
  RuntimeSqlErrorDetailSchema,
  RuntimeSqlFinalizeDetailSchema,
  RuntimeSqlFinalizedDetailSchema,
  RuntimeSqlRanDetailSchema,
  RuntimeSqlRequestDetailSchema,
  RuntimeSqlRowDetailSchema,
  RuntimeSqlRowsDetailSchema,
  RuntimeSqlValuesResultDetailSchema,
  UpdateFactoriesDetailSchema,
  UpdateFactoriesErrorDetailSchema,
} from './agent.schemas.ts'
import type { AgentHandle, CreateAgentOptions } from './agent.types.ts'
import { createLocalToolExecutor } from './create-local-tool-executor.ts'

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000
const RUNTIME_SNAPSHOTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS runtime_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
)`

type NamedStatementBindings = Record<string, SQLQueryBindings>
type NamedStatement = {
  run: (params: NamedStatementBindings) => { changes?: number; lastInsertRowid?: unknown }
  get: (params: NamedStatementBindings) => unknown
  all: (params: NamedStatementBindings) => unknown[]
  values: (params: NamedStatementBindings) => unknown[][]
  iterate: (params: NamedStatementBindings) => Iterable<unknown>
}

const installFactory = async ({
  factory,
  bThreads,
  trigger,
  useFeedback,
  useSnapshot,
}: {
  factory: NonNullable<CreateAgentOptions['factories']>[number]
  bThreads: ReturnType<typeof behavioral>['bThreads']
  trigger: ReturnType<typeof behavioral>['trigger']
  useFeedback: ReturnType<typeof behavioral>['useFeedback']
  useSnapshot: ReturnType<typeof behavioral>['useSnapshot']
}) => {
  const installed = await factory({ trigger, useSnapshot })
  if (installed.threads && Object.keys(installed.threads).length > 0) {
    bThreads.set(installed.threads)
  }
  if (installed.handlers) {
    useFeedback(installed.handlers)
  }
}

/**
 * Creates the minimal agent core around the behavioral engine.
 *
 * @remarks
 * The core owns only:
 * - behavioral engine setup
 * - restricted trigger boundary
 * - heartbeat pulse
 * - disconnect cleanup
 * - installation of executable factories
 *
 * Everything richer should be layered on through factories.
 *
 * @public
 */
export const createAgent = async ({
  id: _id,
  cwd: _cwd = process.cwd(),
  env: _env = {},
  factories = [],
  restrictedTriggers = [],
  heartbeat,
}: CreateAgentOptions): Promise<AgentHandle> => {
  const { bThreads, trigger, useFeedback, useSnapshot, useRestrictedTrigger } = behavioral()
  const runtimeDb = new Database(':memory:')
  const statementCache = new Map<string, ReturnType<typeof runtimeDb.query>>()
  const localToolExecutor = createLocalToolExecutor({ cwd: _cwd, env: _env })

  runtimeDb.run(RUNTIME_SNAPSHOTS_TABLE_SQL)

  const getStatement = (sql: string) => {
    let statement = statementCache.get(sql)
    if (!statement) {
      statement = runtimeDb.query(sql)
      statementCache.set(sql, statement)
    }
    return statement
  }

  const emitSqlError = ({ requestId, sql, error }: { requestId: string; sql: string; error: unknown }) => {
    trigger({
      type: AGENT_CORE_EVENTS.runtime_sql_error,
      detail: RuntimeSqlErrorDetailSchema.parse({
        requestId,
        sql,
        error: error instanceof Error ? error.message : String(error),
      }),
    })
  }

  const heartbeatIntervalMs = heartbeat?.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
  const heartbeatTimer = setInterval(() => {
    trigger({
      type: AGENT_CORE_EVENTS.agent_heartbeat,
      detail: { intervalMs: heartbeatIntervalMs },
    })
  }, heartbeatIntervalMs)

  useFeedback({
    [AGENT_CORE_EVENTS.agent_disconnect]() {
      clearInterval(heartbeatTimer)
      for (const statement of statementCache.values()) {
        statement.finalize()
      }
      statementCache.clear()
      runtimeDb.close(false)
    },
    async [AGENT_CORE_EVENTS.agent_tool_execute](detail: unknown) {
      const parsed = AgentToolExecuteDetailSchema.parse(detail)

      try {
        const output = await localToolExecutor(parsed.toolCall, AbortSignal.timeout(120_000))
        trigger({
          type: AGENT_CORE_EVENTS.agent_tool_result,
          detail: AgentToolResultDetailSchema.parse({
            result: {
              toolCallId: parsed.toolCall.id,
              name: parsed.toolCall.name,
              status: 'completed',
              output,
            },
          }),
        })
      } catch (error) {
        trigger({
          type: AGENT_CORE_EVENTS.agent_tool_error,
          detail: AgentToolErrorDetailSchema.parse({
            toolCallId: parsed.toolCall.id,
            name: parsed.toolCall.name,
            error: error instanceof Error ? error.message : String(error),
          }),
        })
      }
    },
    [AGENT_CORE_EVENTS.runtime_sql_run](detail: unknown) {
      const parsed = RuntimeSqlRequestDetailSchema.parse(detail)
      try {
        const statement = getStatement(parsed.sql)
        const result = Array.isArray(parsed.params)
          ? statement.run(...(parsed.params as SQLQueryBindings[]))
          : parsed.params
            ? (statement as unknown as NamedStatement).run(parsed.params as NamedStatementBindings)
            : statement.run()
        trigger({
          type: AGENT_CORE_EVENTS.runtime_sql_ran,
          detail: RuntimeSqlRanDetailSchema.parse({
            requestId: parsed.requestId,
            sql: parsed.sql,
            changes: typeof result.changes === 'number' ? result.changes : undefined,
            lastInsertRowid: result.lastInsertRowid === undefined ? undefined : String(result.lastInsertRowid),
          }),
        })
      } catch (error) {
        emitSqlError({ requestId: parsed.requestId, sql: parsed.sql, error })
      }
    },
    [AGENT_CORE_EVENTS.runtime_sql_get](detail: unknown) {
      const parsed = RuntimeSqlRequestDetailSchema.parse(detail)
      try {
        const statement = getStatement(parsed.sql)
        const row = (
          Array.isArray(parsed.params)
            ? statement.get(...(parsed.params as SQLQueryBindings[]))
            : parsed.params
              ? (statement as unknown as NamedStatement).get(parsed.params as NamedStatementBindings)
              : statement.get()
        ) as Record<string, unknown> | null
        trigger({
          type: AGENT_CORE_EVENTS.runtime_sql_row,
          detail: RuntimeSqlRowDetailSchema.parse({
            requestId: parsed.requestId,
            sql: parsed.sql,
            row,
          }),
        })
      } catch (error) {
        emitSqlError({ requestId: parsed.requestId, sql: parsed.sql, error })
      }
    },
    [AGENT_CORE_EVENTS.runtime_sql_all](detail: unknown) {
      const parsed = RuntimeSqlRequestDetailSchema.parse(detail)
      try {
        const statement = getStatement(parsed.sql)
        const rows = (
          Array.isArray(parsed.params)
            ? statement.all(...(parsed.params as SQLQueryBindings[]))
            : parsed.params
              ? (statement as unknown as NamedStatement).all(parsed.params as NamedStatementBindings)
              : statement.all()
        ) as Record<string, unknown>[]
        trigger({
          type: AGENT_CORE_EVENTS.runtime_sql_rows,
          detail: RuntimeSqlRowsDetailSchema.parse({
            requestId: parsed.requestId,
            sql: parsed.sql,
            rows,
          }),
        })
      } catch (error) {
        emitSqlError({ requestId: parsed.requestId, sql: parsed.sql, error })
      }
    },
    [AGENT_CORE_EVENTS.runtime_sql_values](detail: unknown) {
      const parsed = RuntimeSqlRequestDetailSchema.parse(detail)
      try {
        const statement = getStatement(parsed.sql)
        const rows = Array.isArray(parsed.params)
          ? statement.values(...(parsed.params as SQLQueryBindings[]))
          : parsed.params
            ? (statement as unknown as NamedStatement).values(parsed.params as NamedStatementBindings)
            : statement.values()
        trigger({
          type: AGENT_CORE_EVENTS.runtime_sql_values_result,
          detail: RuntimeSqlValuesResultDetailSchema.parse({
            requestId: parsed.requestId,
            sql: parsed.sql,
            rows,
          }),
        })
      } catch (error) {
        emitSqlError({ requestId: parsed.requestId, sql: parsed.sql, error })
      }
    },
    [AGENT_CORE_EVENTS.runtime_sql_iterate](detail: unknown) {
      const parsed = RuntimeSqlRequestDetailSchema.parse(detail)
      try {
        const statement = getStatement(parsed.sql)
        const rows = Array.from(
          Array.isArray(parsed.params)
            ? statement.iterate(...(parsed.params as SQLQueryBindings[]))
            : parsed.params
              ? (statement as unknown as NamedStatement).iterate(parsed.params as NamedStatementBindings)
              : statement.iterate(),
        ) as Record<string, unknown>[]
        trigger({
          type: AGENT_CORE_EVENTS.runtime_sql_iterated,
          detail: RuntimeSqlRowsDetailSchema.parse({
            requestId: parsed.requestId,
            sql: parsed.sql,
            rows,
          }),
        })
      } catch (error) {
        emitSqlError({ requestId: parsed.requestId, sql: parsed.sql, error })
      }
    },
    [AGENT_CORE_EVENTS.runtime_sql_finalize](detail: unknown) {
      const parsed = RuntimeSqlFinalizeDetailSchema.parse(detail)
      try {
        const statement = statementCache.get(parsed.sql)
        if (statement) {
          statement.finalize()
          statementCache.delete(parsed.sql)
        }
        trigger({
          type: AGENT_CORE_EVENTS.runtime_sql_finalized,
          detail: RuntimeSqlFinalizedDetailSchema.parse({
            requestId: parsed.requestId,
            sql: parsed.sql,
          }),
        })
      } catch (error) {
        emitSqlError({ requestId: parsed.requestId, sql: parsed.sql, error })
      }
    },
    async [AGENT_CORE_EVENTS.update_factories](detail: unknown) {
      const parsed = UpdateFactoriesDetailSchema.parse(detail)

      try {
        const imported = await import(parsed.module)
        const factory = imported.default

        if (typeof factory !== 'function') {
          throw new Error('Factory module default export must be a function')
        }

        await installFactory({
          factory,
          bThreads,
          trigger,
          useFeedback,
          useSnapshot,
        })

        trigger({
          type: AGENT_CORE_EVENTS.factories_updated,
          detail: FactoriesUpdatedDetailSchema.parse({ module: parsed.module }),
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        trigger({
          type: AGENT_CORE_EVENTS.update_factories_error,
          detail: UpdateFactoriesErrorDetailSchema.parse({
            module: parsed.module,
            error: message,
          }),
        })
      }
    },
  })

  for (const factory of factories) {
    await installFactory({
      factory,
      bThreads,
      trigger,
      useFeedback,
      useSnapshot,
    })
  }

  return {
    restrictedTrigger: useRestrictedTrigger(...restrictedTriggers),
    useSnapshot,
  }
}
