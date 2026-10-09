// handlers/callback_query.js — the buttons under relayed messages:
//   r:<userId> — ✍️ start writing a reply to that user
//   b:<userId> — 🚫 block the user (button flips to 🔓)
//   u:<userId> — 🔓 unblock the user
// Only the owner and admins may use them.

import { api } from 'sdk';
import { pickLang, t } from '../lib/i18n.js';
import { nameOf, relayKeyboard } from '../lib/ui.js';
import * as store from '../lib/store.js';
import { deleteMessageSafe } from '../lib/relay.js';

// A callback answer that must never break the flow (the query may have expired).
async function toast(query, text, showAlert = false) {
  try {
    await api.answerCallbackQuery({
      callback_query_id: query.id,
      text,
      ...(showAlert ? { show_alert: true } : {}),
    });
  } catch (error) {
    console.warn('callback: answer failed', error?.description ?? error);
  }
}

export default async function (query) {
  const from = query?.from;
  if (!from) return;

  const user = await store.upsertUser(from);
  const lang = pickLang(user.lang);

  if (!store.isStaff(user)) {
    await toast(query, t(lang, 'unauth'));
    return;
  }

  const data = typeof query?.data === 'string' ? query.data : '';
  const [action, rawId] = data.split(':');
  const targetId = Number(rawId);
  if (!Number.isFinite(targetId) || targetId <= 0) {
    await toast(query, t(lang, 'unauth'));
    return;
  }

  if (action === 'r') {
    // Show a prompt and remember who this admin is replying to.
    const target = await store.getUserById(targetId);
    const name = target ? nameOf(target) : `ID ${targetId}`;

    const previous = await store.getSession(user.tgId);
    if (previous?.promptMsgId) await deleteMessageSafe(from.id, previous.promptMsgId);

    const prompt = await api.sendMessage({
      chat_id: from.id,
      text: t(lang, 'reply_prompt', { name }),
      parse_mode: 'HTML',
    });
    await store.setSession({ adminId: user.tgId, kind: 'reply', targetId, promptMsgId: prompt.message_id });
    await toast(query, t(lang, 'reply_toast'));
    return;
  }

  if (action === 'b' || action === 'u') {
    const block = action === 'b';
    const target = await store.getUserById(targetId);
    if (target && store.isStaff(target)) {
      await toast(query, t(lang, 'block_staff'), true);
      return;
    }
    await store.setBlocked(targetId, block);

    // Flip the button on the card, so the state is visible at a glance.
    if (query.message) {
      try {
        await api.editMessageReplyMarkup({
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: relayKeyboard(lang, targetId, block),
        });
      } catch (error) {
        // Message too old / where editing is not allowed — state is already saved.
      }
    }

    const name = target ? nameOf(target) : `ID ${targetId}`;
    await toast(query, t(lang, block ? 'blocked_toast' : 'unblocked_toast', { name }));
    return;
  }

  await toast(query, t(lang, 'unauth'));
}
