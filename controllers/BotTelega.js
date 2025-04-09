import { Telegraf } from "telegraf";
import dotenv from "dotenv";

dotenv.config();

// Токен можно хранить в переменных окружения, здесь для примера используется непосредственно
const token =
  process.env.BOT_TOKEN || "8148592903:AAGUHTCbv6QAYg4jhQ-3KwE5ZCV0gIfMfDg";
const bot = new Telegraf(token);

// Множества для хранения идентификаторов чатов подписанных на уведомления
const cargoSubscribers = new Set();
const vehicleSubscribers = new Set();

// Обработчик команды /start – показывает кнопки для подписки
bot.start((ctx) => {
  ctx.reply(
    "Добро пожаловать в логистический бот!\nВыберите раздел для подписки на уведомления:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Подписаться на уведомления о грузах",
              callback_data: "subscribeCargo",
            },
          ],
          [
            {
              text: "Подписаться на уведомления о машинах",
              callback_data: "subscribeVehicle",
            },
          ],
        ],
      },
    }
  );
});

// Обработчик подписки на уведомления о новых грузах
bot.action("subscribeCargo", (ctx) => {
  cargoSubscribers.add(ctx.chat.id);
  ctx.reply("Вы успешно подписались на уведомления о новых грузах!");
});

// Обработчик подписки на уведомления о новых машинах
bot.action("subscribeVehicle", (ctx) => {
  vehicleSubscribers.add(ctx.chat.id);
  ctx.reply("Вы успешно подписались на уведомления о новых машинах!");
});

// Команда для имитации добавления нового груза.
// В реальном приложении этот обработчик можно вызывать при изменениях в БД или через webhook.
bot.command("newCargo", async (ctx) => {
  const message = "Новый груз добавлен в систему!";
  for (const chatId of cargoSubscribers) {
    try {
      await bot.telegram.sendMessage(chatId, message);
    } catch (err) {
      console.error(`Ошибка отправки уведомления для чата ${chatId}:`, err);
    }
  }
  ctx.reply("Уведомления о новом грузе отправлены подписчикам.");
});

// Команда для имитации добавления новой машины.
bot.command("newVehicle", async (ctx) => {
  const message = "Новая машина добавлена в систему!";
  for (const chatId of vehicleSubscribers) {
    try {
      await bot.telegram.sendMessage(chatId, message);
    } catch (err) {
      console.error(`Ошибка отправки уведомления для чата ${chatId}:`, err);
    }
  }
  ctx.reply("Уведомления о новой машине отправлены подписчикам.");
});

// Запуск бота
bot.launch().then(() => {
  console.log("Бот успешно запущен.");
});
