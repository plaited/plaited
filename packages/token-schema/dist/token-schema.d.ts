import { DesignTokenGroup } from '@plaited/token-types';
export declare const tokenSchema: <T extends DesignTokenGroup = DesignTokenGroup>({ tokens, output, name }: {
    /** A object type {@link DesignTokenGroup} */
    tokens: T;
    /** directory you want to write json schema too */
    output: string;
    /** is the file name you want to use default to token-schema.json */
    name?: `${string}.json`;
}) => Promise<void>;
