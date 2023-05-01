import { DesignTokenGroup, GetFormatters } from '@plaited/token-types';
export declare const formatList: ({ tokens, tokenPath, formatters, allTokens, baseFontSize, }: {
    tokens: DesignTokenGroup;
    allTokens: DesignTokenGroup;
    tokenPath?: string[];
    formatters: GetFormatters;
    baseFontSize: number;
}) => string;
