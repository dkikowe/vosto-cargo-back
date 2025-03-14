import express from "express";
import mongoose from "mongoose";
import chalk from "chalk";

import dotenv from "dotenv";
import multer from "multer";

dotenv.config();
import cors from "cors";

import * as UserController from "./controllers/UserController.js";

const errorMsg = chalk.bgWhite.redBright;
const successMsg = chalk.bgGreen.white;

mongoose
  .connect(process.env.MONGO_SRV)
  // mongoose
  //   .connect(
  //     "mongodb+srv://jogjoyinfo:20060903@cluster0.3s2e0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  //   )

  .then(() => console.log(successMsg("DB ok")))
  .catch((err) => console.log(errorMsg("DB error:", err)));

const app = express();

app.use(
  cors({
    origin: "*", // Укажите домен вашего фронтенда
    methods: ["GET", "PATCH", "POST", "PUT", "DELETE"],
    credentials: true, // Если нужны куки или авторизация
  })
);

app.options("*", cors());

app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Jornals

// app.post('/createJournal', JournalController.createJournal)
// app.get('/getJournal', JournalController.getLatestJournal)
// app.get('/getJournals', JournalController.getJournals)
// app.get('/getJournalById/:id', JournalController.getJournalById)
// app.post('/updateJournal', JournalController.updateJournal)
// app.post('/deleteJournal', JournalController.deleteJournal)
// app.post('/uploadArticlePhoto/:id', upload.single('image'), JournalController.uploadArticlePhoto);

// Users

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
app.post("/saveName", UserController.changeUserName);
app.get("/getUsers", UserController.getUsers);

const port = process.env.PORT || 5050;

app.listen(port, function () {
  console.log(successMsg("listening port:", port));
});
