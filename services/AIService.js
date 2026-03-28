import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

export const parseOrderRequest = async (userText) => {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY не настроен");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `
    Ты — логистический AI-ассистент. Твоя задача — извлечь данные из текста заявки и вернуть строго валидный JSON.
    
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
        "from": "string (город отправления)",
        "to": "string (город назначения)"
      },
      "recommendedVehicleType": "string (один из: TRUCK_5T, TRUCK_10T, TRUCK_20T, REF, VAN, FLATBED, SPECIAL)",
      "estimatedPrice": {
        "min": number (минимальная рыночная цена в тенге),
        "max": number (максимальная рыночная цена в тенге)
      },
      "confidenceScore": number (от 0 до 1, насколько уверен в разборе)
    }
    
    Если данных нет, пытайся угадать из контекста или ставь дефолтные значения (0 для чисел). Не пиши ничего кроме JSON.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Очистка от markdown
    const jsonString = text.replace(/```json|```/g, "").trim();

    return JSON.parse(jsonString);
  } catch (error) {
    console.error("AI Parsing Error:", error);
    // Возвращаем пустую структуру при ошибке, чтобы фронт не падал
    return {
      cargo: { description: userText, weight: 0, volume: 0 },
      route: { from: "", to: "" },
      estimatedPrice: { min: 0, max: 0 },
      confidenceScore: 0,
    };
  }
};
