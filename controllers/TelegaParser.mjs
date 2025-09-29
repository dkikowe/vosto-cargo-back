// filename: telega-listener.mjs
import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import fs from "fs";
import { TelegramClient, Api } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import { StringSession } from "telegram/sessions/index.js";
import qrcode from "qrcode-terminal";
import input from "input"; // <-- для запроса 2FA-пароля из терминала
import { CargoOrder, MachineOrder } from "../models/Order.js";

// ---------- Конфиг (без дефолтов, только из .env) ----------
const TG_API_ID = 27860754;
const TG_API_HASH = "3b43e22022d815ba5e771d2d86526aa0";
const DEEPSEEK_API_KEY = String(process.env.DEEPSEEK_API_KEY);

if (!TG_API_ID || !TG_API_HASH) {
  throw new Error("TG_API_ID / TG_API_HASH не заданы в .env");
}
if (!DEEPSEEK_API_KEY) {
  console.warn(
    "Внимание: DEEPSEEK_API_KEY не задан. Функции LLM могут не работать."
  );
}

const sessionFile = "session.txt";
let sessionString = fs.existsSync(sessionFile)
  ? fs.readFileSync(sessionFile, "utf-8")
  : "";
const stringSession = new StringSession(sessionString);

// ---------- Целевые чаты ----------
const targetChats = [
  "rusyugtrans",
  "vezy_tovar",
  "perevozki_negabarita",
  "chat_gruzoperevozki",
  "logistics_avto",
  "internationalcargotransport",
  "kavkaz_gruzi",
  "euro_loads",
  "gruzoperevozkivrussia",
  "liderlagist",
  "gruzallrussia",
  "zagruzki_moskva",
  "tug34",
  "logistics_chat",
  "TvoiGruz",
  "gruzoperevozochki",
  "Logistika_all",
  "TutGruz",
  "logisticscargo",
  "isuzigrupa",
  "dalnoboichat",
  "perevozka_uzb_rf1",
  "avtoperevozki",
  "fayz_logistic",
  "group120paravoz",
  "cargo_BY",
  "gruzoperevozki_rossiya",
  "gruzoperevozki_rossii",
  "mirovoy_gruz01",
  "yuk_gruppa",
  "Trans_ru",
  "gryzovik",
  "perevoskamirn1",
  "poputno_gruz",
  "yuk_xizmati1",
  "Russian_logistics",
  "TIRtrans",
];

const processedOrders = new Set();

// ---------- DeepSeek ----------
async function askDeepSeek(prompt) {
  try {
    const resp = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      { model: "deepseek-chat", messages: [{ role: "user", content: prompt }] },
      {
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );
    const content = resp?.data?.choices?.[0]?.message?.content ?? "";
    console.log("Ответ DeepSeek:", content);
    return content;
  } catch (e) {
    console.error("Ошибка DeepSeek:", e?.message || e);
    return null;
  }
}

const basePrompt = `Ты — backend-ассистент. Я буду присылать тебе текстовые сообщения с объявлениями, полученные за последнюю неделю.
Обрати внимание: в одном сообщении может быть две или более заявок, для каждой из них необходимо вернуть отдельный JSON объект.
Твоя задача:
1. Определи, относится ли каждая заявка к категории "CargoOrder" (груз) или "MachineOrder" (машина).
2. Выдели все возможные поля из текста и заполни их в формате JSON согласно следующим схемам. Если поле невозможно определить, верни его как "".
3. Если в сообщении указана дата для поля ready (или data_gotovnosti), используй её, убери год и отформатируй как "DD.MM". Если даты нет — используй сегодняшнюю дату (именно день.месяц).
4. Телефон записывай в поле telefon.
5. Фильтруй спам/рекламу/вакансии.
6. Переводи заявки на русский (особенно города).

Схема для CargoOrder:
{
  orderType: "CargoOrder",
  description: "...",
  from: "...",
  to: "...",
  cargo: "...",
  weight: "...",
  volume: "...",
  rate: "...",
  ready: "...",
  vehicle: "...",
  telefon: "...",
  paymentMethod: "Кэш" | "Карта"
}

Схема для MachineOrder:
{
  orderType: "MachineOrder",
  description: "...",
  url: "...",
  marka: "...",
  tip: "...",
  kuzov: "...",
  tip_zagruzki: "...",
  gruzopodyomnost: "...",
  vmestimost: "...",
  data_gotovnosti: "...",
  otkuda: "...",
  kuda: "...",
  telefon: "...",
  imya: "...",
  firma: "...",
  gorod: "...",
  pochta: "...",
  company: "...",
  paymentMethod: "Кэш" | "Карта"
}

Исправляй ошибки в тексте. Верни только валидный JSON без пояснений.`;

