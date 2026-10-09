// handlers/message.js — the bot's front door: routes every private-chat message
// between the users and the staff (owner + admins).
//
//   user message      → relayed to every admin with a header card and buttons
//   admin reply       → native reply to a relayed message, or the ✍️ button
//   admin commands    → /stats /block /unblock /addadmin /deladmin /broadcast…
//   /claim            → the first claimant becomes the owner (the only one)

import { api } from 'sdk';
import { pickLang, t } from '../lib/i18n.js';
import {
  adminPanelText, adminsText, escapeHtml, idText, kindOf, nameOf, statsText, userWelcome,
} from '../lib/ui.js';
import * as store from '../lib/store.js';
import {
  broadcastToUsers, deleteMessageSafe, deliverReply, reactSeen, relayToAdmins,
} from '../lib/relay.js';

export default async function (message, ctx) {
  const chat = message?.chat;
  const from = message?.from;
  if (!chat || !from || from.is_bot) return;
  if (chat.type && chat.type !== 'private') return; // feedback bot: private chats only

  const user = await store.upsertUser(from);
  const lang = pickLang(user.lang);
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const staff = store.isStaff(user);

  if (!staff && user.isBlocked) {
    console.warn('message: ignored, blocked user', from.id);
    return;
  }

  if (text.startsWith('/')) {
    const command = text.slice(1).split(/[\s@]/)[0].toLowerCase();
    if (command === 'claim') {
      await handleClaim({ message, user, lang });
      return;
    }
    if (staff) {
      await handleAdminCommand({ message, user, lang, command, text });
    } else {
      await handleUserCommand({ message, user, lang, command });
    }
    return;
  }

  if (staff) {
    await handleAdminMessage({ message, user, lang });
  } else {
    await handleUserMessage({ message, user, lang });
  }
}

// ----------------------------------------------------------------- users ---

async function handleUserCommand({ message, user, lang, command }) {
  const chatId = message.chat.id;

  if (command === 'start') {
    const owner = await store.getOwner();
    await api.sendMessage({
      chat_id: chatId,
      text: userWelcome(lang, !owner),
      parse_mode: 'HTML',
    });
    return;
  }
  if (command === 'help') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'user_help'), parse_mode: 'HTML' });
    return;
  }
  if (command === 'id') {
    await api.sendMessage({ chat_id: chatId, text: idText(lang, user.tgId, user.role), parse_mode: 'HTML' });
    return;
  }
  await api.sendMessage({ chat_id: chatId, text: t(lang, 'user_unknown_command'), parse_mode: 'HTML' });
}

async function handleClaim({ message, user, lang }) {
  const result = await store.claimOwnership(user.tgId);
  const text = result === 'claimed'
    ? t(lang, 'owner_claimed')
    : result === 'already'
      ? t(lang, 'claim_already')
      : t(lang, 'claim_taken');
  await api.sendMessage({ chat_id: message.chat.id, text, parse_mode: 'HTML' });
  if (result === 'claimed') console.info('owner claimed by', user.tgId);
}

async function handleUserMessage({ message, user, lang }) {
  const owner = await store.getOwner();
  if (!owner) {
    await api.sendMessage({ chat_id: message.chat.id, text: t(lang, 'not_configured') });
    return;
  }
  if (kindOf(message) === null) {
    await api.sendMessage({ chat_id: message.chat.id, text: t(lang, 'unsupported') });
    return;
  }
  const delivered = await relayToAdmins({ message, userRow: user });
  if (delivered > 0) {
    await reactSeen(message);
    return;
  }
  await api.sendMessage({ chat_id: message.chat.id, text: t(lang, 'delivery_failed') });
}

// ----------------------------------------------------------------- staff ---

function parseIdArg(text) {
  const raw = text.split(/\s+/)[1] ?? '';
  const id = Number(raw.replace(/^@/, ''));
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : null;
}

async function handleAdminCommand({ message, user, lang, command, text }) {
  const chatId = message.chat.id;
  const session = await store.getSession(user.tgId);

  if (command === 'cancel') {
    if (!session) {
      await api.sendMessage({ chat_id: chatId, text: t(lang, 'nothing_cancel') });
      return;
    }
    await store.clearSession(user.tgId);
    await deleteMessageSafe(chatId, session.promptMsgId);
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'cancel_done') });
    return;
  }

  // Any other command abandons a pending reply/broadcast flow.
  if (session) {
    await store.clearSession(user.tgId);
    await deleteMessageSafe(chatId, session.promptMsgId);
  }

  switch (command) {
    case 'start':
      await api.sendMessage({ chat_id: chatId, text: adminPanelText(lang, user.role), parse_mode: 'HTML' });
      return;
    case 'help':
      await api.sendMessage({ chat_id: chatId, text: t(lang, 'admin_help'), parse_mode: 'HTML' });
      return;
    case 'id':
      await api.sendMessage({ chat_id: chatId, text: idText(lang, user.tgId, user.role), parse_mode: 'HTML' });
      return;
    case 'stats': {
      const stats = await store.getStats();
      await api.sendMessage({ chat_id: chatId, text: statsText(lang, stats), parse_mode: 'HTML' });
      return;
    }
    case 'admins': {
      const staff = await store.listStaff();
      await api.sendMessage({ chat_id: chatId, text: adminsText(lang, staff), parse_mode: 'HTML' });
      return;
    }
    case 'block':
      await cmdBlock({ message, user, lang, text, block: true });
      return;
    case 'unblock':
      await cmdBlock({ message, user, lang, text, block: false });
      return;
    case 'addadmin':
      await cmdAddAdmin({ message, user, lang, text });
      return;
    case 'deladmin':
      await cmdDelAdmin({ message, user, lang, text });
      return;
    case 'broadcast':
      await cmdBroadcast({ message, user, lang });
      return;
    default:
      await api.sendMessage({ chat_id: chatId, text: t(lang, 'admin_unknown_command') });
  }
}

