import {
  Order,
  CargoProviderOrder,
  CarrierOrder,
  DispatcherOrder,
} from "../models/Order.js";

// Создание заказа с использованием нужной модели в зависимости от роли
export const createOrder = async (req, res) => {
  try {
    const { userId, role, description, ...orderData } = req.body;

    // Проверяем, что в body пришёл userId и роль
    if (!userId || !role) {
      return res.status(400).json({
        error: "Требуются userId и role для создания заказа",
      });
    }

    let newOrder;
    if (role === "Грузодатель") {
      newOrder = new CargoProviderOrder({
        description,
        createdBy: userId,
        ...orderData, // поля: cargoDetails, origin, destination, weight и т.д.
      });
    } else if (role === "Грузоперевозчик") {
      newOrder = new CarrierOrder({
        description,
        createdBy: userId,
        ...orderData, // поля: vehicle, maxLoad
      });
    } else if (role === "Диспетчер") {
      newOrder = new DispatcherOrder({
        description,
        createdBy: userId,
        ...orderData, // поле: dispatcherComments
      });
    } else {
      return res.status(400).json({ error: "Неверная роль пользователя" });
    }

    const savedOrder = await newOrder.save();
    return res.status(201).json(savedOrder);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Получение всех заказов пользователя (по userId без авторизации)
export const getOrders = async (req, res) => {
  try {
    const { userId } = req.query;
    // Или req.params, если удобнее. Можно передавать userId в query-параметрах: /orders?userId=xxx

    if (!userId) {
      return res.status(400).json({ error: "Не указан userId" });
    }

    const orders = await Order.find({ createdBy: userId }).sort({
      createdAt: -1,
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Обновление заказа (без проверки авторизации - просто по userId и orderId)
export const updateOrder = async (req, res) => {
  try {
    const { userId, orderId, ...updateData } = req.body;
    if (!userId || !orderId) {
      return res.status(400).json({ error: "Нужны userId и orderId" });
    }

    // Находим заказ и проверяем, что он принадлежит userId
    const order = await Order.findOne({ _id: orderId, createdBy: userId });
    if (!order) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    // Обновляем заказ, используя данные из req.body
    Object.assign(order, updateData);
    const updatedOrder = await order.save();
    return res.json(updatedOrder);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Удаление заказа (тоже без аутентификации, просто проверка userId и orderId)
export const deleteOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.body;
    if (!userId || !orderId) {
      return res.status(400).json({ error: "Нужны userId и orderId" });
    }

    const deletedOrder = await Order.findOneAndDelete({
      _id: orderId,
      createdBy: userId,
    });
    if (!deletedOrder) {
      return res
        .status(404)
        .json({ error: "Заказ не найден или доступ запрещён" });
    }
    return res.json({ message: "Заказ успешно удалён" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
