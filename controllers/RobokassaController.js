import crypto from "crypto";
import User from "../models/User.js";

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

// Генерация ссылки на оплату
export async function createRobokassaPayment(req, res) {
  try {
    const { userId, amount } = req.body || {};
    if (!userId || !amount)
      return res.status(400).json({ error: "userId and amount required" });

    const { ROBO_LOGIN, ROBO_PASS1, ROBO_IS_TEST } = process.env;
    const InvId = Date.now(); // уникальный id транзакции (можно хранить в отдельной коллекции)
    const OutSum = Number(amount).toFixed(2);

    // Доп. параметры
    const shp = { Shp_user: String(userId) };
    const shpSorted = Object.entries(shp).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const shpQuery = shpSorted.map(([k, v]) => `${k}=${v}`).join(":");

    // Подпись
    const signBase =
      `${ROBO_LOGIN}:${OutSum}:${InvId}:${ROBO_PASS1}` +
      (shpQuery ? `:${shpQuery}` : "");
    const SignatureValue = md5(signBase);

    const params = new URLSearchParams({
      MerchantLogin: ROBO_LOGIN,
      OutSum,
      InvId,
      SignatureValue,
      Description: `Оплата Premium для пользователя ${userId}`,
      Encoding: "utf-8",
    });

    if (ROBO_IS_TEST === "1") params.set("IsTest", "1");
    for (const [k, v] of shpSorted) params.set(k, v);

    const payUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?${params.toString()}`;
    return res.json({ payUrl });
  } catch (e) {
    console.error("createRobokassaPayment:", e);
    return res.status(500).json({ error: "internal error" });
  }
}

// Колбэк (Result URL)
export async function robokassaCallback(req, res) {
  try {
    const { OutSum, InvId, SignatureValue, Shp_user, ...rest } = req.body || {};
    if (!OutSum || !InvId || !SignatureValue)
      return res.status(400).send("bad request");

    // Собираем Shp_* для подписи
    const shpEntries = Object.entries({ Shp_user, ...rest })
      .filter(([k, v]) => k.startsWith("Shp_") && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`);
    const shpQuery = shpEntries.join(":");

    // Проверка подписи (Password #2)
    const base =
      `${OutSum}:${InvId}:${process.env.ROBO_PASS2}` +
      (shpQuery ? `:${shpQuery}` : "");
    const mySign = md5(base);
    if (mySign.toLowerCase() !== String(SignatureValue).toLowerCase()) {
      return res.status(400).send("bad sign");
    }

    // 👉 Обновляем юзера
    if (Shp_user) {
      const user = await User.findById(Shp_user);
      if (user) {
        user.isPremium = true;
        await user.save();
      }
    }

    return res.send("OK" + InvId);
  } catch (e) {
    console.error("robokassaCallback:", e);
    return res.status(500).send("error");
  }
}
