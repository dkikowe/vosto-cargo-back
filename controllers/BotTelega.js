import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Order, CargoOrder, MachineOrder } from "../models/Order.js";
import User from "../models/User.js";
dotenv.config();

const token = process.env.BOT_TOKEN;
const botUsername = process.env.BOT_USERNAME;
const bot = new Telegraf(token);

const cargoSubscribers = new Set();
const vehicleSubscribers = new Set();

const mainMenuKeyboard = {
  keyboard: [
    ["Грузы", "Машины"],
    ["Калькулятор"],
    ["Отследить перевозку"],
    ["Перейти в приложение"],
    ["Написать в поддержку"],
  ],
  resize_keyboard: true,
};

bot.start(async (ctx) => {
  await ctx.reply(
    "Добро пожаловать! Я чат-бот, который поможет тебе получать заказы на спецтехнику в режиме реального времени. Просто выбери нужную категорию в меню, чтобы начать получать заявки. Будем рады помочь!",
    { reply_markup: mainMenuKeyboard }
  );
});

bot.hears("Назад", async (ctx) => {
  await ctx.reply("Вы вернулись в главное меню", {
    reply_markup: mainMenuKeyboard,
  });
});

bot.hears("Грузы", async (ctx) => {
  cargoSubscribers.add(ctx.chat.id);
  await ctx.reply("✅ Вы подписались на заявки по грузам.");
});

bot.hears("Машины", async (ctx) => {
  vehicleSubscribers.add(ctx.chat.id);
  await ctx.reply("✅ Вы подписались на заявки по машинам.");
});

const webAppUrl = "https://vosto-cargo-front.vercel.app";

const webAppReply = {
  keyboard: [
    [
      {
        text: "Открыть в приложении",
        web_app: {
          url: webAppUrl,
        },
      },
    ],
    ["Назад"],
  ],
  resize_keyboard: true,
};

bot.hears("Калькулятор", async (ctx) => {
  await ctx.reply("Калькулятор доступен в приложении", {
    reply_markup: webAppReply,
  });
});

bot.hears("Отследить перевозку", async (ctx) => {
  await ctx.reply("Трекинг доступен в приложении", {
    reply_markup: webAppReply,
  });
});

bot.hears("Перейти в приложение", async (ctx) => {
  await ctx.reply("Откройте приложение", {
    reply_markup: webAppReply,
  });
});

bot.hears("Написать в поддержку", async (ctx) => {
  await ctx.reply("Свяжитесь с поддержкой через приложение ", {
    reply_markup: webAppReply,
  });
});

function formatCargoText(order, nickname) {
  const num = order.orderNumber;
  const date = new Date(order.createdAt).toLocaleDateString("ru-RU");
  const time = new Date(order.createdAt).toLocaleTimeString("ru-RU");
  const route = `${order.from || "?"} – ${order.to || "?"}`;

  return `
📦 *Новый груз №${num}*
Дата: ${date}   Время: ${time}

👤 *Пользователь:* ${nickname}
💰 *Оплата:* ${order.paymentMethod || "не указано"}

🛣 *Маршрут:* ${route}
*Груз:* ${order.cargo || "не указано"}
⚖️ *Вес/Объём:* ${order.weight || "?"} кг / ${order.volume || "?"} м3
🚛 *Тип кузова:* ${order.vehicle || "не указано"}
📌 *Требования:* ${order.description || "не указано"}
`.trim();
}

function formatMachineText(order, nickname) {
  const num = order.orderNumber;
  const date = new Date(order.createdAt).toLocaleDateString("ru-RU");
  const time = new Date(order.createdAt).toLocaleTimeString("ru-RU");
  const route = `${order.otkuda || "?"} – ${order.kuda || "?"}`;

  return `
🚛 *Новая машина №${num}*
Дата: ${date}   Время: ${time}

👤 *Пользователь:* ${nickname}
🚘 *Марка:* ${order.marka || "не указано"}
📄 *Тип:* ${order.tip || "не указано"}
🚚 *Кузов:* ${order.kuzov || "не указано"}
📦 *Тип загрузки:* ${order.tip_zagruzki || "не указано"}
⚙️ *Грузоподъёмность:* ${order.gruzopodyomnost || "не указано"}
👥 *Вместимость:* ${order.vmestimost || "не указано"}
📅 *Готовность:* ${order.data_gotovnosti || "не указано"}

🛣 *Маршрут:* ${route}
🏢 *Компания:* ${order.company || order.firma || "неизвестно"}
`.trim();
}

function buildKeyboard(orderId, routeLabel, contactLabel) {
  const deepRoute = `https://t.me/${botUsername}?startapp=route_${orderId}`;
  const deepContact = `https://t.me/${botUsername}?startapp=contact_${orderId}`;
  return {
    inline_keyboard: [
      [{ text: "📍 Посмотреть маршрут", url: deepRoute }],
      [{ text: contactLabel, url: deepContact }],
    ],
  };
}

bot.command("newCargo", async (ctx) => {
  try {
    const latest = await CargoOrder.findOne().sort({ createdAt: -1 });
    if (!latest) return ctx.reply("Нет заявок по грузам.");
    const user = await User.findById(latest.createdBy);
    const nickname = user?.name || user?.username || "неизвестно";
    const text = formatCargoText(latest, nickname);
    const kb = buildKeyboard(
      latest._id,
      "Посмотреть маршрут",
      "Связаться с заказчиком"
    );

    for (const id of cargoSubscribers) {
      await bot.telegram.sendMessage(id, text, {
        reply_markup: kb,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    }
    ctx.reply("Тестовое уведомление о грузе отправлено.");
  } catch (err) {
    console.error(err);
    ctx.reply("Ошибка при отправке теста груза.");
  }
});

bot.command("newMachine", async (ctx) => {
  try {
    const latest = await MachineOrder.findOne().sort({ createdAt: -1 });
    if (!latest) return ctx.reply("Нет заявок по машинам.");
    const user = await User.findById(latest.createdBy);
    const nickname = user?.name || user?.username || "неизвестно";
    const text = formatMachineText(latest, nickname);
    const kb = buildKeyboard(
      latest._id,
      "Посмотреть маршрут",
      "Связаться с перевозчиком"
    );

    for (const id of vehicleSubscribers) {
      await bot.telegram.sendMessage(id, text, {
        reply_markup: kb,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    }
    ctx.reply("Тестовое уведомление о машине отправлено.");
  } catch (err) {
    console.error(err);
    ctx.reply("Ошибка при отправке теста машины.");
  }
});

mongoose.connection.once("open", () => {
  const stream = Order.watch([], { fullDocument: "updateLookup" });
  stream.on("change", async (change) => {
    if (change.operationType !== "insert") return;
    const doc = change.fullDocument;
    const user = await User.findById(doc.createdBy);
    const nickname = user?.name || user?.username || "неизвестно";
    let text, kb, subs;

    if (doc.orderType === "CargoOrder") {
      text = formatCargoText(doc, nickname);
      kb = buildKeyboard(
        doc._id,
        "Посмотреть маршрут",
        "Связаться с заказчиком"
      );
      subs = cargoSubscribers;
    }
    if (doc.orderType === "MachineOrder") {
      text = formatMachineText(doc, nickname);
      kb = buildKeyboard(
        doc._id,
        "Посмотреть маршрут",
        "Связаться с перевозчиком"
      );
      subs = vehicleSubscribers;
    }

    for (const id of subs) {
      await bot.telegram.sendMessage(id, text, {
        reply_markup: kb,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      });
    }
  });
});

export const startBot = async () => {
  await bot.launch();
  console.log("✅ Бот запущен");
};
