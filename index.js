import express from "express";
import mongoose from "mongoose";
import chalk from "chalk";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
import crypto from "crypto";

dotenv.config();

import * as UserController from "./controllers/UserController.js";
import * as OrderController from "./controllers/OrderController.js"; // Импорт контроллера заказов (оставляем как есть для остального функционала)
import ParseController from "./controllers/ParseController.js";
import { startTelegramListener } from "./controllers/TelegaParser.mjs";
import { getDistance } from "./controllers/RouteController.js";
import { getShippingCalculation } from "./controllers/DeepSeek.js";
import { sendSupportMessage } from "./controllers/Support.js";
import { saveLocation } from "./controllers/UserController.js";
import ratingRouter from "./controllers/RatingController.js";
import { startBot } from "./controllers/BotTelega.js";

// ⚠️ Robokassa больше не зависит от Order
// import { Order } from "./models/Order.js";

// ✅ Понадобится модель пользователя для включения премиума
import User from "./models/User.js";

import "./jobs.js";

const errorMsg = chalk.bgWhite.redBright;
const successMsg = chalk.bgGreen.white;

mongoose
  .connect(process.env.MONGO_SRV)
  .then(() => console.log(successMsg("DB ok")))
  .catch((err) => console.log(errorMsg("DB error:", err)));

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "PATCH", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.options("*", cors());

// Robokassa callback присылает application/x-www-form-urlencoded,
// поэтому подключаем urlencoded ПЕРЕД json.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ---------- Маршруты для пользователей ----------
app.post("/register", UserController.register);
app.post("/login", UserController.login);
app.post("/subscribe", UserController.getSubscribe);
app.post("/getTelegramId", UserController.getTelegramId);
app.post("/save-location", UserController.saveLocation);

app.get("/getUserById/:id", UserController.getUser);
app.post(
  "/uploadPhoto/:id",
  upload.single("photo"),
  UserController.uploadPhoto
);
app.post(
  "/uploadCompanyPhoto/:id",
  upload.single("photo"),
  UserController.uploadCompanyPhoto
);
app.post("/setRole", UserController.setRole);
app.post("/saveName", UserController.changeUserName);
app.get("/getUsers", UserController.getUsers);

app.get("/getShippingCalculation", getShippingCalculation);

// Маршруты для обновления информации о компании
app.post("/updateCompany", UserController.updateCompany);
app.get("/getCompany/:id", UserController.getCompany);

// Маршрут для сохранения темы/языка
app.post("/saveTheme", UserController.saveTheme);
app.post("/saveLang", UserController.saveLanguage);

app.get("/api/distance", getDistance);

app.use("/api/rating", ratingRouter);

// ---------- Маршруты для заказов ----------
app.post("/orders", OrderController.createOrder);
app.get("/orders", OrderController.getOrders);
app.get("/allOrders", OrderController.getAllOrders);
app.put("/orders/:id", OrderController.updateOrder);
app.delete("/orders", OrderController.deleteOrder);
app.post("/orders/archive", OrderController.archiveOrder);
app.post("/orders/restore", OrderController.restoreOrder);

// ---------- Маршруты для парсинга ----------
app.get("/parse-cargo", ParseController.parseAvtodispetcher);
app.get("/parse-vehicles", ParseController.parseVehiclesFromAvtodispetcher);

app.post("/support", sendSupportMessage);

// ======================= ROBOKASSA (упрощённо, без Order) =======================
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

/**
 * Генерация ссылки на оплату Premium
 * POST /api/payments/robokassa/create
 * body: { userId: string, amount: number|string }
 */
app.post("/api/payments/robokassa/create", async (req, res) => {
  try {
    const { userId, amount } = req.body || {};
    if (!userId || amount === undefined || amount === null) {
      return res.status(400).json({ error: "userId and amount required" });
    }

    // опционально: проверить, что пользователь существует
    const user = await User.findById(userId).select("_id");
    if (!user) return res.status(404).json({ error: "user not found" });

    const { ROBO_LOGIN, ROBO_PASS1, ROBO_IS_TEST } = process.env;

    // Уникальный идентификатор транзакции (не Order)
    const InvId = Date.now();
    const OutSum = Number(amount).toFixed(2);

    // Передаём userId через Shp_*, чтобы получить его в колбэке
    const shp = { Shp_user: String(userId) };
    const shpSorted = Object.entries(shp).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const shpQuery = shpSorted.map(([k, v]) => `${k}=${v}`).join(":");

    // Подпись инициации: MerchantLogin:OutSum:InvId:Password1[:Shp_...]
    const signBase =
      `${ROBO_LOGIN}:${OutSum}:${InvId}:${ROBO_PASS1}` +
      (shpQuery ? `:${shpQuery}` : "");
    const SignatureValue = md5(signBase);

    const params = new URLSearchParams({
      MerchantLogin: ROBO_LOGIN,
      OutSum,
      InvId: String(InvId),
      SignatureValue,
      Description: `Оплата Premium`,
      Encoding: "utf-8",
    });
    if (ROBO_IS_TEST === "1") params.set("IsTest", "1");
    for (const [k, v] of shpSorted) params.set(k, v);

    const payUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;
    return res.json({ payUrl });
  } catch (e) {
    console.error("create robokassa payment error:", e);
    return res.status(500).json({ error: "internal error" });
  }
});

/**
 * Серверный колбэк (Result URL)
 * POST /api/payments/robokassa/callback
 * content-type: application/x-www-form-urlencoded
 * На успех — строго: OK<InvId>
 */
app.post("/api/payments/robokassa/callback", async (req, res) => {
  try {
    const { OutSum, InvId, SignatureValue, Shp_user, ...rest } = req.body || {};
    if (!OutSum || !InvId || !SignatureValue) {
      return res.status(400).send("bad request");
    }

    // Собираем все Shp_* для подписи, сортируем по имени
    const shpEntries = Object.entries({ Shp_user, ...rest })
      .filter(([k, v]) => k && k.startsWith("Shp_") && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`);
    const shpQuery = shpEntries.join(":");

    // Проверка подписи вебхука: OutSum:InvId:Password2[:Shp_...]
    const base =
      `${OutSum}:${InvId}:${process.env.ROBO_PASS2}` +
      (shpQuery ? `:${shpQuery}` : "");
    const mySign = md5(base);
    if (mySign.toLowerCase() !== String(SignatureValue).toLowerCase()) {
      return res.status(400).send("bad sign");
    }

    // Включаем премиум пользователю
    if (Shp_user) {
      const user = await User.findById(Shp_user);
      if (user && user.isPremium !== true) {
        user.isPremium = true;
        await user.save();
      }
    }

    // Вернуть строго OK<InvId>
    return res.send("OK" + InvId);
  } catch (e) {
    console.error("robokassa callback error:", e);
    return res.status(500).send("error");
  }
});
// ===================== /ROBOKASSA =======================

const port = process.env.PORT || 5050;

app.listen(port, async () => {
  console.log(successMsg("listening port:", port));

  // Стартуем Telegram-бота (бот с Bot API токеном)
  try {
    await startBot();
    console.log(successMsg("Telegram-бот успешно запущен"));
  } catch (err) {
    console.error(errorMsg("Ошибка при запуске Telegram-бота:"), err);
  }

  // Стартуем Telegram MTProto парсер (под своим аккаунтом)
  try {
    await startTelegramListener();
    console.log(successMsg("Telegram-парсер успешно запущен"));
  } catch (err) {
    console.error(errorMsg("Ошибка при запуске Telegram-парсера:"), err);
  }
});
