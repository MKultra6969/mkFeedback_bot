// lib/i18n.js — plain ru/en string dictionaries and a tiny {placeholder}
// formatter. Pure data + functions: no SDK imports, easy to unit-test.

const ru = {
  // — user side —
  user_welcome:
    '👋 Привет! Это бот обратной связи.\n\n' +
    'Напишите здесь сообщение — и оно попадёт напрямую администратору. Можно отправлять текст, фото, видео, голосовые, документы, стикеры и геопозицию.\n\n' +
    'Ответ придёт в этот же чат.',
  user_help:
    'ℹ️ <b>Обратная связь</b>\n\n' +
    'Просто отправьте сообщение — я передам его администратору.\n\n' +
    'Поддерживаются: текст, фото, видео, кружки, голосовые, аудио, документы, стикеры, геопозиция.\n\n' +
    'Команды:\n/start — начать\n/help — помощь\n\nОтвет придёт в этот чат.',
  user_unknown_command: 'ℹ️ Просто отправьте сообщение — я передам его администратору.\n/help — помощь.',
  setup_hint: '⚙️ <i>Владелец ещё не назначен. Если это ваш бот — отправьте /claim.</i>',
  not_configured: '⏳ Бот ещё настраивается, сообщение пока не доставлено. Попробуйте позже.',
  delivery_failed: '⚠️ Не удалось доставить сообщение. Попробуйте ещё раз позже.',
  unsupported:
    '⚠️ Такое сообщение передать не получится. Отправьте текст, фото, видео, голосовое, документ или стикер.',

  // — owner claim —
  owner_claimed:
    '👑 <b>Готово!</b> Вы — владелец этого бота.\n\n' +
    'Сообщения пользователей будут приходить в этот чат. Отвечайте кнопкой «✍️ Ответить» под сообщением.\n\n' +
    '/help — команды администратора.',
  claim_taken: 'У этого бота уже есть владелец.',
  claim_already: '✅ Вы уже владелец этого бота.',

  // — relay card & buttons —
  relay_header: '📨 Новое сообщение от',
  btn_reply: '✍️ Ответить',
  btn_block: '🚫 Заблокировать',
  btn_unblock: '🔓 Разблокировать',

  // — admin reply flow —
  reply_prompt: '✍️ Напишите ответ для {name} следующим сообщением.\n/cancel — отмена.',
  reply_toast: '✍️ Отправьте ответ следующим сообщением',
  reply_sent: '✅ Ответ отправлен: {name}',
  reply_failed_blocked: '⚠️ Не доставлено: {name} заблокировал(а) бота.',
  reply_failed: '⚠️ Не удалось отправить: {error}',

  // — block / unblock —
  blocked_toast: '🚫 Заблокирован(а): {name}',
  unblocked_toast: '🔓 Разблокирован(а): {name}',
  blocked_note: '🚫 {name} заблокирован(а) — сообщения больше не приходят.',
  unblocked_note: '🔓 {name} разблокирован(а).',
  block_staff: 'Администраторов и владельца блокировать нельзя.',

  // — admin panel / help —
  admin_hint:
    'ℹ️ Чтобы ответить пользователю, нажмите «✍️ Ответить» под его сообщением или ответьте на пересланное сообщение.',
  admin_panel: '🛠 Вы вошли как <b>{role}</b>.\n\nСюда приходят сообщения пользователей.\n/help — команды, /stats — статистика.',
  admin_unknown_command: 'Неизвестная команда. /help — список команд.',
  admin_help:
    '🛠 <b>Команды администратора</b>\n\n' +
    '• Ответ пользователю — кнопка «✍️ Ответить» под сообщением или reply на него\n' +
    '• /stats — статистика\n' +
    '• /block 123… — заблокировать пользователя\n' +
    '• /unblock 123… — разблокировать\n' +
    '• /admins — команда бота\n' +
    '• /addadmin 123… — добавить администратора\n' +
    '• /deladmin 123… — убрать администратора\n' +
    '• /broadcast — рассылка (только владелец)\n' +
    '• /cancel — отменить текущее действие\n' +
    '• /id — мой ID',

  // — stats —
  stats_title: '📊 <b>Статистика</b>',
  stats_users: '👥 Пользователей: <b>{n}</b> (в блоке: {blocked})',
  stats_incoming: '📨 Сообщений получено: <b>{n}</b>',
  stats_replies: '✉️ Ответов отправлено: <b>{n}</b>',
  stats_staff: '👮 Команда: <b>{n}</b>',
  stats_broadcasts: '📣 Рассылок сделано: <b>{n}</b>',

  // — broadcast —
  broadcast_prompt: '📣 Отправьте сообщение для рассылки — оно уйдёт <b>{n}</b> пользователям.\n/cancel — отмена.',
  broadcast_empty: 'Пока нет пользователей, которым можно сделать рассылку.',
  broadcast_album: '⚠️ Альбом как рассылку отправить нельзя — отправьте одно сообщение.',
  broadcast_done: '✅ Рассылка завершена.\nДоставлено: <b>{ok}</b>\nОшибок: <b>{fail}</b>',

  // — admin management —
  cancel_done: 'Отменено.',
  nothing_cancel: 'Нечего отменять.',
  addadmin_usage: 'Использование: <code>/addadmin 123456789</code>\nИли ответьте этой командой на пересланное сообщение пользователя.',
  addadmin_done: '✅ {name} теперь администратор и будет получать сообщения пользователей.',
  addadmin_already: 'Этот пользователь уже администратор.',
  addadmin_owner: 'Это владелец бота.',
  deladmin_usage: 'Использование: <code>/deladmin 123456789</code>',
  deladmin_done: '✅ {name} больше не администратор.',
  deladmin_owner: 'Владельца нельзя убрать из администраторов.',
  deladmin_notadmin: 'Этот пользователь не администратор.',
  admins_title: '👮 <b>Команда бота</b>',
  block_usage: 'Использование: <code>/block 123456789</code>',
  unblock_usage: 'Использование: <code>/unblock 123456789</code>',
  user_not_found: 'Пользователь с таким ID не найден среди тех, кто писал боту.',
  id_text: '🆔 Ваш ID: <code>{id}</code>\nРоль: {role}',
  owner_only: '⛔ Эта команда доступна только владельцу бота.',
  unauth: '⛔ Недоступно.',

  // — roles —
  role_owner: 'владелец',
  role_admin: 'администратор',
  role_user: 'пользователь',
};

