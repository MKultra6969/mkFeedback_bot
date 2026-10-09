import { table, integer, text, boolean, index, uniqueIndex, sql } from 'sdk/db';

// Database schema for the feedback bot. There are no foreign keys on this
// platform (the runtime runs with FKs off) — relationships are plain columns
// (Telegram user ids) and integrity lives in application code.

// Every Telegram user the bot has seen. `role` is 'user' | 'admin' | 'owner';
// the very first /claim wins the single 'owner' seat (enforced by the partial
// unique index uq_users_one_owner).
export const users = table('users', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  tgId:       integer('tg_id').notNull().unique(),
  firstName:  text('first_name'),
  lastName:   text('last_name'),
  username:   text('username'),
  lang:       text('lang').notNull().default('ru'),
  role:       text('role').notNull().default('user'),
  isBlocked:  boolean('is_blocked').notNull().default(false),
  createdAt:  integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  // Written by application code on every update — plain unix seconds, not a
  // timestamp-mode column, so no JS Date conversions are involved.
  lastSeenAt: integer('last_seen_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  roleIdx:  index('idx_users_role').on(t.role),
  oneOwner: uniqueIndex('uq_users_one_owner').on(t.role).where(sql`role = 'owner'`),
}));

// Every user message the bot relayed (one row per update, so an album of N
// photos is N rows). `media_group_id` lets the relay tell the first item of an
// album from the rest.
export const incoming = table('incoming', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  userId:       integer('user_id').notNull(),
  chatId:       integer('chat_id').notNull(),
  kind:         text('kind'),
  mediaGroupId: text('media_group_id'),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  userGroupIdx: index('idx_incoming_user_group').on(t.userId, t.mediaGroupId),
}));

// One row per message the bot sent to an admin on behalf of a user, including
// the header card. Used to route an admin's native reply back to the author.
export const relays = table('relays', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  adminId:    integer('admin_id').notNull(),
  adminMsgId: integer('admin_msg_id').notNull(),
  userId:     integer('user_id').notNull(),
  // Compared against a unix-seconds cutoff when old rows are swept: plain
  // integer, no timestamp mode.
  createdAt:  integer('created_at').notNull().default(sql`(unixepoch())`),
}, (t) => ({
  adminMsgIdx: index('idx_relays_admin_msg').on(t.adminId, t.adminMsgId),
  createdIdx:  index('idx_relays_created').on(t.createdAt),
}));

// Replies delivered from an admin to a user — for /stats.
export const replies = table('replies', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  adminId:   integer('admin_id').notNull(),
  userId:    integer('user_id').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Pending admin action: kind 'reply' (waiting for the answer to user targetId)
// or 'broadcast'. One pending action per admin; promptMsgId lets the bot clean
// up its own "write your reply" prompt afterwards.
export const sessions = table('sessions', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  adminId:     integer('admin_id').notNull().unique(),
  kind:        text('kind').notNull(),
  targetId:    integer('target_id'),
  promptMsgId: integer('prompt_msg_id'),
  updatedAt:   integer('updated_at').notNull().default(sql`(unixepoch())`),
});

// Broadcast history — for /stats.
export const broadcasts = table('broadcasts', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  byId:      integer('by_id').notNull(),
  sent:      integer('sent').notNull().default(0),
  failed:    integer('failed').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
