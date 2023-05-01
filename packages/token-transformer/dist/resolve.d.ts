/**
 * Utility helpers for resolving aliased values in tokens object
 */
import { DesignToken, DesignTokenGroup } from '@plaited/token-types';
export declare const hasAlias: ($value: unknown) => boolean;
export declare const resolve: (value: string, allTokens: DesignTokenGroup | undefined) => [DesignToken, string[]] | undefined;
export declare const resolveCSSVar: (value: string, allTokens: DesignTokenGroup | undefined) => string;
export declare const resolveTSVar: (value: string, allTokens: DesignTokenGroup) => any;