const en = {
  // — user side —
  user_welcome:
    '👋 Hi! This is a feedback bot.\n\n' +
    'Send a message here and it will go straight to the admin. Text, photos, videos, voice messages, documents, stickers and locations all work.\n\n' +
    'The reply will arrive in this chat.',
  user_help:
    'ℹ️ <b>Feedback</b>\n\n' +
    'Just send a message — I will pass it to the admin.\n\n' +
    'Supported: text, photos, videos, round videos, voice, audio, documents, stickers, location.\n\n' +
    'Commands:\n/start — begin\n/help — help\n\nReplies arrive in this chat.',
  user_unknown_command: 'ℹ️ Just send a message — I will pass it to the admin.\n/help — help.',
  setup_hint: '⚙️ <i>The owner has not been set yet. If this is your bot, send /claim.</i>',
  not_configured: '⏳ The bot is still being set up; your message has not been delivered yet. Please try again later.',
  delivery_failed: '⚠️ Could not deliver your message. Please try again later.',
  unsupported:
    '⚠️ This kind of message cannot be forwarded. Please send text, a photo, a video, a voice message, a document or a sticker.',

  // — owner claim —
  owner_claimed:
    '👑 <b>Done!</b> You are now the owner of this bot.\n\n' +
    'User messages will arrive in this chat. Answer with the «✍️ Reply» button under a message.\n\n' +
    '/help — admin commands.',
  claim_taken: 'This bot already has an owner.',
  claim_already: '✅ You are already the owner of this bot.',

  // — relay card & buttons —
  relay_header: '📨 New message from',
  btn_reply: '✍️ Reply',
  btn_block: '🚫 Block',
  btn_unblock: '🔓 Unblock',

  // — admin reply flow —
  reply_prompt: '✍️ Write your reply to {name} as the next message.\n/cancel — cancel.',
  reply_toast: '✍️ Send your reply as the next message',
  reply_sent: '✅ Reply sent to {name}',
  reply_failed_blocked: '⚠️ Not delivered: {name} blocked the bot.',
  reply_failed: '⚠️ Could not send: {error}',

  // — block / unblock —
  blocked_toast: '🚫 Blocked: {name}',
  unblocked_toast: '🔓 Unblocked: {name}',
  blocked_note: '🚫 {name} is blocked — their messages will no longer arrive.',
  unblocked_note: '🔓 {name} is unblocked.',
  block_staff: 'Admins and the owner cannot be blocked.',

  // — admin panel / help —
  admin_hint: 'ℹ️ To answer a user, press «✍️ Reply» under their message or reply to the forwarded one.',
  admin_panel: '🛠 You are signed in as <b>{role}</b>.\n\nUser messages arrive here.\n/help — commands, /stats — statistics.',
  admin_unknown_command: 'Unknown command. /help — command list.',
  admin_help:
    '🛠 <b>Admin commands</b>\n\n' +
    '• Answer a user — «✍️ Reply» button or a reply to their message\n' +
    '• /stats — statistics\n' +
    '• /block 123… — block a user\n' +
    '• /unblock 123… — unblock\n' +
    '• /admins — the bot team\n' +
    '• /addadmin 123… — add an admin\n' +
    '• /deladmin 123… — remove an admin\n' +
    '• /broadcast — broadcast (owner only)\n' +
    '• /cancel — cancel the current action\n' +
    '• /id — my ID',

  // — stats —
  stats_title: '📊 <b>Statistics</b>',
  stats_users: '👥 Users: <b>{n}</b> (blocked: {blocked})',
  stats_incoming: '📨 Messages received: <b>{n}</b>',
  stats_replies: '✉️ Replies sent: <b>{n}</b>',
  stats_staff: '👮 Team: <b>{n}</b>',
  stats_broadcasts: '📣 Broadcasts sent: <b>{n}</b>',

  // — broadcast —
  broadcast_prompt: '📣 Send the message to broadcast — it will go to <b>{n}</b> users.\n/cancel — cancel.',
  broadcast_empty: 'There are no users to broadcast to yet.',
  broadcast_album: '⚠️ An album cannot be broadcast — please send a single message.',
  broadcast_done: '✅ Broadcast finished.\nDelivered: <b>{ok}</b>\nFailed: <b>{fail}</b>',

  // — admin management —
  cancel_done: 'Cancelled.',
  nothing_cancel: 'Nothing to cancel.',
  addadmin_usage: 'Usage: <code>/addadmin 123456789</code>\nOr send this command as a reply to a user\'s forwarded message.',
  addadmin_done: '✅ {name} is now an admin and will receive user messages.',
  addadmin_already: 'This user is already an admin.',
  addadmin_owner: 'This is the bot owner.',
  deladmin_usage: 'Usage: <code>/deladmin 123456789</code>',
  deladmin_done: '✅ {name} is no longer an admin.',
  deladmin_owner: 'The owner cannot be removed from admins.',
  deladmin_notadmin: 'This user is not an admin.',
  admins_title: '👮 <b>Bot team</b>',
  block_usage: 'Usage: <code>/block 123456789</code>',
  unblock_usage: 'Usage: <code>/unblock 123456789</code>',
  user_not_found: 'No user with this ID has written to the bot.',
  id_text: '🆔 Your ID: <code>{id}</code>\nRole: {role}',
  owner_only: '⛔ This command is only for the bot owner.',
  unauth: '⛔ Not available.',

  // — roles —
  role_owner: 'owner',
  role_admin: 'admin',
  role_user: 'user',
};

const DICTS = { ru, en };

// Telegram language_code → one of our dictionaries. Russian-speaking users map
// to ru; everyone else gets en. A missing code defaults to ru (typical for
// `tgcloud run` test payloads of a Russian-language bot).
export function pickLang(code) {
  if (!code) return 'ru';
  return String(code).toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

// Look up `key` in `lang` (falling back to en) and fill {placeholders} from
// `params`. Values are trusted bot texts; interpolated values are escaped by
// the caller when they can come from users.
export function t(lang, key, params) {
  const dict = DICTS[lang] ?? DICTS.ru;
  let text = dict[key] ?? DICTS.en[key] ?? key;
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }
  return text;
}
