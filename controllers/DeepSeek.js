import axios from "axios";

async function askDeepSeek(prompt) {
  try {
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat", // или другой, если нужно
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer sk-1f84fedf00d746339291a89cda7f9e2a`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(response.data.choices[0].message.content);
  } catch (error) {
    console.error("Ошибка при обращении к DeepSeek API:", error.message);
  }
}

const prompt = `
Ты — backend-ассистент. Я буду присылать тебе текстовые сообщения с объявлением. 
Твоя задача: 
1. Определи, относится ли сообщение к категории "CargoOrder" (груз) или "MachineOrder" (машина).
2. Выдели все возможные поля из текста и заполни их в формате JSON согласно соответствующей схеме.
3. Верни JSON, строго соответствующий одной из следующих схем:

CargoOrder:
{
  orderType: "CargoOrder",
  description: "...",
  from: "...",
  to: "...",
  cargo: "...",
  weight: "...",
  volume: "...",
  rate: "...",
  ready: "...",
  vehicle: "...",
  paymentMethod: "Кэш" | "Карта"
}

MachineOrder:
{
  orderType: "MachineOrder",
  description: "...",
  url: "...",
  marka: "...",
  tip: "...",
  kuzov: "...",
  tip_zagruzki: "...",
  gruzopodyomnost: "...",
  vmestimost: "...",
  data_gotovnosti: "...",
  otkuda: "...",
  kuda: "...",
  telefon: "...",
  imya: "...",
  firma: "...",
  gorod: "...",
  pochta: "...",
  company: "...",
  paymentMethod: "Кэш" | "Карта"
}

Если поле невозможно определить — верни его как "". 
Не добавляй никаких комментариев, пояснений и текста вокруг — только валидный JSON.
`;

askDeepSeek(
  prompt + "\n\nОбъявление: Груз 20т, Москва - Казань, тент, 50000 руб."
);
