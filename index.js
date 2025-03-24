import express from "express";
import mongoose from "mongoose";
import chalk from "chalk";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";

dotenv.config();

import * as UserController from "./controllers/UserController.js";
import * as OrderController from "./controllers/OrderController.js"; // Импорт контроллера заказов

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
app.get("/getUserById/:id", UserController.getUser);
app.post(
  "/uploadPhoto/:id",
  upload.single("photo"),
  UserController.uploadPhoto
);
app.post("/setRole", UserController.setRole);
app.post("/saveName", UserController.changeUserName);
app.get("/getUsers", UserController.getUsers);

// Маршруты для обновления информации о компании
app.post("/updateCompany", UserController.updateCompany);
app.get("/getCompany/:id", UserController.getCompany);

// Маршрут для сохранения темы
app.post("/saveTheme", UserController.saveTheme);

// ---------- Маршруты для заказов ----------
app.post("/orders", OrderController.createOrder);
app.get("/orders", OrderController.getOrders);
app.put("/orders/:id", OrderController.updateOrder);
// Пусть будет DELETE /orders
app.delete("/orders", OrderController.deleteOrder);

// Новые маршруты для архивирования/восстановления заказов
app.post("/orders/archive", OrderController.archiveOrder);
app.post("/orders/restore", OrderController.restoreOrder);

const port = process.env.PORT || 5050;

app.listen(port, () => {
  console.log(successMsg("listening port:", port));
});
