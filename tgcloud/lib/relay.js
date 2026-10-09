// lib/relay.js — moving messages between the three parties:
//   user → staff (relayToAdmins), staff → user (deliverReply),
//   owner → all users (broadcastToUsers).

import { api, BotApiError } from 'sdk';
import { pickLang } from './i18n.js';
import { kindOf, relayHeader, relayKeyboard } from './ui.js';
import * as store from './store.js';

// Copy-first, forward-as-fallback, so message types the Bot API refuses to
// copy (and users with forwarding restrictions) still get through.
async function sendCopy({ chatId, fromChatId, messageId }) {
  try {
    const message = await api.copyMessage({
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
    });
    return { message };
  } catch (copyError) {
    try {
      const message = await api.forwardMessage({
        chat_id: chatId,
        from_chat_id: fromChatId,
        message_id: messageId,
      });
      return { message };
    } catch (forwardError) {
      // "bot was blocked" (403) is the same for both attempts; prefer the
      // clearer copy error for any other combination.
      const error = copyError instanceof BotApiError && copyError.code === 403
        ? copyError
        : (forwardError instanceof BotApiError ? forwardError : copyError);
      return { error };
    }
  }
}

// Relay one user message to every admin. Album items are individual updates;
// the header card (with the Reply/Block buttons) is sent once per album — the
// first item carries it, the rest arrive right under it.
export async function relayToAdmins({ message, userRow }) {
  const staff = await store.listStaff();
  const mediaGroupId = message.media_group_id ?? null;
  const alreadySeen = mediaGroupId != null
    && await store.groupAlreadyRelayed(userRow.tgId, mediaGroupId);

  await store.recordIncoming({
    userId: userRow.tgId,
    chatId: message.chat.id,
    kind: kindOf(message),
    mediaGroupId,
  });

  const relayRows = [];
  let delivered = 0;

  for (const admin of staff) {
    if (admin.isBlocked) continue;
    const lang = pickLang(admin.lang);
    try {
      if (!alreadySeen) {
        const header = await api.sendMessage({
          chat_id: admin.tgId,
          text: relayHeader(lang, userRow),
          parse_mode: 'HTML',
          reply_markup: relayKeyboard(lang, userRow.tgId, false),
        });
        relayRows.push({ adminId: admin.tgId, adminMsgId: header.message_id, userId: userRow.tgId });
      }
      const copy = await sendCopy({
        chatId: admin.tgId,
        fromChatId: message.chat.id,
        messageId: message.message_id,
      });
      if (copy.message) {
        relayRows.push({ adminId: admin.tgId, adminMsgId: copy.message.message_id, userId: userRow.tgId });
        delivered += 1;
      } else {
        console.error('relay: copy failed for admin', admin.tgId, copy.error?.description ?? copy.error);
      }
    } catch (error) {
      console.error('relay: admin failed', admin.tgId, error?.description ?? error);
    }
  }

  await store.addRelays(relayRows);
  try {
    await store.cleanupRelays();
  } catch (error) {
    console.warn('relay: cleanup failed', error?.message ?? error);
  }
  return delivered;
}

// Deliver an admin's message to a user. Returns { ok } or
// { ok: false, reason: 'blocked' | 'failed', detail }.
export async function deliverReply({ adminMsg, targetId }) {
  const result = await sendCopy({
    chatId: targetId,
    fromChatId: adminMsg.chat.id,
    messageId: adminMsg.message_id,
  });
  if (result.message) {
    await store.recordReply(adminMsg.from.id, targetId);
    return { ok: true };
  }
  return {
    ok: false,
    reason: result.error?.code === 403 ? 'blocked' : 'failed',
    detail: result.error?.description ?? 'copy failed',
  };
}

// Send one owner message to every non-blocked regular user. Sequential so the
// Bot API's ~30 msg/s limit is never hit; failures are counted, not fatal.
export async function broadcastToUsers({ adminMsg, byId }) {
  const targets = await store.listBroadcastRecipients();
  let ok = 0;
  let failed = 0;
  for (const user of targets) {
    const result = await sendCopy({
      chatId: user.tgId,
      fromChatId: adminMsg.chat.id,
      messageId: adminMsg.message_id,
    });
    if (result.message) {
      ok += 1;
    } else {
      failed += 1;
      console.warn('broadcast: failed for', user.tgId, result.error?.description ?? result.error);
    }
  }
  await store.recordBroadcast(byId, ok, failed);
  return { ok, failed, total: targets.length };
}

// Best-effort "delivered" reaction on the user's own message.
export async function reactSeen(message) {
  try {
    await api.setMessageReaction({
      chat_id: message.chat.id,
      message_id: message.message_id,
      reaction: [{ type: 'emoji', emoji: '👌' }],
    });
  } catch (error) {
    // Reactions are a nice-to-have: old Bot API versions / restricted chats.
  }
}

export async function deleteMessageSafe(chatId, messageId) {
  if (messageId == null) return;
  try {
    await api.deleteMessage({ chat_id: chatId, message_id: messageId });
  } catch (error) {
    // Already deleted / too old — nothing to do.
  }
}
