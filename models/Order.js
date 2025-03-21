import mongoose from "mongoose";

const options = { discriminatorKey: "orderType", timestamps: true };

const orderSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    // Каждый заказ связан с пользователем, который его создал
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  options
);

export const Order = mongoose.model("Order", orderSchema);

// ------------------ Специализированные схемы заказов ------------------

// Заказ для Грузодателя (грузополучателя)
const CargoProviderOrderSchema = new mongoose.Schema({
  cargoDetails: { type: String, required: true }, // характеристики груза
  origin: { type: String, required: true }, // город отправления
  destination: { type: String, required: true }, // город назначения
  weight: { type: String, required: true },
});

export const CargoProviderOrder = Order.discriminator(
  "Грузодатель",
  CargoProviderOrderSchema
);

// Заказ для Грузоперевозчика
const CarrierOrderSchema = new mongoose.Schema({
  vehicle: { type: String, required: true }, // транспортное средство
  maxLoad: { type: Number, required: true }, // максимальная грузоподъемность
});

export const CarrierOrder = Order.discriminator(
  "Грузоперевозчик",
  CarrierOrderSchema
);

// Заказ для Диспетчера
const DispatcherOrderSchema = new mongoose.Schema({
  dispatcherComments: { type: String }, // комментарии диспетчера
  // можно добавить другие поля для контроля заказа
});

export const DispatcherOrder = Order.discriminator(
  "Диспетчер",
  DispatcherOrderSchema
);
