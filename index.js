import express from "express";
import mongoose from "mongoose";
import chalk from "chalk";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";

dotenv.config();

import * as UserController from "./controllers/UserController.js";
import * as OrderController from "./controllers/OrderController.js"; // Импорт контроллера заказов
import ParseController from "./controllers/ParseController.js";
import { startTelegramListener } from "./controllers/TelegaParser.mjs";
import { getDistance } from "./controllers/RouteController.js";
import { getShippingCalculation } from "./controllers/DeepSeek.js";
import { sendSupportMessage } from "./controllers/Support.js";
import { saveLocation } from "./controllers/UserController.js";

import ratingRouter from "./controllers/RatingController.js";
import { startBot } from "./controllers/BotTelega.js";

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
    origin: "*", // Укажите домен вашего фронтенда
    methods: ["GET", "PATCH", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.options("*", cors());

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

// Маршрут для сохранения темы
app.post("/saveTheme", UserController.saveTheme);
app.post("/saveLang", UserController.saveLanguage);

app.get("/api/distance", getDistance);

app.use("/api/rating", ratingRouter);

// ---------- Маршруты для заказов ----------
app.post("/orders", OrderController.createOrder);
app.get("/orders", OrderController.getOrders);
app.get("/allOrders", OrderController.getAllOrders);
app.put("/orders/:id", OrderController.updateOrder);
// Пусть будет DELETE /orders
app.delete("/orders", OrderController.deleteOrder);

// Новые маршруты для архивирования/восстановления заказов
app.post("/orders/archive", OrderController.archiveOrder);
app.post("/orders/restore", OrderController.restoreOrder);

// ---------- Маршруты для парсинга ----------
app.get("/parse-cargo", ParseController.parseAvtodispetcher);
app.get("/parse-vehicles", ParseController.parseVehiclesFromAvtodispetcher);

app.post("/support", sendSupportMessage);

const port = process.env.PORT || 5050;

app.listen(port, async () => {
  console.log(successMsg("listening port:", port));

  // Стартуем Telegram-бота
  try {
    await startBot();
    console.log(successMsg("Telegram-бот успешно запущен"));
  } catch (err) {
    console.error(errorMsg("Ошибка при запуске Telegram-бота:"), err);
  }
});
