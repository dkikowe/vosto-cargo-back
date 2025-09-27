import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";

const apiId = 27860754; // замените на свой api_id с my.telegram.org
const apiHash = "3b43e22022d815ba5e771d2d86526aa0";
const stringSession = new StringSession(""); // пустая строка — нет сессии

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

(async () => {
  await client.start({
    phoneNumber: async () => await input.text("Введите номер (+7...): "),
    password: async () => await input.text("Введите 2FA пароль (если есть): "),
    phoneCode: async () => await input.text("Введите код из Telegram: "),
    onError: (err) => console.log("Ошибка:", err),
  });

  console.log("Успешный вход!");
  console.log("Session string:", client.session.save());
})();
