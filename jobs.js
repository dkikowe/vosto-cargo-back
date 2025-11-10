import cron from "node-cron";
import ParseController from "./controllers/ParseController.js";
import { CargoOrder, MachineOrder } from "./models/Order.js";
// import { startTelegramListener } from "./controllers/TelegaParser.mjs";

async function runParsingJob() {
  console.log("Запуск задания парсинга");
  try {
    // Создаем mock объекты для req и res
    const mockReq = {};
    const mockRes = {
      json: (data) => data,
    };

    // Парсим грузы
    const cargoRes = await ParseController.parseAvtodispetcher(
      mockReq,
      mockRes
    );
    const cargoData = cargoRes.data;

    // Удаляем только те заказы, которые были созданы парсером
    await CargoOrder.deleteMany({ source: "parser" });

    for (const cargo of cargoData) {
      const { orderNumber, ...rest } = cargo;
      const cargoOrder = new CargoOrder({ ...rest, source: "parser" });
      await cargoOrder.save();
    }

    // Парсим машины
    const machineRes = await ParseController.parseVehiclesFromAvtodispetcher(
      mockReq,
      mockRes
    );
    const machineData = machineRes.data;

    await MachineOrder.deleteMany({ source: "parser" });

    for (const machine of machineData) {
      const { orderNumber, ...rest } = machine;
      const machineOrder = new MachineOrder({ ...rest, source: "parser" });
      await machineOrder.save();
    }

    console.log("Парсинг и сохранение завершены успешно.");
  } catch (error) {
    console.error("Ошибка при выполнении парсинга и сохранении:", error);
  }
}

// Запуск по расписанию: каждый час, в начале часа
cron.schedule("0 * * * *", runParsingJob);

// Выполнить один раз сразу при старте
runParsingJob();
