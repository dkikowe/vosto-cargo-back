// CalculatorController.js
import fetch from "node-fetch";

// Рекомендуется хранить ключ в .env (через dotenv) или другом безопасном месте
const GOOGLE_API_KEY = "AIzaSyDJHu7ZujgYjhEUD6dZQCPnyZlINNSFh9c";

export async function getDistance(req, res) {
  try {
    const { cityA, cityB } = req.query;
    if (!cityA || !cityB) {
      return res
        .status(400)
        .json({ error: "Необходимы оба города (cityA и cityB)." });
    }

    // Формируем URL для запроса к Google Distance Matrix
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      cityA
    )}&destinations=${encodeURIComponent(cityB)}&key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Ошибка от Google API" });
    }

    const data = await response.json();
    // Можно добавить дополнительную обработку (например, кэширование, логирование, преобразование формата)

    return res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка при запросе к Google API" });
  }
}