// ---------- вспомогательная: получение 2FA пароля ----------
async function getTwoFaPassword(hint) {
  const envPwd = process.env.TG_2FA_PASSWORD;
  if (envPwd && envPwd.trim().length > 0) return envPwd.trim();
  // Тихо спросим в терминале (звёздочки)
  const pwd = await input.password(
    `Введите пароль 2FA${hint ? ` (hint: ${hint})` : ""}: `
  );
  if (!pwd || pwd.trim().length === 0) {
    throw new Error("2FA пароль не введён");
  }
  return pwd.trim();
}

// ---------- Логин по QR (без СМС/кодов) ----------
async function ensureLoginViaQR(client) {
  await client.connect();

  // если сессия валидна — выходим
  try {
    await client.getMe();
    console.log("Сессия уже активна.");
    return;
  } catch {
    // пойдём по QR
  }

  console.log(
    "Старт QR-логина. Откройте Telegram на телефоне и отсканируйте QR."
  );

  const user = await client.signInUserWithQrCode(
    { apiId: TG_API_ID, apiHash: TG_API_HASH },
    {
      qrCode: async ({ token, expires }) => {
        // Telegram-клиент примет этот токен по схеме tg://login
        const uri = `tg://login?token=${token.toString("base64url")}`;
        qrcode.generate(uri, { small: true });
        console.log(
          "Если QR не виден в терминале, откройте ссылку (на устройстве с Telegram):",
          uri
        );
        const ttl = Math.max(
          0,
          Math.round((expires * 1000 - Date.now()) / 1000)
        );
        console.log(`QR действителен ~${ttl} сек.`);
      },
      // если включена 2FA — GramJS вызовет этот колбэк
      password: async (hint) => {
        return await getTwoFaPassword(hint);
      },
      onError: async (err) => {
        // Не прерываем процесс сразу, позволяем библиотеке повторить попытку
        console.error("Ошибка при QR-логине:", err?.message || err);
        return false; // <= важно: не обрываем
      },
    }
  );

  console.log(
    "QR-логин выполнен для пользователя:",
    user?.username || user?.firstName || "OK"
  );

  // сохранить сессию
  fs.writeFileSync(sessionFile, client.session.save(), "utf-8");
  console.log("Сессия сохранена в файле", sessionFile);
}

// ---------- Утилиты парсинга JSON из LLM ----------
function cleanJsonBlock(block) {
  if (!block) return "";
  let b = block.trim();
  if (b.startsWith("```json")) b = b.slice(7);
  if (b.endsWith("```")) b = b.slice(0, -3);
  return b.trim();
}

