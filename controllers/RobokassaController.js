import crypto from "crypto";
import User from "../models/User.js";

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

// ====== вспомогательное: срок подписки по плану ======
function calcExpiry(plan) {
  const now = new Date();
  const expires = new Date(now.getTime());

  switch (plan) {
    case "single": // 1 неделя
      expires.setDate(expires.getDate() + 7);
      break;
    case "minimal": // 1 месяц
      expires.setMonth(expires.getMonth() + 1);
      break;
    case "standard-3m": // 3 месяца
      expires.setMonth(expires.getMonth() + 3);
      break;
    case "standard-12m": // 12 месяцев
      expires.setMonth(expires.getMonth() + 12);
      break;
    default: // по умолчанию — 1 неделя
      expires.setDate(expires.getDate() + 7);
  }
  return { startedAt: now, expiresAt: expires };
}

// Генерация ссылки на оплату
export async function createRobokassaPayment(req, res) {
  try {
    const { userId, amount, plan } = req.body || {};
    if (!userId || amount == null) {
      return res.status(400).json({ error: "userId and amount required" });
    }

    const { ROBO_LOGIN, ROBO_PASS1, ROBO_IS_TEST } = process.env;
    const InvId = String(Date.now());
    const OutSum = Number(amount).toFixed(2);

    // Доп. параметры (Shp_* возвращаются в колбэк)
    const shp = {
      Shp_user: String(userId),
      ...(plan ? { Shp_plan: String(plan) } : {}),
    };
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
    const { OutSum, InvId, SignatureValue, Shp_user, Shp_plan, ...rest } =
      req.body || {};
    if (!OutSum || !InvId || !SignatureValue)
      return res.status(400).send("bad request");

    // Собираем Shp_* для подписи (обязательно сортировать)
    const shpEntries = Object.entries({ Shp_user, Shp_plan, ...rest })
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

    // Обновляем подписку пользователя
    if (Shp_user) {
      const user = await User.findById(Shp_user);
      if (user) {
        const plan = Shp_plan || "single";
        const { startedAt, expiresAt } = calcExpiry(plan);

        user.subscription = {
          plan,
          startedAt,
          expiresAt,
          status: "active",
        };

        // обратная совместимость
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
