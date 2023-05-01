import { DesignTokenGroup, GetFormatters } from '@plaited/token-types';
export declare const tokenTransformer: <T extends DesignTokenGroup = DesignTokenGroup>({ tokens, output, baseFontSize, cssFormatters, tsFormatters, }: {
    /** an object of the type {@link DesignTokenGroup} */
    tokens: T;
    /** directory we want to write transformed token too */
    output: string;
    /** used for rem calculation default 20 */
    baseFontSize?: number;
    /** extend the cssFormatters by passing in custom formatter */
    cssFormatters?: GetFormatters;
    /** extend the tsFormatters by passing in custom formatter */
    tsFormatters?: GetFormatters;
}) => Promise<void>;
