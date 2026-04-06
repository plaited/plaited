import { join } from 'node:path'
import type { Factory } from '../../agent.ts'
import { parseMarkdownWithFrontmatter } from '../../cli.ts'
import { SKILLS_FACTORY_EVENTS, SKILLS_FACTORY_SIGNAL_KEYS } from './skills-factory.constants.ts'
import {
  SelectedSkillSchema,
  SelectSkillDetailSchema,
  type SkillCatalogEntry,
  SkillsCatalogSchema,
  SkillsSelectedSignalSchema,
} from './skills-factory.schemas.ts'
import type { CreateSkillsFactoryOptions } from './skills-factory.types.ts'
import { loadSkillCatalog, SkillFrontMatterSchema } from './skills-factory.utils.ts'

/**
 * Creates the metadata-first skills factory.
 *
 * @public
 */
export const createSkillsFactory =
  ({
    rootDir = process.cwd(),
    catalogSignalKey = SKILLS_FACTORY_SIGNAL_KEYS.catalog,
    selectedSignalKey = SKILLS_FACTORY_SIGNAL_KEYS.selected,
  }: CreateSkillsFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const catalogSignal =
      signals.get(catalogSignalKey) ??
      signals.set({
        key: catalogSignalKey,
        schema: SkillsCatalogSchema,
        value: [],
        readOnly: false,
      })

    const selectedSignal =
      signals.get(selectedSignalKey) ??
      signals.set({
        key: selectedSignalKey,
        schema: SkillsSelectedSignalSchema,
        value: null,
        readOnly: false,
      })

    const loadCatalog = async () => {
      const { catalog, errors } = await loadSkillCatalog(rootDir)
      catalogSignal.set?.(catalog)
      selectedSignal.set?.(null)
      trigger({
        type: SKILLS_FACTORY_EVENTS.skills_factory_catalog_updated,
        detail: {
          rootDir,
          count: catalog.length,
          skills: catalog.map(({ name, description, skillPath, compatibility, allowedTools }) => ({
            name,
            description,
            skillPath,
            compatibility,
            allowedTools,
          })),
          errors,
        },
      })
    }

    const selectSkill = async (name: string) => {
      const catalog = (catalogSignal.get() ?? []) as SkillCatalogEntry[]
      const selectedEntry = catalog.find((entry) => entry.name === name)
      if (!selectedEntry) {
        trigger({
          type: SKILLS_FACTORY_EVENTS.skills_factory_selection_failed,
          detail: { name, reason: 'Skill not found in catalog' },
        })
        return
      }

      try {
        const markdown = await Bun.file(join(selectedEntry.skillDir, 'SKILL.md')).text()
        const { body } = parseMarkdownWithFrontmatter(markdown, SkillFrontMatterSchema)
        const selected = SelectedSkillSchema.parse({
          ...selectedEntry,
          body,
        })
        selectedSignal.set?.(selected)
        trigger({
          type: SKILLS_FACTORY_EVENTS.skills_factory_selected,
          detail: { name: selected.name, skillPath: selected.skillPath },
        })
      } catch (error) {
        trigger({
          type: SKILLS_FACTORY_EVENTS.skills_factory_selection_failed,
          detail: {
            name,
            reason: error instanceof Error ? error.message : String(error),
          },
        })
      }
    }

    void loadCatalog().catch((error) => {
      trigger({
        type: SKILLS_FACTORY_EVENTS.skills_factory_catalog_failed,
        detail: {
          rootDir,
          message: error instanceof Error ? error.message : String(error),
        },
      })
    })

    return {
      handlers: {
        [SKILLS_FACTORY_EVENTS.skills_factory_reload]() {
          void loadCatalog().catch((error) => {
            trigger({
              type: SKILLS_FACTORY_EVENTS.skills_factory_catalog_failed,
              detail: {
                rootDir,
                message: error instanceof Error ? error.message : String(error),
              },
            })
          })
        },
        [SKILLS_FACTORY_EVENTS.skills_factory_select](detail) {
          const parsed = SelectSkillDetailSchema.safeParse(detail)
          if (!parsed.success) {
            trigger({
              type: SKILLS_FACTORY_EVENTS.skills_factory_selection_failed,
              detail: { name: undefined, reason: 'Invalid selection payload' },
            })
            return
          }

          void selectSkill(parsed.data.name)
        },
      },
    }
  }

/**
 * Default singleton export for compatibility with existing references.
 *
 * @public
 */
export const skillFactory: Factory = createSkillsFactory()
