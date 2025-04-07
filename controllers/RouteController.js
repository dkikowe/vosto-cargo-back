// CalculatorController.js
import fetch from "node-fetch";

// Рекомендуется хранить ключ в .env (через dotenv) или другом безопасном месте
const GOOGLE_API_KEY = "AIzaSyDJHu7ZujgYjhEUD6dZQCPnyZlINNSFh9c";

// CalculatorController.js
export async function getDistance(req, res) {
  try {
    const { cityA, cityB } = req.query;
    if (!cityA || !cityB) {
      return res
        .status(400)
        .json({ error: "Необходимы оба города (cityA и cityB)." });
    }

    // Формируем ссылку для отображения маршрута в Google Maps
    const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      cityA
    )}&destination=${encodeURIComponent(cityB)}`;

    return res.json({ routeUrl });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Ошибка при формировании ссылки на маршрут" });
  }
}
