import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

class ParseController {
  /**
   * Парсинг грузов с https://www.avtodispetcher.ru/consignor/
   * (без изменений)
   */
  async parseAvtodispetcher(req, res) {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: null,
      });
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      await page.goto("https://www.avtodispetcher.ru/consignor/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForSelector("table");

      const cargoList = await page.$$eval("table tr", (rows) => {
        return Array.from(rows)
          .slice(1)
          .map((row) => {
            const cells = row.querySelectorAll("td");
            if (cells.length < 6) return null;

            const from = cells[0].innerText.trim();
            let to = cells[1].innerText
              .trim()
              .replace(/\s*\d+\s*км$/, "")
              .trim();

            const cargoText = cells[2].innerText.trim();
            const rate = cells[3].innerText.replace(/\s+/g, " ").trim();
            const ready = cells[4].innerText.replace(/\s+/g, " ").trim();
            const vehicle = cells[5].innerText
              .replace(/подробнее/gi, "")
              .replace(/\s+/g, " ")
              .trim();

            const weightMatch = cargoText.match(/([\d.,]+)\s*(т|тонн)/i);
            const volumeMatch = cargoText.match(/([\d.,]+)\s*(м3|м³)/i);

            const weight = weightMatch
              ? weightMatch[1].replace(",", ".") + " т"
              : "";
            const volume = volumeMatch
              ? volumeMatch[1].replace(",", ".") + " м³"
              : "";

            return {
              from,
              to,
              cargo: cargoText,
              weight,
              volume,
              rate,
              ready,
              vehicle,
            };
          })
          .filter(Boolean);
      });

      await browser.close();

      return res.json({
        success: true,
        totalFound: cargoList.length,
        data: cargoList,
      });
    } catch (error) {
      console.error("Ошибка при парсинге грузов:", error);
      return res.status(500).json({
        success: false,
        error: "Ошибка при парсинге грузов",
        details: error.message,
      });
    }
  }

  /**
   * Парсинг всех машин с http://avtodispetcher.ru/truck/
   * Теперь с параллельной (chunk) обработкой детальных ссылок
   */
  async parseVehiclesFromAvtodispetcher(req, res) {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: null,
      });
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Собираем ссылки на детальные страницы со всех страниц
      const detailLinksSet = new Set();
      let currentPage = 1;
      const maxPages = 50;

      while (true) {
        const url =
          currentPage === 1
            ? "http://avtodispetcher.ru/truck/"
            : `http://avtodispetcher.ru/truck/page/${currentPage}/`;
        console.log(`Сканируем список машин, страница ${currentPage}: ${url}`);

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        const tableHandle = await page.$("table");
        if (!tableHandle) {
          console.log(`Нет таблицы на странице ${currentPage}, выходим.`);
          break;
        }

        const links = await page.$$eval(
          'table tr td a[href^="/truck/"][href$=".html"]',
          (els) => els.map((el) => el.href)
        );
        console.log(
          `На странице ${currentPage} найдено ссылок: ${links.length}`
        );

        if (!links.length) {
          break;
        }

        links.forEach((link) => detailLinksSet.add(link));
        currentPage++;
        if (currentPage > maxPages) {
          console.log(`Достигнут лимит ${maxPages} страниц, останавливаемся.`);
          break;
        }
      }

      console.log("Уникальных детальных ссылок:", detailLinksSet.size);

      // Преобразуем Set в массив, чтобы обрабатывать чанками
      const detailLinks = Array.from(detailLinksSet);

      // Сколько страниц обрабатываем параллельно
      const chunkSize = 5;
      const results = [];

      // Функция, парсящая одну детальную ссылку
      const parseOneVehicle = async (link) => {
        console.log("Парсинг машины:", link);
        const pageDetail = await browser.newPage();
        try {
          await pageDetail.goto(link, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });

          try {
            await pageDetail.waitForSelector("table", { timeout: 10000 });
          } catch {
            console.log("Нет таблицы на детальной странице:", link);
          }

          // Парсим данные из таблицы
          const detailData = await pageDetail.$$eval("table tr", (rows) => {
            const data = {};
            rows.forEach((row) => {
              const tds = row.querySelectorAll("td");
              if (tds.length === 2) {
                const fieldName = tds[0].innerText.trim();
                const fieldValue = tds[1].innerText.trim();
                data[fieldName] = fieldValue;
              }
            });
            return data;
          });
          console.log("Детальные данные:", detailData);

          let telefon =
            detailData["Контактный телефон №1"] || detailData["Телефон"] || "";

          // Если телефон не найден, пытаемся найти .phoneImg
          if (!telefon) {
            const phoneImg = await pageDetail.$(".phoneImg");
            if (phoneImg) {
              const tempFile = path.resolve(`phone-${uuidv4()}.png`);
              try {
                await phoneImg.screenshot({ path: tempFile });
                const {
                  data: { text },
                } = await Tesseract.recognize(tempFile, "eng");
                telefon = text.trim();
                fs.unlinkSync(tempFile);
              } catch (screenshotError) {
                console.log("Ошибка при скриншоте телефона:", screenshotError);
              }
            }
          }

          if (telefon) {
            // Убираем все нецифровые символы
            telefon = telefon.replace(/\D/g, "");
            // Если первая цифра не "7", заменяем её на "7"
            if (telefon[0] !== "7") {
              telefon = "7" + telefon.slice(1);
            }
          }

          // Разбиваем "Марка и тип"
          const fullMarkaTip =
            detailData["Марка и тип"] || detailData["Марка, тип"] || "";
          let marka = "";
          let tip = "";
          if (fullMarkaTip) {
            const parts = fullMarkaTip.split(/\s+/, 2);
            marka = parts[0] || "";
            tip = parts[1] || "";
          }

          return {
            url: link,
            marka,
            tip,
            kuzov: detailData["Кузов"] || "",
            tip_zagruzki:
              detailData["Загрузка"] || detailData["Тип загрузки"] || "",
            gruzopodyomnost: detailData["Грузоподъемность"] || "",
            vmestimost: detailData["Вместимость"] || "",
            data_gotovnosti:
              detailData["Готовность"] || detailData["Дата готовности"] || "",
            otkuda: detailData["Откуда"] || "",
            kuda: detailData["Куда"] || "",
            telefon,
            imya: detailData["Контактное лицо"] || detailData["Имя"] || "",
            firma:
              detailData["Профиль деятельности"] || detailData["Фирма"] || "",
            gorod: detailData["Город"] || "",
            pochta: detailData["Почта"] || "",
            сompany: detailData["Название компании"] || "",
          };
        } finally {
          // Закрываем страницу
          await pageDetail.close();
        }
      };

      // Пошагово обрабатываем массив ссылок chunk'ами по 5
      for (let i = 0; i < detailLinks.length; i += chunkSize) {
        const chunk = detailLinks.slice(i, i + chunkSize);

        // Для каждого link в chunk запускаем parseOneVehicle параллельно
        const chunkPromises = chunk.map((link) => parseOneVehicle(link));

        // Ждём, пока все из текущего куска завершатся
        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults);
      }

      await browser.close();

      return res.json({
        success: true,
        totalFound: results.length,
        data: results,
      });
    } catch (error) {
      console.error("Ошибка при парсинге машин:", error);
      return res.status(500).json({
        success: false,
        error: "Ошибка при парсинге машин",
        details: error.message,
      });
    }
  }
}

export default new ParseController();
