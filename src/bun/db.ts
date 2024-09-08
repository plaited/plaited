import { Database } from "bun:sqlite";

export const db = new Database(":memory:");
db.query(`create table templates;`);