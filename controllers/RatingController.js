import express from "express";
import User from "../models/User.js"; // Путь скорректируйте под структуру вашего проекта

const router = express.Router();

/**
 * Связаться с заказчиком
 * Допустим, что при обращении к этому endpoint происходит
 * какая-то логика (например, отправка сообщения) – здесь пока
 * просто возвращаем результат.
 */
router.get("/contact/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Дополнительная проверка, существует ли пользователь
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Пользователь не найден" });
    }

    // Здесь может быть вызов внешнего API, отправка письма и т.д.
    return res.status(200).json({
      message: `Успешно связались с пользователем: ${user.name}`,
    });
  } catch (error) {
    console.error("Ошибка при попытке связаться с пользователем:", error);
    return res.status(500).json({
      message: "Внутренняя ошибка сервера при обращении к пользователю",
    });
  }
});

/**
 * Установить рейтинг пользователю
 */
router.post("/rate/:userId", async (req, res) => {
  try {
    const { rating, reason, fromUserId } = req.body;
    const { userId } = req.params;

    if (typeof rating !== "number" || rating < 0 || rating > 5) {
      return res.status(400).json({ message: "Некорректный рейтинг" });
    }

    if (!fromUserId) {
      return res.status(400).json({ message: "Не указан ID отправителя" });
    }

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Пользователь не найден" });

    // Проверим, ставил ли уже этот пользователь рейтинг
    const alreadyRated = user.ratingHistory.find(
      (r) => r.fromUser?.toString() === fromUserId
    );

    if (alreadyRated) {
      return res
        .status(400)
        .json({ message: "Вы уже ставили рейтинг этому пользователю" });
    }

    // Добавляем новый рейтинг
    user.ratingHistory.push({
      value: rating,
      reason,
      fromUser: fromUserId,
      createdAt: new Date(),
    });

    // Пересчитать средний рейтинг
    const total = user.ratingHistory.reduce((acc, r) => acc + r.value, 0);
    const avg = total / user.ratingHistory.length;
    user.rating = parseFloat(avg.toFixed(2));

    await user.save();

    res.status(200).json({ message: "Рейтинг сохранён", user });
  } catch (error) {
    console.error("Ошибка при сохранении рейтинга:", error);
    res.status(500).json({ message: "Внутренняя ошибка сервера" });
  }
});

export default router;
