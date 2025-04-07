import mongoose from "mongoose";

// ------------------ Счётчик для orderNumber ------------------
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

// ------------------ Базовая схема заказа ------------------
const options = { discriminatorKey: "orderType", timestamps: true };

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: Number,
      unique: true,
      index: true,
    },
    description: { type: String, required: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    isArchived: { type: Boolean, default: false },
    paymentMethod: {
      type: String,
      required: false,
    },
  },
  options
);

// TTL: удаление заказов через 7 дней
orderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

// Автоинкремент orderNumber при создании
orderSchema.pre("save", async function (next) {
  if (
    this.isNew &&
    (this.orderNumber === null || this.orderNumber === undefined)
  ) {
    try {
      const min = 1;
      const max = 100000; // Диапазон можно изменить по требованиям
      let newNumber;
      let exists = true;
      // Генерируем новый orderNumber, пока не найдём уникальное значение
      do {
        newNumber = Math.floor(Math.random() * (max - min + 1)) + min;
        exists = await this.constructor.exists({ orderNumber: newNumber });
      } while (exists);
      this.orderNumber = newNumber;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

export const Order = mongoose.model("Order", orderSchema);

// ------------------ Схема для грузов (CargoOrder) ------------------
const CargoOrderSchema = new mongoose.Schema({
  from: { type: String, required: false },
  to: { type: String, required: false },
  cargo: { type: String, required: false },
  weight: { type: String, required: false },
  volume: { type: String, required: false },
  rate: { type: String, required: false },
  ready: { type: String, required: false },
  vehicle: { type: String, required: false },
  telefon: { type: String, required: false },
});

export const CargoOrder = Order.discriminator("CargoOrder", CargoOrderSchema);

// ------------------ Схема для машин (MachineOrder) ------------------
const MachineOrderSchema = new mongoose.Schema({
  url: { type: String, required: false },
  marka: { type: String, required: false },
  tip: { type: String, required: false },
  kuzov: { type: String, required: false },
  tip_zagruzki: { type: String, required: false },
  gruzopodyomnost: { type: String, required: false },
  vmestimost: { type: String, required: false },
  data_gotovnosti: { type: String, required: false },
  otkuda: { type: String, required: false },
  kuda: { type: String, required: false },
  telefon: { type: String, required: false },
  imya: { type: String, required: false },
  firma: { type: String, required: false },
  gorod: { type: String, required: false },
  pochta: { type: String, required: false },
  company: { type: String, required: false },
});

export const MachineOrder = Order.discriminator(
  "MachineOrder",
  MachineOrderSchema
);
