import { DesignTokenGroup, GetFormatters } from '@plaited/token-types';
export declare const transformTsTokens: ({ tokens, output, baseFontSize, formatters, }: {
    tokens: DesignTokenGroup;
    output: string;
    baseFontSize: number;
    formatters: GetFormatters;
}) => Promise<void>;
