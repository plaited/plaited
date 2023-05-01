import { DesignTokenGroup, GetFormatters } from '@plaited/token-types';
export declare const transformCssTokens: ({ tokens, output, baseFontSize, formatters, }: {
    tokens: DesignTokenGroup;
    output: string;
    baseFontSize: number;
    formatters: GetFormatters;
}) => Promise<void>;
