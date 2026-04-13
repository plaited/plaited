import type { Module } from '../../agent.ts'

/**
 * Placeholder module surface for continual eval and bounded self-improvement.
 *
 * @public
 */
export const autoresearchModule: Module = () => ({})

/**
 * Creates the base autoresearch-module scaffold.
 *
 * @public
 */
export const createAutoresearchModule = (): Module => autoresearchModule
