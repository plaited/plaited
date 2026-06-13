// import { PLAITED_TEMPLATE_IDENTIFIER, type SCALE, SCALE_RANK } from '../ui.ts'
// import { isTypeOf } from '../utils.ts'
// import { B_PROGRAM_IDENTIFIER } from './agent.constants.ts'

/**
 * we need to validate that the package export is a single file not a directory
 * we then need to loop through the exports and grab the ones that are function or and have $ equal to B_PROGRAM_IDENTIFIER
 *
 */
export const getBehaviorsExports = async () => {}

/**
 * we need to validate that the package export is a single file not a directory
 * we then need to loop through the exports and grab the ones that are function or and have $ equal to PLAITED_TEMPLATE_IDENTIFIER
 * It should also have a scale and inputSchema
 */
export const getTemplatesExports = async () => {}

/**
 * we need to validate the package export is a directory
 * We need then to then loop throughthe directory to get it's direct child directories.
 * for each directory we want to veiry that the only direct child of that folder is a SKILL.md file
 * we then want to use our markdown cli util with Bun.$ to get body and yaml if it's missing either the skill is invalid
 * once we have the yaml we want to validate it agimnst the skills spec. specifically the frontmatter part https://agentskills.io/specification#frontmatter
 * The skil should only contain the SKILL.md file and a scripts directory. It should not c
 */
export const getSkilsExports = async () => {}

/**
 * So what this means is that our main topic loads these and this is context any topic can grab
 *  we should be able to then send a a request to main that loads skills
 */
