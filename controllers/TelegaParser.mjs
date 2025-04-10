import axios from "axios";
import fs from "fs";
import { TelegramClient, Api } from "telegram";
import { NewMessage } from "telegram/events/index.js";
import { StringSession } from "telegram/sessions/index.js";
import input from "input";
import { CargoOrder, MachineOrder } from "../models/Order.js";

const sessionFile = "session.txt";
let sessionString = "";
if (fs.existsSync(sessionFile)) {
  sessionString = fs.readFileSync(sessionFile, "utf-8");
}
const stringSession = new StringSession(sessionString);

const apiId = 28140920;
const apiHash = "52703e9e4b99b8fc996072b6876b744c";
const targetChats = [
  "rusyugtrans",
  "vezy_tovar",
  "perevozki_negabarita",
  "chat_gruzoperevozki",
  "logistics_avto",
  "internationalcargotransport",
  "kavkaz_gruzi",
  "euro_loads",
  "gruzoperevozki_vrussia",
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

async function askDeepSeek(prompt) {
  try {
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: "Bearer sk-1f84fedf00d746339291a89cda7f9e2a",
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Ответ DeepSeek:", response.data.choices[0].message.content);
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Ошибка при обращении к DeepSeek API:", error.message);
    return null;
  }
}

const basePrompt = `Ты — backend-ассистент. Я буду присылать тебе текстовые сообщения с объявлениями, полученные за последнюю неделю.
Обрати внимание: в одном сообщении может быть две или более заявок, для каждой из них необходимо вернуть отдельный JSON объект.
Твоя задача:
1. Определи, относится ли каждая заявка к категории "CargoOrder" (груз) или "MachineOrder" (машина).
2. Выдели все возможные поля из текста и заполни их в формате JSON согласно следующим схемам. Если поле невозможно определить, верни его как "".
3. Если в сообщении указана дата для поля ready (или data_gotovnosti), используй её, убери год и отформатируй как "DD.MM" (например, "02.04"). Если дата не указана, используй сегодняшную дату, обязательно используй именно день месяц.
4. В сообщениях может быть указан телефон, который необходимо записывать в поле telefon.
5. В сообщениях могут быть спам, реклама, сообщения по найму на работу и т.д , тебе нужно будет их фильтровать
6. В сообщениях могут быть заявки на разных языках (например узбекский) , тебе надо перевести все на русский , особенно города

Схема для CargoOrder:
{
  orderType: "CargoOrder", // Тип заказа, всегда "CargoOrder"
  description: "...",      // Краткий текст объявления, без лишней информации и эмодзи
  from: "...",             // Место отправления (откуда груз)
  to: "...",               // Место назначения (куда груз)
  cargo: "...",            // Описание груза
  weight: "...",           // Вес груза (если указан)
  volume: "...",           // Объём груза (если указан)
  rate: "...",             // Ставка или стоимость перевозки (если указана)
  ready: "...",            // Дата готовности груза (формат DD.MM: если указана – используй её без года, иначе используй сегодняшную дату)
  vehicle: "...",          // Тип требуемого транспортного средства (если указан)
  telefon: "...",          // Контактный телефон (если указан)
  paymentMethod: "Кэш" | "Карта" // Способ оплаты: "Кэш" или "Карта"
}

Схема для MachineOrder:
{
  orderType: "MachineOrder", // Тип заказа, всегда "MachineOrder"
  description: "...",        // Краткий текст объявления, без лишней информации и эмодзи
  url: "...",                // Ссылка на источник или дополнительную информацию (если есть)
  marka: "...",              // Марка машины
  tip: "...",                // Тип машины
  kuzov: "...",              // Тип кузова
  tip_zagruzki: "...",       // Тип загрузки (например, боковая, задняя и т.п.)
  gruzopodyomnost: "...",    // Грузоподъемность машины
  vmestimost: "...",         // Объём грузового отсека (если указан)
  data_gotovnosti: "...",    // Дата готовности машины (формат DD.MM без года: если указана – используй её без года, иначе оставь пустым)
  otkuda: "...",             // Место отправления или местоположение заказа
  kuda: "...",               // Место назначения (куда машина или груз)
  telefon: "...",            // Контактный телефон
  imya: "...",               // Имя контактного лица
  firma: "...",              // Название компании (если указано)
  gorod: "...",              // Город (если указан)
  pochta: "...",             // Электронная почта (если указана)
  company: "...",            // Альтернативное название компании (если указано)
  paymentMethod: "Кэш" | "Карта" // Способ оплаты: "Кэш" или "Карта"
}

Обязательно исправляй ошибки в тексте, если они есть.
Не добавляй никаких комментариев, пояснений и текста вокруг — только валидный JSON.;`;

export async function startTelegramListener() {
  console.log("Запуск Telegram MTProto клиента...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () =>
      await input.text(
        "Введите ваш номер телефона (в международном формате): "
      ),
    password: async () =>
      await input.text(
        "Введите ваш пароль Telegram (2FA), или нажмите Enter, если отсутствует: "
      ),
    phoneCode: async () =>
      await input.text("Введите код, который вы получили: "),
    onError: (err) => console.error("Ошибка аутентификации:", err),
  });
  console.log("Успешная авторизация. Клиент подключён.");
  fs.writeFileSync(sessionFile, client.session.save(), "utf-8");
  console.log("Сессия сохранена в файле session.txt");
  await client.getMe();

  // Присоединение к целевым чатам
  for (const chat of targetChats) {
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: chat }));
      console.log(`Присоединился к каналу/группе @${chat}`);
    } catch (err) {
      if (String(err).includes("USER_ALREADY_PARTICIPANT")) {
        console.log(`Уже участник @${chat}`);
      } else if (
        String(err).includes("INVITE_HASH") ||
        String(err).includes("CHANNEL_PRIVATE")
      ) {
        console.log(
          `Не удалось присоединиться к @${chat} (требуется приглашение или группа закрыта)`
        );
      } else {
        console.log(`Ошибка при присоединении к @${chat}:`, err.message || err);
      }
    }
  }

  // Формирование списка валидных чатов
  const validChats = [];
  for (const chat of targetChats) {
    try {
      const entity = await client.getEntity(chat);
      validChats.push(entity);
      console.log(`Сущность для @${chat} получена.`);
    } catch (e) {
      console.error(`Не удалось получить сущность для @${chat}: ${e.message}`);
    }
  }

  // Загрузка сообщений за последнюю неделю
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const offsetDate = Math.floor(weekAgo.getTime() / 1000);
  for (const chatEntity of validChats) {
    try {
      const messages = await client.getMessages(chatEntity, {
        limit: 100,
        offsetDate: offsetDate,
      });
      console.log(
        `Загружено сообщений из @${
          chatEntity.username || chatEntity.id
        } за последнюю неделю.`
      );
    } catch (err) {
      console.error(
        `Ошибка получения сообщений для @${
          chatEntity.username || chatEntity.id
        }: ${err.message}`
      );
    }
  }

  console.log("Ожидание новых сообщений в указанных группах...\n");

  // Функция для очистки и парсинга нескольких JSON-блоков из ответа
  function cleanJsonBlock(block) {
    // Удаляем маркеры в начале и конце, если они есть
    if (block.startsWith("```json")) {
      block = block.substring(7);
    }
    if (block.endsWith("```")) {
      block = block.substring(0, block.length - 3);
    }
    return block.trim();
  }

  async function processDeepSeekResponse(responseJson) {
    let results = [];
    if (responseJson.includes("```json")) {
      // Разбиваем по маркеру
      const blocks = responseJson.split(/```json/);
      for (let block of blocks) {
        block = cleanJsonBlock(block);
        if (!block) continue;
        try {
          results.push(JSON.parse(block));
        } catch (err) {
          console.error("Ошибка парсинга блока:", err.message);
        }
      }
    } else {
      // Если маркеры не найдены, пробуем просто очистить строку
      const block = cleanJsonBlock(responseJson);
      try {
        results.push(JSON.parse(block));
      } catch (err) {
        console.error("Ошибка парсинга ответа:", err.message);
      }
    }
    return results;
  }

  // Обработчик входящих сообщений – отправляем текст объявления в DeepSeek и сохраняем результат в базу
  client.addEventHandler(async (event) => {
    const message = event.message;
    const text = message.message || "";
    if (processedOrders.has(text.trim())) return;
    processedOrders.add(text.trim());
    const fullPrompt = basePrompt + "\nОбъявление: " + text;
    const responseJson = await askDeepSeek(fullPrompt);
    if (responseJson) {
      let blocks = [];
      if (responseJson.includes("```json")) {
        blocks = responseJson
          .split(/```json/)
          .map((block) => block.replace(/```/g, "").trim())
          .filter((block) => block);
      } else {
        blocks = [responseJson.trim()];
      }
      for (let block of blocks) {
        try {
          const dataTelega = JSON.parse(block);
          const existing = await CargoOrder.findOne({
            description: dataTelega.description,
            from: dataTelega.from,
            to: dataTelega.to,
            ready: dataTelega.ready,
          });
          console.log("Сохранение данных:", dataTelega);
          if (!dataTelega.telefon || dataTelega.telefon.trim() === "") {
            console.log("Пропущено: отсутствует телефон, заказ не сохранён.");
            continue;
          }
          if (dataTelega.orderType === "CargoOrder" && !existing) {
            await CargoOrder.create(dataTelega);
          } else if (dataTelega.orderType === "MachineOrder" && !existing) {
            await MachineOrder.create(dataTelega);
          }
        } catch (err) {
          console.error("Ошибка сохранения данных в базу:", err.message);
        }
      }
    }
  }, new NewMessage({ chats: validChats.map((chat) => chat.id) }));
}
