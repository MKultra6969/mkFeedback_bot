// lib/ui.js — HTML escaping, user display names and every message/keyboard the
// bot builds. Pure helpers (i18n + string work only), no database, no Bot API.

import { t } from './i18n.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
}

// A stored user row ({ tgId, firstName, lastName, username, ... }) → safe bold
// display name. Never returns HTML-breaking characters.
export function nameOf(user) {
  if (!user) return '—';
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (full) return escapeHtml(full);
  if (user.username) return escapeHtml('@' + user.username);
  return `ID ${user.tgId}`;
}

// "@username · ID: 123" or just "ID: 123" — both HTML-safe.
export function contactOf(user) {
  if (!user) return '';
  return user.username
    ? `@${escapeHtml(user.username)} · ID: <code>${user.tgId}</code>`
    : `ID: <code>${user.tgId}</code>`;
}

// The card admins see above every user message.
export function relayHeader(lang, user) {
  return `${t(lang, 'relay_header')} <b>${nameOf(user)}</b>\n${contactOf(user)}`;
}

// Inline buttons under a relayed message: reply always, block ⇄ unblock.
export function relayKeyboard(lang, tgId, blocked = false) {
  const toggle = blocked
    ? { text: t(lang, 'btn_unblock'), callback_data: `u:${tgId}` }
    : { text: t(lang, 'btn_block'), callback_data: `b:${tgId}` };
  return {
    inline_keyboard: [[
      { text: t(lang, 'btn_reply'), callback_data: `r:${tgId}` },
      toggle,
    ]],
  };
}

export function userWelcome(lang, showSetupHint = false) {
  const text = t(lang, 'user_welcome');
  return showSetupHint ? `${text}\n\n${t(lang, 'setup_hint')}` : text;
}

export function adminPanelText(lang, role) {
  return t(lang, 'admin_panel', { role: t(lang, `role_${role}`) });
}

export function idText(lang, tgId, role) {
  return t(lang, 'id_text', { id: tgId, role: t(lang, `role_${role}`) });
}

export function statsText(lang, stats) {
  return [
    t(lang, 'stats_title'),
    '',
    t(lang, 'stats_users', { n: stats.usersN, blocked: stats.blockedN }),
    t(lang, 'stats_incoming', { n: stats.incomingN }),
    t(lang, 'stats_replies', { n: stats.repliesN }),
    t(lang, 'stats_staff', { n: stats.staffN }),
    t(lang, 'stats_broadcasts', { n: stats.broadcastsN }),
  ].join('\n');
}

// Owner first, then admins, each with a badge, name and contact.
export function adminsText(lang, staff) {
  const order = { owner: 0, admin: 1 };
  const sorted = [...staff].sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9));
  const lines = [t(lang, 'admins_title'), ''];
  for (const member of sorted) {
    const badge = member.role === 'owner' ? '👑' : '🛡';
    lines.push(`${badge} ${nameOf(member)} · ${contactOf(member)}`);
  }
  return lines.join('\n');
}

// The message type the bot can relay (used for the incoming log and for
// friendly "unsupported" rejections). Returns null for anything we can't copy.
const KIND_FIELDS = [
  'text', 'animation', 'audio', 'document', 'photo', 'sticker',
  'video', 'video_note', 'voice', 'location', 'venue', 'contact', 'dice', 'poll',
];

export function kindOf(message) {
  for (const field of KIND_FIELDS) {
    if (message?.[field] != null) return field;
  }
  return null;
}
