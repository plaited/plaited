import { DesignTokenGroup } from '@plaited/token-types';
export type Schema = {
    items?: Schema[] | Schema;
    required?: string[];
    properties?: Record<string, Schema>;
    const?: unknown;
    [key: string]: Record<string, Schema> | unknown;
};
export declare const parse: <T extends DesignTokenGroup = DesignTokenGroup>({ tokens, JsonSchema, isValue, hasValue, }: {
    tokens: T;
    JsonSchema?: Schema;
    isValue?: boolean;
    hasValue?: boolean;
}) => Schema;
