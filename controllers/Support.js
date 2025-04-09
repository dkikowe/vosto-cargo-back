import axios from "axios";

const TELEGRAM_BOT_TOKEN = "8148592903:AAGUHTCbv6QAYg4jhQ-3KwE5ZCV0gIfMfDg";
const CHAT_ID = 850493752;

export const sendSupportMessage = async (req, res) => {
  const { title, description, username } = req.body;

  if (!title || !description) {
    return res
      .status(400)
      .json({ error: "Поля title и description обязательны" });
  }

  const message = `🛠️ Новое обращение в техподдержку: от ${
    username || "неизвестно"
  }\n\n📌 *Тема:* ${title}\n📝 *Описание:* ${description}`;

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
        username: username,
      }
    );

    return res.status(200).json({ ok: true, message: "Отправлено в Telegram" });
  } catch (error) {
    console.error("Ошибка при отправке в Telegram:", error.message);
    return res.status(500).json({ error: "Ошибка при отправке в Telegram" });
  }
};
