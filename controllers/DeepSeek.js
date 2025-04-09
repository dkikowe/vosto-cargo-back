import axios from "axios";

// Рекомендуется хранить ключ в .env
const GOOGLE_API_KEY = "AIzaSyDJHu7ZujgYjhEUD6dZQCPnyZlINNSFh9c";

async function fetchDistance(cityA, cityB) {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
    cityA
  )}&destinations=${encodeURIComponent(
    cityB
  )}&key=${GOOGLE_API_KEY}&units=metric`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (
      data.status === "OK" &&
      data.rows.length &&
      data.rows[0].elements.length &&
      data.rows[0].elements[0].status === "OK"
    ) {
      const distanceKm = data.rows[0].elements[0].distance.value / 1000;
      return distanceKm;
    }

    return 0;
  } catch (error) {
    console.error("Ошибка получения расстояния:", error.message);
    return 0;
  }
}

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
          Authorization: `Bearer sk-1f84fedf00d746339291a89cda7f9e2a`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Ошибка при обращении к DeepSeek API:", error.message);
    return null;
  }
}

export async function getShippingCalculation(req, res) {
  try {
    const { cityA, cityB, carType, volume, weight, cargoType } = req.query;

    if (!cityA || !cityB || !carType) {
      return res
        .status(400)
        .json({ error: "Необходимы параметры: cityA, cityB и carType." });
    }

    const distance = await fetchDistance(cityA, cityB);
    console.log(distance);

    const prompt = `
    Ты — backend-ассистент для калькулятора доставки груза.
    Входные данные: город отправления (cityA), город назначения (cityB), тип машины (carType) и расстояние (в км). Используй следующие тарифы для расчёта стоимости доставки за км.
    
    Тарифы для тентованных машин:
    - Москва -> Россия: 90р за км
    - Россия -> Москва: 60р за км
    - Россия -> Другая страна: 150р за км
    - Санкт-Петербург -> Россия: 80р за км
    - Россия -> Санкт-Петербург: 60р за км
    - Россия (кроме МСК и СПБ) -> Россия (кроме МСК и СПБ): 60р за км
    
    Тарифы для рефрижераторных машин:
    - Москва -> Россия: 110р за км
    - Россия -> Москва: 80р за км
    - Россия -> Другая страна: 170р за км
    - Санкт-Петербург -> Россия: 100р за км
    - Россия -> Санкт-Петербург: 80р за км
    - Россия (кроме МСК и СПБ) -> Россия (кроме МСК и СПБ): 80р за км
    
    Дополнительно:
    Тентованная фура:
    - Другая страна -> Россия: 130р за км
    
    Фура с рефрижератором:
    - Другая страна -> Россия: 150р за км
    
    Если какой-либо параметр невозможно определить на основании входных данных, возвращай его как "".
    Если задано значение расстояния, выполни расчёт итоговой стоимости доставки как произведение расстояния на тариф.
    Формат выходных данных:
    {
      "cityA": "",
      "cityB": "",
      "carType": "",
      "tariff": "",
      "price": "",
      "distance":"${distance}"
    }
    
    Возвращай только валидный JSON без каких-либо комментариев, пояснений и дополнительного текста.
    
    Входные данные:
    cityA: "${cityA}"
    cityB: "${cityB}"
    carType: "${carType}"
    distance: "${distance}"
    `;

    const rawResponse = await askDeepSeek(prompt);
    if (!rawResponse) {
      return res
        .status(500)
        .json({ error: "Не удалось получить ответ от AI." });
    }

    const cleanedResponse = rawResponse
      .replace(/^\s*```(?:json)?/, "")
      .replace(/```$/, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedResponse);
    } catch (err) {
      console.error("Ошибка парсинга JSON:", err);
      return res.status(500).json({ error: "Невалидный JSON от AI." });
    }

    // Обработка сборного груза
    // Обработка сборного груза
    if (cargoType === "groupage") {
      const v = parseFloat(volume);
      const w = parseFloat(weight);

      if (!isNaN(v) && !isNaN(w) && v > 0 && w > 0) {
        const fullVolume = 90;
        const fullWeight = 20000;

        const volumeRatio = v / fullVolume;
        const weightRatio = w / fullWeight;
        const ratio = Math.max(volumeRatio, weightRatio);

        const originalPrice = parseFloat(parsed.price);
        parsed.price = (originalPrice * ratio).toFixed(2);
      } else {
        return res.status(400).json({
          error:
            "Для сборного груза обязательны числовые значения volume и weight > 0",
        });
      }
    }

    return res.json(parsed);
  } catch (err) {
    console.error("Ошибка в getShippingCalculation:", err);
    return res
      .status(500)
      .json({ error: "Ошибка при расчёте стоимости доставки." });
  }
}
