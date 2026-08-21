import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const modelNames = (process.env.GEMINI_MODEL || "gemini-2.5-flash,gemini-flash-lite-latest,gemini-flash-latest")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

const extractJson = (text) => {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI вернул ответ без JSON");
  }

  return cleaned.slice(start, end + 1);
};

export const parseOrderRequest = async (userText) => {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY не настроен");
  }
  const prompt = `
    Ты — логистический AI-ассистент. Твоя задача — извлечь данные из текста заявки на грузоперевозку и вернуть строго валидный JSON.
    
    Текст клиента: "${userText}"
    
    Требуемый формат JSON:
    {
      "cargo": {
        "description": "string (краткое описание груза)",
        "weight": number (вес в кг, примерный, если не указано - 0),
        "volume": number (объем в м3, примерный, если не указано - 0),
        "isFragile": boolean,
        "requiresLoader": boolean,
        "requiresTempControl": boolean
      },
      "route": {
        "from": { "city": "string", "address": "string" },
        "to": { "city": "string", "address": "string" }
      },
      "pricing": {
        "customerOffer": number,
        "currency": "KZT"
      },
      "recommendedVehicleType": "string (один из: TRUCK_5T, TRUCK_10T, TRUCK_20T, REF, VAN, FLATBED, SPECIAL)",
      "estimatedPrice": {
        "min": number (минимальная рыночная цена в тенге),
        "max": number (максимальная рыночная цена в тенге),
        "currency": "KZT"
      },
      "confidenceScore": number (от 0 до 1, насколько уверен в разборе)
    }
    
    Правила:
    - Вес всегда возвращай в килограммах. Например: "5 тонн" = 5000, "800 кг" = 800.
    - Объем всегда возвращай в м3.
    - Если клиент указал бюджет, цену, ставку или "готов заплатить", положи эту сумму точно в pricing.customerOffer.
    - Если клиент не указал цену, pricing.customerOffer = 0.
    - estimatedPrice — это только рыночная рекомендация. Не используй ее вместо явно указанного бюджета клиента.
    - Не выдумывай адреса и города. Если данных нет, ставь пустую строку для текста и 0 для чисел.
    - Не пиши ничего кроме JSON.
  `;

  let lastError;

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonString = extractJson(text);

      return JSON.parse(jsonString);
    } catch (error) {
      lastError = error;
      console.error(`AI Parsing Error (${modelName}):`, error);
    }
  }

  throw new Error(lastError?.message || "Не удалось распознать заявку через AI");
};
