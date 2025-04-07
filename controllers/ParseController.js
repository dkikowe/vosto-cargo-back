import puppeteer from "puppeteer";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

class ParseController {
  async loginAvtodispetcher(page) {
    console.log("Логин на Avtodispetcher...");
    await page.goto("https://www.avtodispetcher.ru/login.html", {
      waitUntil: "networkidle2",
      timeout: 120000,
    });
    await page.waitForSelector("input[name='email']", { timeout: 10000 });
    await page.waitForSelector("input[name='password']", { timeout: 10000 });
    await page.type("input[name='email']", "didokio123@yandex.ru", {
      delay: 100,
    });
    await page.type("input[name='password']", "8AKuOdsWj", { delay: 100 });
    await page.click("input[type='submit']");
    await page.goto("https://www.avtodispetcher.ru/", {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    console.log("Логин выполнен.");
  }

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
      await this.loginAvtodispetcher(page);
      const sessionCookies = await page.cookies();

      const maxPages = 2;
      let currentPage = 1;
      const cargoList = [];
      let orderNumber = 1;

      while (true) {
        const url =
          currentPage === 1
            ? "https://www.avtodispetcher.ru/consignor/"
            : `https://www.avtodispetcher.ru/consignor/page-${currentPage}`;
        console.log(`Парсинг грузов, страница ${currentPage}: ${url}`);

        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 120000,
        });
        const tableHandle = await page.$("table");
        if (!tableHandle) {
          console.log(
            `Нет таблицы на странице ${currentPage}, завершаем парсинг грузов.`
          );
          break;
        }
        const rows = await page.$$("table tr");
        console.log(`Страница ${currentPage}: найдено строк ${rows.length}`);
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

          let detailLink = null;
          const anchor = await row.$("a");
          if (anchor) {
            detailLink = await (await anchor.getProperty("href")).jsonValue();
          }

          let telefon = "";
          if (detailLink) {
            const detailPage = await browser.newPage();
            await detailPage.setCookie(...sessionCookies);
            try {
              await detailPage.goto(detailLink, {
                waitUntil: "domcontentloaded",
                timeout: 120000,
              });
              await new Promise((resolve) => setTimeout(resolve, 1500));

              const phoneImg = await detailPage.$(".phoneImg");
              if (phoneImg) {
                const box = await phoneImg.boundingBox();
                if (box && box.width > 20) {
                  const tempFile = path.resolve(`phone-${uuidv4()}.png`);
                  try {
                    await phoneImg.screenshot({ path: tempFile });
                    const {
                      data: { text },
                    } = await Tesseract.recognize(tempFile, "eng", {
                      tessedit_char_whitelist: "0123456789+() ",
                    });
                    telefon = text.trim();
                    fs.unlinkSync(tempFile);
                  } catch (screenshotError) {
                    console.log("Ошибка OCR:", screenshotError.message);
                  }
                } else {
                  console.log(
                    "Телефонное изображение не загрузилось или пустое."
                  );
                }
              }

              if (telefon) {
                telefon = telefon.replace(/\D/g, "");
                if (telefon[0] !== "7") {
                  telefon = "7" + telefon.slice(1);
                }
              } else {
                console.log(
                  `Номер не найден для груза по ссылке: ${detailLink}`
                );
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
            orderNumber,
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
          orderNumber++;
        }
        currentPage++;
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
      console.log("Начинаем парсинг машин с Avtodispetcher...");

      while (true) {
        const url =
          currentPage === 1
            ? "https://avtodispetcher.ru/truck/"
            : `https://avtodispetcher.ru/truck/page-${currentPage}`;
        console.log(`Парсинг машин, страница ${currentPage}: ${url}`);
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        const tableHandle = await page.$("table");
        if (!tableHandle) {
          console.log(`Нет таблицы на странице ${currentPage}, завершаем.`);
          break;
        }

        const links = await page.$$eval(
          'table tr td a[href^="/truck/"][href$=".html"]',
          (els) =>
            els.map(
              (el) =>
                new URL(el.getAttribute("href"), "https://avtodispetcher.ru")
                  .href
            )
        );
        console.log(
          `Найдено ${links.length} ссылок на странице ${currentPage}`
        );

        if (!links.length) {
          console.log("Ссылки не найдены, останавливаемся.");
          break;
        }

        links.forEach((link) => detailLinksSet.add(link));
        currentPage++;
        if (currentPage > maxPages) {
          console.log(`Достигнут лимит ${maxPages} страниц.`);
          break;
        }
      }

      const detailLinks = Array.from(detailLinksSet);
      console.log(`Всего собрано ${detailLinks.length} уникальных ссылок.`);

      const chunkSize = 5;
      const results = [];

      const parseOneVehicle = async (link, globalIndex) => {
        const pageDetail = await browser.newPage();
        try {
          console.log(
            `[${globalIndex + 1}/${detailLinks.length}] Обработка: ${link}`
          );
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
            detailData["Контактный телефон №1"] || detailData["Телефон"];

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
              } catch (err) {
                console.log("Ошибка при распознавании номера:", err.message);
              }
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
            orderNumber: globalIndex + 1,
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
        console.log(`Обработка чанка: ${i + 1} – ${i + chunk.length}`);
        const chunkResults = await Promise.all(
          chunk.map((link, index) => parseOneVehicle(link, i + index))
        );
        results.push(...chunkResults);
      }

      await browser.close();
      console.log(`Парсинг завершён. Найдено ${results.length} машин.`);
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
