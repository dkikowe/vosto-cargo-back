import mongoose from "mongoose";

// ------------------ Базовая схема заказа ------------------
const options = { discriminatorKey: "orderType", timestamps: true };

const orderSchema = new mongoose.Schema(
  {
    // Общее описание или комментарий
    description: { type: String, required: false },

    // Пользователь, создавший заказ
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // изменено с true на false
      default: null,
    },

    // Флаг архивированности заказа
    isArchived: { type: Boolean, default: false },

    // Способ оплаты (Кэш или Карта)
    paymentMethod: {
      type: String,
      required: false,
    },
  },
  options
);

orderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export const Order = mongoose.model("Order", orderSchema);

// ------------------ Схема для грузов (CargoOrder) ------------------
const CargoOrderSchema = new mongoose.Schema({
  // Место загрузки
  from: { type: String, required: false },
  // Место выгрузки
  to: { type: String, required: false },
  // Наименование или описание груза
  cargo: { type: String, required: false },
  // Вес груза (например, "10 т")
  weight: { type: String, required: false },
  // Объём груза (например, "20 м³")
  volume: { type: String, required: false },
  // Ставка (например, "40 000 руб., 70 руб./км")
  rate: { type: String, required: false },
  // Дата готовности или доступности груза
  ready: { type: String, required: false },
  // Тип транспортного средства, требуемого для перевозки (например, "тент", "рефрижератор")
  vehicle: { type: String, required: false },
  telefon: { type: String, required: false },
});

// Создаём дискриминатор для грузов на базе Order
export const CargoOrder = Order.discriminator("CargoOrder", CargoOrderSchema);

// ------------------ Схема для машин (MachineOrder) ------------------
const MachineOrderSchema = new mongoose.Schema({
  // Ссылка на страницу (если нужно сохранить)
  url: { type: String, required: false },
  // Марка
  marka: { type: String, required: false },
  // Тип (модель)
  tip: { type: String, required: false },
  // Кузов
  kuzov: { type: String, required: false },
  // Тип загрузки (например, "задняя", "боковая")
  tip_zagruzki: { type: String, required: false },
  // Грузоподъемность (например, "20 т")
  gruzopodyomnost: { type: String, required: false },
  // Вместимость (например, "50 м³")
  vmestimost: { type: String, required: false },
  // Дата готовности машины
  data_gotovnosti: { type: String, required: false },
  // Откуда (маршрут)
  otkuda: { type: String, required: false },
  // Куда (маршрут)
  kuda: { type: String, required: false },
  // Контактный телефон
  telefon: { type: String, required: false },
  // Контактное лицо (имя)
  imya: { type: String, required: false },
  // Название фирмы или профиль деятельности
  firma: { type: String, required: false },
  // Город (контакт)
  gorod: { type: String, required: false },
  // Почта (контакт)
  pochta: { type: String, required: false },
  // Название компании, если есть
  company: { type: String, required: false },
});

// Создаём дискриминатор для машин на базе Order
export const MachineOrder = Order.discriminator(
  "MachineOrder",
  MachineOrderSchema
);