async function cmdBlock({ message, user, lang, text, block }) {
  const chatId = message.chat.id;
  const targetId = parseIdArg(text);
  if (targetId == null) {
    await api.sendMessage({ chat_id: chatId, text: t(lang, block ? 'block_usage' : 'unblock_usage'), parse_mode: 'HTML' });
    return;
  }
  const target = await store.getUserById(targetId);
  if (!target) {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'user_not_found'), parse_mode: 'HTML' });
    return;
  }
  if (store.isStaff(target)) {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'block_staff'), parse_mode: 'HTML' });
    return;
  }
  await store.setBlocked(targetId, block);
  await api.sendMessage({
    chat_id: chatId,
    text: t(lang, block ? 'blocked_note' : 'unblocked_note', { name: nameOf(target) }),
    parse_mode: 'HTML',
  });
}

async function cmdAddAdmin({ message, user, lang, text }) {
  const chatId = message.chat.id;
  if (user.role !== 'owner') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'owner_only') });
    return;
  }

  let targetId = parseIdArg(text);
  if (targetId == null && message.reply_to_message) {
    const relay = await store.findRelay(chatId, message.reply_to_message.message_id);
    if (relay) targetId = relay.userId;
  }
  if (targetId == null) {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'addadmin_usage'), parse_mode: 'HTML' });
    return;
  }

  const target = await store.getUserById(targetId);
  if (target?.role === 'owner') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'addadmin_owner'), parse_mode: 'HTML' });
    return;
  }
  if (target?.role === 'admin') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'addadmin_already'), parse_mode: 'HTML' });
    return;
  }

  await store.setRole(targetId, 'admin');
  await store.setBlocked(targetId, false);
  const name = target ? nameOf(target) : `ID ${targetId}`;
  await api.sendMessage({ chat_id: chatId, text: t(lang, 'addadmin_done', { name }), parse_mode: 'HTML' });
}

async function cmdDelAdmin({ message, user, lang, text }) {
  const chatId = message.chat.id;
  if (user.role !== 'owner') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'owner_only') });
    return;
  }
  const targetId = parseIdArg(text);
  if (targetId == null) {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'deladmin_usage'), parse_mode: 'HTML' });
    return;
  }
  const target = await store.getUserById(targetId);
  if (!target || target.role === 'user') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'deladmin_notadmin'), parse_mode: 'HTML' });
    return;
  }
  if (target.role === 'owner') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'deladmin_owner'), parse_mode: 'HTML' });
    return;
  }
  await store.setRole(targetId, 'user');
  await api.sendMessage({ chat_id: chatId, text: t(lang, 'deladmin_done', { name: nameOf(target) }), parse_mode: 'HTML' });
}

async function cmdBroadcast({ message, user, lang }) {
  const chatId = message.chat.id;
  if (user.role !== 'owner') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'owner_only') });
    return;
  }
  const targets = await store.listBroadcastRecipients();
  if (!targets.length) {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'broadcast_empty') });
    return;
  }
  const prompt = await api.sendMessage({
    chat_id: chatId,
    text: t(lang, 'broadcast_prompt', { n: targets.length }),
    parse_mode: 'HTML',
  });
  await store.setSession({ adminId: user.tgId, kind: 'broadcast', promptMsgId: prompt.message_id });
}

async function handleAdminMessage({ message, user, lang }) {
  const chatId = message.chat.id;
  const session = await store.getSession(user.tgId);

  // 1) Native reply to a relayed message — route by our relays map.
  if (message.reply_to_message) {
    const relay = await store.findRelay(chatId, message.reply_to_message.message_id);
    if (relay) {
      await finishReply({ message, user, lang, targetId: relay.userId, session });
      return;
    }
  }

  // 2) The ✍️ button was pressed earlier: this message is the answer.
  if (session?.kind === 'reply') {
    await finishReply({ message, user, lang, targetId: session.targetId, session });
    return;
  }

  // 3) A broadcast is waiting for its content.
  if (session?.kind === 'broadcast') {
    if (message.media_group_id != null) {
      await api.sendMessage({ chat_id: chatId, text: t(lang, 'broadcast_album'), parse_mode: 'HTML' });
      return; // keep waiting — the album was not consumed
    }
    const result = await broadcastToUsers({ adminMsg: message, byId: user.tgId });
    await deleteMessageSafe(chatId, session.promptMsgId);
    await store.clearSession(user.tgId);
    await api.sendMessage({
      chat_id: chatId,
      text: t(lang, 'broadcast_done', { ok: result.ok, fail: result.failed }),
      parse_mode: 'HTML',
    });
    return;
  }

  await api.sendMessage({ chat_id: chatId, text: t(lang, 'admin_hint'), parse_mode: 'HTML' });
}

async function finishReply({ message, user, lang, targetId, session }) {
  const chatId = message.chat.id;
  const target = await store.getUserById(targetId);
  const name = target ? nameOf(target) : `ID ${targetId}`;
  const result = await deliverReply({ adminMsg: message, targetId });

  if (result.ok) {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'reply_sent', { name }), parse_mode: 'HTML' });
  } else if (result.reason === 'blocked') {
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'reply_failed_blocked', { name }), parse_mode: 'HTML' });
  } else {
    const detail = escapeHtml(String(result.detail ?? '').slice(0, 200));
    await api.sendMessage({ chat_id: chatId, text: t(lang, 'reply_failed', { error: detail }), parse_mode: 'HTML' });
  }

  if (session?.kind === 'reply') {
    await store.clearSession(user.tgId);
    await deleteMessageSafe(chatId, session.promptMsgId);
  }
}