async function parseDeepSeekPayload(resp) {
  const out = [];
  if (!resp) return out;

  try {
    const asJson = JSON.parse(cleanJsonBlock(resp));
    if (Array.isArray(asJson)) return asJson;
    if (asJson && typeof asJson === "object") return [asJson];
  } catch (_) {}

  if (resp.includes("```json")) {
    const blocks = resp
      .split(/```json/)
      .map((b) => cleanJsonBlock(b))
      .filter(Boolean);
    for (const b of blocks) {
      try {
        const obj = JSON.parse(b);
        if (Array.isArray(obj)) out.push(...obj);
        else out.push(obj);
      } catch (e) {
        console.error("Ошибка парсинга блока:", e?.message || e);
      }
    }
    return out;
  }

  for (const line of resp.split("\n")) {
    const l = cleanJsonBlock(line);
    if (!l) continue;
    try {
      const obj = JSON.parse(l);
      if (Array.isArray(obj)) out.push(...obj);
      else out.push(obj);
    } catch {}
  }
  return out;
}

// ---------- Основной раннер ----------
export async function startTelegramListener() {
  console.log("Запуск Telegram MTProto клиента...");
  const client = new TelegramClient(stringSession, TG_API_ID, TG_API_HASH, {
    connectionRetries: 5,
    requestRetries: 5,
    retryDelay: 500,
    autoReconnect: true,
    // При проблемах с сетью можно задействовать WebSocket в вашей версии GramJS:
    // useWSS: true,
  });

  // Логин только через QR
  await ensureLoginViaQR(client);

  // Join каналов
  for (const chat of targetChats) {
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: chat }));
      console.log(`Присоединился к @${chat}`);
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("USER_ALREADY_PARTICIPANT")) {
        console.log(`Уже участник @${chat}`);
      } else if (
        msg.includes("INVITE_HASH") ||
        msg.includes("CHANNEL_PRIVATE")
      ) {
        console.log(`Не удалось присоединиться к @${chat} (приват/инвайт).`);
      } else if (msg.includes("FLOOD_WAIT_")) {
        const sec = parseInt(msg.match(/FLOOD_WAIT_(\d+)/)?.[1] || "60", 10);
        console.warn(`FloodWait: подождите ${sec} сек для @${chat}`);
      } else {
        console.log(`Ошибка join @${chat}:`, msg);
      }
    }
  }

  // Получение сущностей
  const validChats = [];
  for (const chat of targetChats) {
    try {
      const entity = await client.getEntity(chat);
      validChats.push(entity);
      console.log(`Сущность для @${chat} получена.`);
    } catch (e) {
      console.error(
        `Не удалось получить сущность @${chat}: ${e?.message || e}`
      );
    }
  }

  // История за неделю (offsetDate — объект Date)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  for (const chatEntity of validChats) {
    try {
      await client.getMessages(chatEntity, { limit: 100, offsetDate: weekAgo });
      console.log(
        `Загружено сообщений из @${
          chatEntity.username || chatEntity.id
        } за последнюю неделю.`
      );
    } catch (err) {
      console.error(
        `Ошибка получения сообщений для @${
          chatEntity.username || chatEntity.id
        }: ${err?.message || err}`
      );
    }
  }

  console.log("Ожидание новых сообщений в указанных группах...\n");

  // Хэндлер входящих сообщений
  client.addEventHandler(async (event) => {
    const message = event?.message;
    const text = message?.message || "";
    if (!text) return;

    const key = text.trim();
    if (processedOrders.has(key)) return;
    processedOrders.add(key);

    const prompt = `${basePrompt}\nОбъявление: ${text}`;
    const resp = await askDeepSeek(prompt);
    if (!resp) return;

    const items = await parseDeepSeekPayload(resp);
    for (const data of items) {
      try {
        if (!data || typeof data !== "object") continue;

        // Пропускаем без телефона
        if (!data.telefon || String(data.telefon).trim() === "") {
          console.log("Пропущено: отсутствует телефон, заказ не сохранён.");
          continue;
        }

        // Проверка дублей по подходящим полям
        let existing = null;
        if (data.orderType === "CargoOrder") {
          existing = await CargoOrder.findOne({
            description: data.description,
            from: data.from,
            to: data.to,
            ready: data.ready,
            telefon: data.telefon,
          });
        } else if (data.orderType === "MachineOrder") {
          existing = await MachineOrder.findOne({
            description: data.description,
            otkuda: data.otkuda,
            kuda: data.kuda,
            data_gotovnosti: data.data_gotovnosti,
            telefon: data.telefon,
          });
        }

        console.log("Сохранение данных:", data);
        if (existing) {
          console.log("Пропущено: найден дубликат.");
          continue;
        }

        if (data.orderType === "CargoOrder") {
          await CargoOrder.create(data);
        } else if (data.orderType === "MachineOrder") {
          await MachineOrder.create(data);
        } else {
          console.log("Пропущено: неизвестный orderType.");
        }
      } catch (e) {
        console.error("Ошибка сохранения данных:", e?.message || e);
      }
    }
  }, new NewMessage({ chats: validChats.map((c) => c.id) }));
}

startTelegramListener().catch((e) => {
  console.error("Фатальная ошибка:", e?.message || e);
});
