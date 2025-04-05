import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

class ParseController {
  // Функция логина на Avtodispetcher через https://www.avtodispetcher.ru/login.html
  async loginAvtodispetcher(page) {
    console.log("Логин на Avtodispetcher...");
    await page.goto("https://www.avtodispetcher.ru/login.html", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });
    // Ждем появления полей ввода (проверьте актуальные селекторы)
    await page.waitForSelector("input[name='email']", { timeout: 10000 });
    await page.waitForSelector("input[name='password']", { timeout: 10000 });
    await page.type("input[name='email']", "didokio123@yandex.ru", {
      delay: 100,
    });
    await page.type("input[name='password']", "8AKuOdsWj", { delay: 100 });
    await page.click("input[type='submit']");
    // Ждем перехода после входа
    await page.goto("https://www.avtodispetcher.ru/", {
      waitUntil: "domcontentloaded",
      timeout: 120000, // увеличен таймаут до 120 секунд
    });

    console.log("Логин выполнен.");
  }

  /**
   * Парсинг грузов с https://www.avtodispetcher.ru/consignor/
   * Теперь реализована пагинация – перебираются страницы, как у машин, и для каждой строки,
   * если есть детальная ссылка, открывается детальная страница для получения номера телефона.
   */
  async parseAvtodispetcher(req, res) {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
        defaultViewport: null,
      });
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      // Логинимся, чтобы получить доступ к номерам телефонов
      await this.loginAvtodispetcher(page);

      const maxPages = 2;
      let currentPage = 1;
      const cargoList = [];

      while (true) {
        const url =
          currentPage === 1
            ? "https://www.avtodispetcher.ru/consignor/"
            : `https://www.avtodispetcher.ru/consignor/page-2`;
        console.log(`Парсинг грузов, страница ${currentPage}: ${url}`);

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });
        // Если таблица не найдена – прекращаем цикл
        const tableHandle = await page.$("table");
        if (!tableHandle) {
          console.log(
            `Нет таблицы на странице ${currentPage}, завершаем парсинг грузов.`
          );
          break;
        }
        // Получаем строки таблицы
        const rows = await page.$$("table tr");
        console.log(`Страница ${currentPage}: найдено строк ${rows.length}`);
        // Пропускаем заголовок (первая строка)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const cells = await row.$$("td");
          if (cells.length < 6) continue;

          const from = (
            await (await cells[0].getProperty("innerText")).jsonValue()
          ).trim();
          let toRaw = (
            await (await cells[1].getProperty("innerText")).jsonValue()
          ).trim();
          let to = toRaw.replace(/\s*\d+\s*км$/, "").trim();
          const cargoText = (
            await (await cells[2].getProperty("innerText")).jsonValue()
          ).trim();
          const rate = (
            await (await cells[3].getProperty("innerText")).jsonValue()
          )
            .replace(/\s+/g, " ")
            .trim();
          const ready = (
            await (await cells[4].getProperty("innerText")).jsonValue()
          )
            .replace(/\s+/g, " ")
            .trim();
          const vehicle = (
            await (await cells[5].getProperty("innerText")).jsonValue()
          )
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

          // Пытаемся найти детальную ссылку – ищем первый <a> в строке
          let detailLink = null;
          const anchor = await row.$("a");
          if (anchor) {
            detailLink = await (await anchor.getProperty("href")).jsonValue();
          }

          let telefon = "";
          if (detailLink) {
            const detailPage = await browser.newPage();
            try {
              await detailPage.goto(detailLink, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
              });
              // Ищем элемент с изображением телефона
              const phoneImg = await detailPage.$(".phoneImg");
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
                  console.log(
                    "Ошибка при скриншоте телефона:",
                    screenshotError
                  );
                }
              }
              if (telefon) {
                telefon = telefon.replace(/\D/g, "");
                if (telefon[0] !== "7") {
                  telefon = "7" + telefon.slice(1);
                }
              }
            } catch (detailError) {
              console.log(
                "Ошибка при парсинге детальной страницы:",
                detailError
              );
            } finally {
              await detailPage.close();
            }
          }

          cargoList.push({
            from,
            to,
            cargo: cargoText,
            weight,
            volume,
            rate,
            ready,
            vehicle,
            telefon,
          });
        }
        currentPage++;
        // Если достигли лимита страниц, прекращаем цикл
        if (currentPage > maxPages) {
          console.log(
            `Достигнут лимит ${maxPages} страниц, завершаем парсинг грузов.`
          );
          break;
        }
      }

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
   * Парсинг всех машин с https://avtodispetcher.ru/truck/
   * Параллельная обработка детальных ссылок (chunk)
   * (Для машин консольные логи убраны)
   */
  async parseVehiclesFromAvtodispetcher(req, res) {
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
        defaultViewport: null,
      });
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      const detailLinksSet = new Set();
      let currentPage = 1;
      const maxPages = 47;
      while (true) {
        const url =
          currentPage === 1
            ? "https://avtodispetcher.ru/truck/"
            : `https://avtodispetcher.ru/truck/page-${currentPage}`;
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        const tableHandle = await page.$("table");
        if (!tableHandle) break;
        const links = await page.$$eval(
          'table tr td a[href^="/truck/"][href$=".html"]',
          (els) =>
            els.map(
              (el) =>
                new URL(el.getAttribute("href"), "https://avtodispetcher.ru")
                  .href
            )
        );
        if (!links.length) break;
        if (currentPage === 48) break;
        links.forEach((link) => detailLinksSet.add(link));
        currentPage++;
        if (currentPage > maxPages) break;
      }
      const detailLinks = Array.from(detailLinksSet);
      const chunkSize = 5;
      const results = [];
      const parseOneVehicle = async (link) => {
        const pageDetail = await browser.newPage();
        try {
          await pageDetail.goto(link, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          try {
            await pageDetail.waitForSelector("table", { timeout: 10000 });
          } catch {}
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
          let telefon =
            detailData["Контактный телефон №1"] || detailData["Телефон"] || "";
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
              } catch {}
            }
          }
          if (telefon) {
            telefon = telefon.replace(/\D/g, "");
            if (telefon[0] !== "7") {
              telefon = "7" + telefon.slice(1);
            }
          }
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
          await pageDetail.close();
        }
      };

      for (let i = 0; i < detailLinks.length; i += chunkSize) {
        const chunk = detailLinks.slice(i, i + chunkSize);
        const chunkPromises = chunk.map((link) => parseOneVehicle(link));
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
