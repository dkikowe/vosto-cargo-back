import cron from "node-cron";
import ParseController from "./controllers/ParseController.js";
import { CargoOrder, MachineOrder } from "./models/Order.js";

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
    await CargoOrder.insertMany(cargoData);

    // Парсим машины
    const machineRes = await ParseController.parseVehiclesFromAvtodispetcher(
      {},
      { json: (data) => data }
    );
    const machineData = machineRes.data;
    await MachineOrder.deleteMany({});
    await MachineOrder.insertMany(machineData);

    console.log("Парсинг и сохранение завершены успешно.");
  } catch (error) {
    console.error("Ошибка при выполнении парсинга и сохранении:", error);
  }
}

// Запуск по расписанию: каждый час, в начале часа
cron.schedule("0 * * * *", runParsingJob);

// Выполнить один раз сразу при старте
runParsingJob();
