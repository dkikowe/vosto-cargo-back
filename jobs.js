import cron from "node-cron";
import ParseController from "./controllers/ParseController.js";
import { CargoOrder, MachineOrder } from "./models/Order.js";
import { startTelegramListener } from "./controllers/TelegaParser.mjs";

async function runParsingJob() {
  console.log("Запуск задания парсинга");
  try {
    // Парсим грузы
    const cargoRes = await ParseController.parseAvtodispetcher(
      {},
      { json: (data) => data }
    );
    const cargoData = cargoRes.data;
    await CargoOrder.deleteMany({});

    for (const cargo of cargoData) {
      const { orderNumber, ...rest } = cargo;
      const cargoOrder = new CargoOrder(rest);
      await cargoOrder.save();
    }

    // Парсим машины
    const machineRes = await ParseController.parseVehiclesFromAvtodispetcher(
      {},
      { json: (data) => data }
    );
    const machineData = machineRes.data;
    await MachineOrder.deleteMany({});

    for (const machine of machineData) {
      const { orderNumber, ...rest } = machine;
      const machineOrder = new MachineOrder(rest);
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
