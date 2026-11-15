import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const roster = sqliteTable('roster', {
  id: integer('id').primaryKey(),
  version: integer('version').notNull(),
  data: text('data').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const rosterHistory = sqliteTable('roster_history', {
  version: integer('version').primaryKey(),
  data: text('data').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const hands = sqliteTable('career_hands', {
  id: text('id').primaryKey(),
  tableId: text('table_id').notNull(),
  handNumber: integer('hand_number').notNull(),
  rosterVersion: integer('roster_version').notNull(),
  recordedAt: integer('recorded_at').notNull(),
  payload: text('payload').notNull(),
});
export const results = sqliteTable('career_results', {
  handId: text('hand_id').notNull(),
  playerId: text('player_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  net: integer('net').notNull(),
}, table => [primaryKey({ columns: [table.handId, table.playerId] })]);
