// controllers/ParseController.js
import puppeteer, { executablePath } from "puppeteer";
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ParseController {
  // ---------- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ----------

  async safeGoto(page, url, opts = {}) {
    // поочередно пробуем разные waitUntil, чтобы снизить хрупкость
    const modes = ["domcontentloaded", "load", "networkidle2"];
    let lastErr;
    for (const waitUntil of modes) {
      try {
        await page.goto(url, { timeout: 90000, waitUntil, ...opts });
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  async waitLoggedIn(page, timeout = 30000) {
    // Ждём признак авторизации: исчез инпут email или есть ссылка logout
    await page.waitForFunction(
      () => {
        const noEmailField = !document.querySelector("input[name='email']");
        const hasLogout = !!document.querySelector('a[href*="logout"]');
        return noEmailField || hasLogout;
      },
      { timeout }
    );
  }

  normalizePhone(raw) {
    if (!raw) return "";
    let digits = raw.replace(/\D/g, "");
    if (!digits) return "";

    // Приводим к E.164 для РФ (с допущениями)
    //  - "+7..." оставляем как 7...
    //  - "8..." -> "7..."
    //  - "7..." оставляем
    //  - если длина 10 и начинается с 9, добавляем 7
    if (digits.startsWith("8")) digits = "7" + digits.slice(1);
    else if (digits.startsWith("+7")) digits = "7" + digits.slice(2);
    else if (/^\d{10}$/.test(digits)) digits = "7" + digits;

    return digits;
  }

  async readPhoneFromImg(elHandle) {
    // скриншотим изображение с номером и OCR
    const tmp = path.resolve(__dirname, `phone-${uuidv4()}.png`);
    try {
      await elHandle.screenshot({ path: tmp });
      const {
        data: { text },
      } = await Tesseract.recognize(tmp, "eng+rus", {
        tessedit_char_whitelist: "0123456789+() -",
      });
      return this.normalizePhone(text.trim());
    } finally {
      try {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      } catch {}
    }
  }

  async createBrowser() {
    // userDataDir снижает частоту показов капчи за счёт сохранения сессии
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath(),
      userDataDir: path.resolve(__dirname, "../.puppeteer-profile"),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
      defaultViewport: { width: 1920, height: 1080 },
      ignoreDefaultArgs: ["--disable-extensions"],
    });
    return browser;
  }

  async preparePage(page) {
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(90000);

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
    });

    // Скрываем webdriver-флаг
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // Подписки на ошибки страницы
    page.on("error", (err) => {
      console.error("Ошибка страницы:", err);
    });

    page.on("pageerror", (err) => {
      // Глушим шумные ошибки сайта
      const m = String(err?.message || "");
      if (
        m.includes("ga.push is not a function") ||
        m.includes("tooltipster is not a function") ||
        m.includes("sticky is not a function") ||
        m.includes("Cannot read properties of undefined")
      ) {
        return;
      }
      console.error("Ошибка JavaScript на странице:", err);
    });
  }

  // ---------- ЛОГИН ----------

  async loginAvtodispetcher(page) {
    console.log("Логин на Avtodispetcher...");
    try {
      // На шаге логина НЕ блокируем ресурсы (CSS/картинки), чтобы не ломать форму и капчу
      await this.safeGoto(page, "https://www.avtodispetcher.ru/login.html");

      // Если уже не на странице логина — значит, авторизованы
      const currentUrl = page.url();
      if (
        currentUrl.includes("avtodispetcher.ru/") &&
        !currentUrl.includes("login.html")
      ) {
        console.log("Уже авторизованы");
        return;
      }

      await page.waitForSelector("input[name='email']", { timeout: 15000 });
      await page.waitForSelector("input[name='password']", { timeout: 15000 });

      // Очищаем и вводим
      await page.evaluate(() => {
        const e = document.querySelector("input[name='email']");
        const p = document.querySelector("input[name='password']");
        if (e) e.value = "";
        if (p) p.value = "";
      });

      await page.type("input[name='email']", "didokio123@yandex.ru", {
        delay: 80,
      });
      await page.type("input[name='password']", "8AKuOdsWj", { delay: 80 });

      await new Promise((r) => setTimeout(r, 500));

      // Параллельно кликаем и пытаемся поймать навигацию (если она будет)
      await Promise.allSettled([
        page.waitForNavigation({ waitUntil: "load", timeout: 60000 }),
        page.click("input[type='submit']"),
      ]);

      // Ждём признак залогиненности (исчез инпут email или появилась ссылка logout)
      await this.waitLoggedIn(page, 30000);

      console.log("Логин выполнен успешно.");
    } catch (error) {
      console.error("Ошибка при авторизации:", error);
      throw error;
    }
  }

  // ---------- ЧИСТАЯ ЛОГИКА: СБОР ГРУЗОВ (ДЛЯ ДЖОБЫ И HTTP) ----------

  async collectCargo({ maxPages = 2 } = {}) {
    let browser;
    try {
      browser = await this.createBrowser();
      const page = await browser.newPage();
      await this.preparePage(page);

      // Логин (без interception)
      await this.loginAvtodispetcher(page);

      // После логина – экономим на ресурсах, но оставляем CSS
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const t = req.resourceType();
        if (t === "image" || t === "font" || t === "media") req.abort();
        else req.continue();
      });

      const sessionCookies = await page.cookies();

      let currentPage = 1;
      const cargoList = [];
      let retryCount = 0;
      const maxRetries = 3;

      while (true) {
        try {
          const url =
            currentPage === 1
              ? "https://www.avtodispetcher.ru/consignor/"
              : `https://www.avtodispetcher.ru/consignor/page-${currentPage}`;
          console.log(`Парсинг грузов, страница ${currentPage}: ${url}`);

          await this.safeGoto(page, url);

          // Капча?
          const captchaElement = await page.$(".g-recaptcha");
          if (captchaElement) {
            console.log("Обнаружена капча, пробуем переавторизоваться...");
            await this.loginAvtodispetcher(page);
            retryCount++;
            if (retryCount >= maxRetries) {
              throw new Error("Превышено количество попыток из-за капчи");
            }
            continue;
          }

          // Проверим авторизацию
          const loginForm = await page.$('input[name="email"]');
          if (loginForm) {
            console.log("Потеряна авторизация, повторный логин...");
            await this.loginAvtodispetcher(page);
            retryCount++;
            if (retryCount >= maxRetries) {
              throw new Error("Превышено количество попыток переавторизации");
            }
            continue;
          }

          const tableHandle = await page.$("table");
          if (!tableHandle) {
            console.log(
              `Нет таблицы на странице ${currentPage}, завершаем парсинг грузов.`
            );
            break;
          }

          const rows = await page.$$("table tr");
          console.log(`Страница ${currentPage}: найдено строк ${rows.length}`);
          if (rows.length <= 1) {
            console.log("Таблица пуста или содержит только заголовок");
            break;
          }

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = await row.$$("td");
            if (cells.length < 6) continue;

            const from = (
              await (await cells[0].getProperty("innerText")).jsonValue()
            ).trim();

            const toRaw = (
              await (await cells[1].getProperty("innerText")).jsonValue()
            ).trim();
            const to = toRaw.replace(/\s*\d+\s*км$/, "").trim();

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
            const volumeMatch = cargoText.match(/([\д.,]+)\s*(м3|м³)/i);
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
              await this.preparePage(detailPage);
              // На детальной странице не режем картинки (нужен .phoneImg)
              try {
                await detailPage.setCookie(...sessionCookies);
                await this.safeGoto(detailPage, detailLink, {
                  timeout: 120000,
                });
                await new Promise((r) => setTimeout(r, 1000));

                const phoneImg = await detailPage.$(".phoneImg");
                if (phoneImg) {
                  const box = await phoneImg.boundingBox();
                  if (box && box.width > 20) {
                    try {
                      telefon = await this.readPhoneFromImg(phoneImg);
                    } catch (screenshotError) {
                      console.log("Ошибка OCR:", screenshotError.message);
                    }
                  } else {
                    console.log("Телефонное изображение не загрузилось/пустое");
                  }
                } else {
                  console.log("Элемент .phoneImg не найден");
                }

                if (!telefon) {
                  console.log(`Номер не найден: ${detailLink}`);
                }
              } catch (detailError) {
                console.log(
                  "Ошибка при парсинге детальной страницы:",
                  detailError?.message || detailError
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
        } catch (pageError) {
          console.error(
            `Ошибка при парсинге страницы ${currentPage}:`,
            pageError
          );
          retryCount++;
          if (retryCount >= maxRetries) {
            throw new Error(
              `Не удалось обработать страницу ${currentPage} после ${maxRetries} попыток`
            );
          }
          continue;
        }

        currentPage++;
        if (currentPage > maxPages) {
          console.log(
            `Достигнут лимит ${maxPages} страниц, завершаем парсинг грузов.`
          );
          break;
        }
      }

      return { success: true, totalFound: cargoList.length, data: cargoList };
    } finally {
      // Закрываем браузер в любом случае
      try {
        if (browser) await browser.close();
      } catch {}
    }
  }

  // ---------- ЧИСТАЯ ЛОГИКА: СБОР МАШИН ----------

  async collectVehicles({ maxPages = 47 } = {}) {
    let browser;
    try {
      browser = await this.createBrowser();
      const page = await browser.newPage();
      await this.preparePage(page);

      // Логин (без interception)
      await this.loginAvtodispetcher(page);

      // После логина ограничим часть ресурсов (оставим CSS)
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const t = req.resourceType();
        if (t === "image" || t === "font" || t === "media") req.abort();
        else req.continue();
      });

      const sessionCookies = await page.cookies();
      const detailLinksSet = new Set();
      let currentPage = 1;

      console.log("Начинаем парсинг машин с Avtodispetcher...");

      while (true) {
        const url =
          currentPage === 1
            ? "https://www.avtodispetcher.ru/truck/"
            : `https://www.avtodispetcher.ru/truck/page-${currentPage}`;
        console.log(`Парсинг машин, страница ${currentPage}: ${url}`);

        try {
          await this.safeGoto(page, url, { timeout: 90000 });
        } catch (navigationError) {
          console.error(
            `Ошибка навигации на странице ${currentPage}:`,
            navigationError.message
          );
          try {
            console.log(`Повторная попытка для страницы ${currentPage}...`);
            await this.safeGoto(page, url, { timeout: 120000 });
          } catch (retryError) {
            console.error(
              `Повторная попытка не удалась для страницы ${currentPage}:`,
              retryError.message
            );
            currentPage++;
            if (currentPage > maxPages) {
              console.log(`Достигнут лимит ${maxPages} страниц.`);
              break;
            }
            continue;
          }
        }

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
                new URL(
                  el.getAttribute("href"),
                  "https://www.avtodispetcher.ru"
                ).href
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

      const results = [];
      const chunkSize = 5;

      const parseOneVehicle = async (link, globalIndex) => {
        const pageDetail = await browser.newPage();
        await this.preparePage(pageDetail);
        try {
          console.log(
            `[${globalIndex + 1}/${detailLinks.length}] Обработка: ${link}`
          );
          await pageDetail.setCookie(...sessionCookies);
          await this.safeGoto(pageDetail, link, { timeout: 60000 });

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
              try {
                telefon = await this.readPhoneFromImg(phoneImg);
              } catch (err) {
                console.log("Ошибка при распознавании номера:", err.message);
              }
            }
          }

          telefon = this.normalizePhone(telefon);

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
            company: detailData["Название компании"] || "",
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

      console.log(`Парсинг завершён. Найдено ${results.length} машин.`);
      return { success: true, totalFound: results.length, data: results };
    } finally {
      try {
        if (browser) await browser.close();
      } catch {}
    }
  }

  // ---------- HTTP-ОБЁРТКИ ДЛЯ EXPRESS ----------

  async parseAvtodispetcher(req, res) {
    try {
      const result = await this.collectCargo({ maxPages: 2 });
      if (res?.json) return res.json(result);
      return result;
    } catch (error) {
      console.error("Ошибка при парсинге грузов:", error);
      const payload = {
        success: false,
        error: "Ошибка при парсинге грузов",
        details: error.message,
      };
      if (res?.status) return res.status(500).json(payload);
      throw error;
    }
  }

  async parseVehiclesFromAvtodispetcher(req, res) {
    try {
      const result = await this.collectVehicles({ maxPages: 47 });
      if (res?.json) return res.json(result);
      return result;
    } catch (error) {
      console.error("Ошибка при парсинге машин:", error);
      const payload = {
        success: false,
        error: "Ошибка при парсинге машин",
        details: error.message,
      };
      if (res?.status) return res.status(500).json(payload);
      throw error;
    }
  }
}

const parseController = new ParseController();

// Экспортируем и чистые функции (для фоновых джоб), и HTTP-обёртки
export default {
  // ЧИСТЫЕ (не используют res)
  collectCargo: (...args) => parseController.collectCargo(...args),
  collectVehicles: (...args) => parseController.collectVehicles(...args),

  // HTTP-роуты
  parseAvtodispetcher:
    parseController.parseAvtodispetcher.bind(parseController),
  parseVehiclesFromAvtodispetcher:
    parseController.parseVehiclesFromAvtodispetcher.bind(parseController),
};
