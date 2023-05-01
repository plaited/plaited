import { mkdir } from 'node:fs/promises';
import { parse } from './parse.js';
export const tokenSchema = async ({ tokens, output, name = 'token-schema.json' }) => {
    const schema = parse({ tokens });
    await mkdir(output, { recursive: true });
    await Bun.write(`${output}/${name}`, JSON.stringify(schema, null, 2));
};
