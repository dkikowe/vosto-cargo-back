import mongoose from "mongoose";
import { Order } from "./Order.js"; // Импортируем базовую модель Order

// ------------------ Схема для размещения машины ------------------
const MachineOrderSchema = new mongoose.Schema(
  {
    // Гос. номер
    licensePlate: { type: String, required: true },

    // Марка и модель
    brandAndModel: { type: String, required: false },

    // Тип машины (например, "Грузовик", "Полуприцеп", "Сцепка")
    machineType: {
      type: String,
      enum: ["Грузовик", "Полуприцеп", "Сцепка"],
      required: true,
    },

    // Грузоподъёмность (число)
    payloadCapacity: { type: Number, required: true },

    // Объём кузова (число, куб.м. или другая единица)
    bodyVolume: { type: Number, required: false },

    // Тип загрузки (может быть несколько вариантов)
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

    // Дата (или даты) загрузки
    // Если заявка разовая – используем loadingDate.
    // Если период/регулярно – используем ниже dateOption и loadingPeriod.
    loadingDate: { type: Date, required: false },

    // Выбор типа даты: "Постоянно", "Регулярно", "Период"
    dateOption: {
      type: String,
      enum: ["Постоянно", "Регулярно", "Период"],
      required: false,
    },

    // Период загрузки (с ... по ...), если выбран вариант "Период"
    loadingPeriod: {
      from: { type: Date },
      to: { type: Date },
    },

    // Разрешения (чекбоксы)
    TIR: { type: Boolean, default: false },
    EKMT: { type: Boolean, default: false },
    // ADR 1-9 можно хранить массивом, если может быть несколько классов ADR
    ADR: {
      type: [String], // ["ADR1", "ADR2", ...]
      default: [],
    },
    // GPS-мониторинг
    gpsMonitoring: { type: Boolean, default: false },
  },
  { _id: false } // Можно не создавать отдельный _id для дискриминатора
);

// Делаем дискриминатор на базе Order
export const MachineOrder = Order.discriminator(
  "MachineOrder",
  MachineOrderSchema
);
