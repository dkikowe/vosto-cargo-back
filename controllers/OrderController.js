import { CargoOrder, MachineOrder, Order } from "../models/Order.js";

export const createOrder = async (req, res) => {
  try {
    // Извлекаем основные поля из запроса
    const { userId, orderType, description, ...rest } = req.body;

    if (!userId || !orderType) {
      return res.status(400).json({
        error: "Требуются userId и orderType (CargoOrder или MachineOrder)",
      });
    }

    let newOrder;

    if (orderType === "CargoOrder") {
      // Для груза преобразуем поля так, чтобы они соответствовали схеме:
      // схема ожидает: from, to, cargo, weight, volume, rate, ready, vehicle
      newOrder = new CargoOrder({
        description,
        createdBy: userId,
        from: rest.from || "", // Место загрузки
        to: rest.to || "", // Место выгрузки
        cargo: rest.cargo || "", // Наименование груза
        weight: rest.weight ? rest.weight.toString() : "",
        volume: rest.volume ? rest.volume.toString() : "",
        rate: rest.rate || "",
        ready: rest.ready || "",
        vehicle: rest.vehicle || "",
        paymentMethod: rest.paymentMethod || "",
        telefon: rest.telefon || "",
      });
    } else if (orderType === "MachineOrder") {
      // Для машины схема требует: marka, tip, kuzov, tip_zagruzki, gruzopodyomnost, vmestimost,
      // data_gotovnosti, otkuda, kuda, telefon, imya, firma, gorod, pochta, company
      // Если на форме у вас разделено на два поля (например, marka и tip), то используйте их.
      // Если же у вас введено в одном поле (brandAndModel), то можно разделить:

      newOrder = new MachineOrder({
        description,
        createdBy: userId,
        marka: rest.marka,
        tip: rest.tip,
        kuzov: rest.kuzov || "",
        tip_zagruzki: rest.tip_zagruzki || "",
        gruzopodyomnost: rest.gruzopodyomnost
          ? rest.gruzopodyomnost.toString()
          : "",
        vmestimost: rest.vmestimost ? rest.vmestimost.toString() : "",
        data_gotovnosti: rest.data_gotovnosti || "",
        otkuda: rest.otkuda || "",
        kuda: rest.kuda || "",
        telefon: rest.telefon || "",
        imya: rest.contactName || "",
        firma: rest.firm || "",
        gorod: rest.gorod || "",
        pochta: rest.pochta || "",
        company: rest.company || "",
        paymentMethod: rest.paymentMethod || "",
      });
    } else {
      return res.status(400).json({ error: "Неверный тип заявки (orderType)" });
    }

    const savedOrder = await newOrder.save();
    return res.status(201).json(savedOrder);
  } catch (error) {
    console.error("Ошибка в createOrder:", error);
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

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Ошибка при получении заказов:", error);
    res.status(500).json({
      message: "Не удалось получить список заказов",
    });
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
