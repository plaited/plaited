/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'http';
export declare const ssr: (ctx: ServerResponse, html: string) => ServerResponse<IncomingMessage>;
export declare const template: string;
