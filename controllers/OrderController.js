import { Order, CargoOrder, MachineOrder } from "../models/Order.js";

// Создание заказа (груза или машины) в зависимости от orderType
export const createOrder = async (req, res) => {
  try {
    const { userId, orderType, description, ...orderData } = req.body;

    // Проверяем наличие обязательных полей
    if (!userId || !orderType) {
      return res.status(400).json({
        error: "Требуются userId и orderType (CargoOrder или MachineOrder)",
      });
    }

    let newOrder;
    // Если это заявка на груз
    if (orderType === "CargoOrder") {
      newOrder = new CargoOrder({
        description,
        createdBy: userId,
        ...orderData, // поля схемы CargoOrder
      });
    }
    // Если это заявка на машину
    else if (orderType === "MachineOrder") {
      newOrder = new MachineOrder({
        description,
        createdBy: userId,
        ...orderData, // поля схемы MachineOrder
      });
    } else {
      return res.status(400).json({ error: "Неверный тип заявки (orderType)" });
    }

    const savedOrder = await newOrder.save();
    return res.status(201).json(savedOrder);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Получение всех заказов конкретного пользователя (по userId)
export const getOrders = async (req, res) => {
  try {
    const { userId, isArchived } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "Не указан userId" });
    }

    const filter = { createdBy: userId };
    if (isArchived !== undefined) {
      filter.isArchived = isArchived === "true"; // Преобразование строки в boolean
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Обновление заказа
export const updateOrder = async (req, res) => {
  try {
    // Берем orderId из параметров URL
    const { id } = req.params;
    const { userId, ...updateData } = req.body;

    if (!userId || !id) {
      return res.status(400).json({
        error: "Нужны userId и orderId для обновления заказа",
      });
    }

    // Находим заказ по _id и автору
    const order = await Order.findOne({ _id: id, createdBy: userId });
    if (!order) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    // Обновляем поля в найденном документе
    Object.assign(order, updateData);
    const updatedOrder = await order.save();
    return res.json(updatedOrder);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Удаление заказа
export const deleteOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.body;
    if (!userId || !orderId) {
      return res.status(400).json({
        error: "Нужны userId и orderId для удаления заказа",
      });
    }

    // Удаляем, если заказ принадлежит пользователю
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

// Архивирование заказа (обновляем поле isArchived на true)
export const archiveOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.body;
    if (!userId || !orderId) {
      return res
        .status(400)
        .json({ error: "Нужны userId и orderId для архивирования" });
    }

    // Находим заказ и обновляем флаг isArchived
    const order = await Order.findOneAndUpdate(
      { _id: orderId, createdBy: userId },
      { isArchived: true },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    return res.json({ message: "Заказ успешно архивирован", order });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Восстановление заказа (обновляем поле isArchived на false)
export const restoreOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.body;
    if (!userId || !orderId) {
      return res
        .status(400)
        .json({ error: "Нужны userId и orderId для восстановления заказа" });
    }

    const order = await Order.findOneAndUpdate(
      { _id: orderId, createdBy: userId, isArchived: true },
      { isArchived: false },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Архивированный заказ не найден" });
    }

    return res.json({ message: "Заказ успешно восстановлен", order });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
