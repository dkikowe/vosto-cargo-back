import mongoose from "mongoose";

// ------------------ Базовая схема заказа ------------------
const options = { discriminatorKey: "orderType", timestamps: true };

const orderSchema = new mongoose.Schema(
  {
    // Общее описание или комментарий к заказу
    description: {
      type: String,
      required: false,
    },
    // ID пользователя, который создал заказ
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Флаг архивированности заказа
    isArchived: {
      type: Boolean,
      default: false,
    },
    // Способ оплаты (Кэш или Карта)
    paymentMethod: {
      type: String,
      enum: ["Кэш", "Карта"],
      required: false,
    },
  },
  options
);

export const Order = mongoose.model("Order", orderSchema);

// ------------------ Схема для размещения груза (CargoOrder) ------------------
const CargoOrderSchema = new mongoose.Schema({
  // Место загрузки
  loadingPlace: { type: String, required: true },
  // Место выгрузки
  unloadingPlace: { type: String, required: true },
  // Наименование груза
  cargoName: { type: String, required: true },
  // Объём груза (кубометры)
  volume: { type: Number, required: false },
  // Вес груза (кг)
  weight: { type: Number, required: false },
  // Температурный режим
  temperature: { type: Number, required: false },
  // Тип кузова (тент, рефрижератор и т.д.)
  bodyType: { type: String, required: false },
  // Тип загрузки (верхняя, боковая, задняя и т.п.)
  loadingType: { type: String, required: false },
  // Чекбоксы: TIR, CRM, медкнижка
  TIR: { type: Boolean, default: false },
  CRM: { type: Boolean, default: false },
  medKnizhka: { type: Boolean, default: false },
});

// Создаём дискриминатор на базе Order
export const CargoOrder = Order.discriminator("CargoOrder", CargoOrderSchema);

// ------------------ Схема для размещения машины (MachineOrder) ------------------
const MachineOrderSchema = new mongoose.Schema({
  // Гос. номер
  licensePlate: { type: String, required: true },
  // Марка и модель
  brandAndModel: { type: String, required: false },
  // Тип машины (грузовик, полуприцеп, сцепка и т.д.)
  machineType: {
    type: String,
    enum: ["Грузовик", "Полуприцеп", "Сцепка"],
    required: true,
  },
  // Грузоподъёмность (число)
  payloadCapacity: { type: Number, required: true },
  // Объём кузова (кубометры)
  bodyVolume: { type: Number, required: false },
  // Тип(ы) загрузки: массив, т.к. может быть несколько
  loadingTypes: [
    {
      type: String,
      enum: [
        "Аппарели",
        "Без борта",
        "Боковая",
        "Боковая с 2-х сторон",
        "Реверс",
        "Гидроборт",
        "Задняя",
        "Наличие",
        "С бортами",
        "Со снятыми бортами",
      ],
    },
  ],
  // Маршрут (откуда и куда)
  route: { type: String, required: false },
  // Дата загрузки (если одна дата)
  loadingDate: { type: Date, required: false },
  // Выбор формата даты (Постоянно, Машина готова, Период)
  dateOption: {
    type: String,
    enum: ["Постоянно", "Машина готова", "Период"],
    required: false,
  },
  // Период (с ... по ...), если выбрано "Период"
  loadingPeriod: {
    from: { type: Date },
    to: { type: Date },
  },
  // Чекбоксы разрешений
  TIR: { type: Boolean, default: false },
  EKMT: { type: Boolean, default: false },
  // ADR-классы (массив)
  ADR: {
    type: [String], // например: ["ADR1", "ADR3", "ADR5.1"]
    default: [],
  },
  // GPS-мониторинг
  gpsMonitoring: { type: Boolean, default: false },
});

// Создаём дискриминатор на базе Order
export const MachineOrder = Order.discriminator(
  "MachineOrder",
  MachineOrderSchema
);
