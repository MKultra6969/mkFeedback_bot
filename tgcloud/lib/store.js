// lib/store.js — every database read/write the bot does, one place. All SDK db
// calls are async and must be awaited. Table definitions: ../schema.js.

import { db } from 'sdk';
import { and, eq, inArray, lt } from 'sdk/db';
import { broadcasts, incoming, relays, replies, sessions, users } from '../schema.js';
import { pickLang } from './i18n.js';

const STAFF_ROLES = ['owner', 'admin'];

// Native replies are routed through the `relays` map; entries older than this
// are swept so the table cannot grow forever.
const RELAY_TTL_DAYS = 30;

export function isStaff(row) {
  return row != null && STAFF_ROLES.includes(row.role);
}

function now() {
  return Math.floor(Date.now() / 1000);
}

// ---------------------------------------------------------------- users ----

// Remember (or refresh) the sender and return the fresh row.
export async function upsertUser(from) {
  const values = {
    tgId: from.id,
    firstName: from.first_name ?? null,
    lastName: from.last_name ?? null,
    username: from.username ?? null,
    lang: pickLang(from.language_code),
    lastSeenAt: now(),
  };
  await db.insert(users)
    .values(values)
    .onConflictDoUpdate({
      target: users.tgId,
      set: {
        firstName: values.firstName,
        lastName: values.lastName,
        username: values.username,
        lang: values.lang,
        lastSeenAt: values.lastSeenAt,
      },
    })
    .run();
  return getUserById(from.id);
}

export async function getUserById(tgId) {
  return db.select().from(users).where(eq(users.tgId, tgId)).get();
}

export async function getOwner() {
  return db.select().from(users).where(eq(users.role, 'owner')).get();
}

// Owner first is not guaranteed here; ui.adminsText sorts for display.
export async function listStaff() {
  return db.select().from(users).where(inArray(users.role, STAFF_ROLES)).all();
}

// The single 'owner' seat. The partial unique index uq_users_one_owner makes
// two simultaneous claims impossible: the loser's UPDATE fails and we report
// the winner. Returns 'claimed' | 'already' | 'taken'.
export async function claimOwnership(tgId) {
  const owner = await getOwner();
  if (owner) return owner.tgId === tgId ? 'already' : 'taken';
  try {
    await db.update(users).set({ role: 'owner' }).where(eq(users.tgId, tgId)).run();
    return 'claimed';
  } catch (error) {
    const winner = await getOwner();
    if (winner) return winner.tgId === tgId ? 'already' : 'taken';
    throw error;
  }
}

// Promote/demote: creates the row for a user the bot has never seen.
export async function setRole(tgId, role) {
  await db.insert(users)
    .values({ tgId, role, lastSeenAt: now() })
    .onConflictDoUpdate({ target: users.tgId, set: { role } })
    .run();
}

export async function setBlocked(tgId, blocked) {
  await db.update(users).set({ isBlocked: blocked }).where(eq(users.tgId, tgId)).run();
}

// ------------------------------------------------------- incoming log ------

// True when an earlier item of the same album has already been relayed, so the
// header card is only sent once per album.
export async function groupAlreadyRelayed(userId, mediaGroupId) {
  const row = await db.select({ id: incoming.id })
    .from(incoming)
    .where(and(eq(incoming.userId, userId), eq(incoming.mediaGroupId, mediaGroupId)))
    .limit(1)
    .get();
  return row != null;
}

export async function recordIncoming({ userId, chatId, kind, mediaGroupId = null }) {
  await db.insert(incoming).values({ userId, chatId, kind, mediaGroupId }).run();
}

// ------------------------------------------------------ reply routing ------

export async function addRelays(rows) {
  if (rows.length) await db.insert(relays).values(rows).run();
}

// Which user was the source of an admin-chat message? (native reply routing)
export async function findRelay(adminId, adminMsgId) {
  return db.select().from(relays)
    .where(and(eq(relays.adminId, adminId), eq(relays.adminMsgId, adminMsgId)))
    .get();
}

export async function cleanupRelays() {
  await db.delete(relays).where(lt(relays.createdAt, now() - RELAY_TTL_DAYS * 86400)).run();
}

export async function recordReply(adminId, userId) {
  await db.insert(replies).values({ adminId, userId }).run();
}

// -------------------------------------------------------- sessions ---------

export async function getSession(adminId) {
  return db.select().from(sessions).where(eq(sessions.adminId, adminId)).get();
}

export async function setSession({ adminId, kind, targetId = null, promptMsgId = null }) {
  await db.insert(sessions)
    .values({ adminId, kind, targetId, promptMsgId, updatedAt: now() })
    .onConflictDoUpdate({
      target: sessions.adminId,
      set: { kind, targetId, promptMsgId, updatedAt: now() },
    })
    .run();
}

export async function clearSession(adminId) {
  await db.delete(sessions).where(eq(sessions.adminId, adminId)).run();
}

// -------------------------------------------------------- broadcast --------

export async function listBroadcastRecipients() {
  return db.select().from(users)
    .where(and(eq(users.role, 'user'), eq(users.isBlocked, false)))
    .all();
}

export async function recordBroadcast(byId, sent, failed) {
  await db.insert(broadcasts).values({ byId, sent, failed }).run();
}

// ----------------------------------------------------------- stats ---------

export async function getStats() {
  const [usersN, blockedN, incomingN, repliesN, staffN, broadcastsN] = await Promise.all([
    db.$count(users),
    db.$count(users, eq(users.isBlocked, true)),
    db.$count(incoming),
    db.$count(replies),
    db.$count(users, inArray(users.role, STAFF_ROLES)),
    db.$count(broadcasts),
  ]);
  return { usersN, blockedN, incomingN, repliesN, staffN, broadcastsN };
}
