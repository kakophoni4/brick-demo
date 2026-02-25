'use strict';

/**
 * Сжатие всех фотографий для веба:
 * - Ограничение по длинной стороне (по умолчанию 1920px)
 * - Конвертация в WebP с качеством 90 (визуально без потерь)
 * - Результат в папках «обьекты абк web» и «акбарс керамик для дилеров web»
 *
 * Запуск: node scripts/compress-images.js
 * Переменные: MAX_SIDE=1600 QUALITY=85 node scripts/compress-images.js
 */

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

// Корень: brick-demo (папки обьекты абк и акбарс керамик лежат здесь или в родителе)
const rootCandidate = path.join(__dirname, '..'); // brick-demo
const rootParent = path.join(__dirname, '..', '..'); // родитель brick-demo
function chooseRoot(name) {
  const inDemo = path.join(rootCandidate, name);
  const inParent = path.join(rootParent, name);
  if (fs.existsSync(inDemo)) return path.join(rootCandidate, name);
  if (fs.existsSync(inParent)) return path.join(rootParent, name);
  return inParent; // по умолчанию ищем в родителе
}
const OBJECTS_PATH = chooseRoot('обьекты абк');
const DEALER_PATH = chooseRoot('акбарс керамик для дилеров');
const OBJECTS_WEB = path.join(path.dirname(OBJECTS_PATH), 'обьекты абк web');
const DEALER_WEB = path.join(path.dirname(DEALER_PATH), 'акбарс керамик для дилеров web');

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const MAX_SIDE = parseInt(process.env.MAX_SIDE || '1920', 10);
const QUALITY = parseInt(process.env.QUALITY || '90', 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '4', 10);

function getAllImages(dir, baseDir, list) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.isDirectory()) {
      getAllImages(full, baseDir, list);
    } else if (e.isFile() && IMAGE_EXT.includes(path.extname(e.name).toLowerCase())) {
      list.push({ full, rel });
    }
  }
  return list;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function processImage(inputPath, outputPath) {
  const outPath = outputPath.replace(/\.[a-z]+$/i, '.webp');
  const outDir = path.dirname(outPath);
  ensureDir(outDir);

  const pipeline = sharp(inputPath);
  const meta = await pipeline.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;

  if (w > MAX_SIDE || h > MAX_SIDE) {
    pipeline.resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true });
  }

  await pipeline
    .webp({ quality: QUALITY, effort: 6 })
    .toFile(outPath);

  const inStat = fs.statSync(inputPath);
  const outStat = fs.statSync(outPath);
  return { input: inStat.size, output: outStat.size, path: outPath };
}

function runQueue(tasks, concurrency) {
  return new Promise((resolve, reject) => {
    let index = 0;
    let active = 0;
    const results = [];
    function next() {
      while (active < concurrency && index < tasks.length) {
        const task = tasks[index++];
        active++;
        task()
          .then((r) => { results.push(r); active--; next(); })
          .catch((e) => { active--; reject(e); });
      }
      if (active === 0 && index >= tasks.length) resolve(results);
    }
    next();
  });
}

async function run() {
  console.log('Настройки: длинная сторона макс.', MAX_SIDE, 'px, качество WebP', QUALITY);
  console.log('Исходные папки:', OBJECTS_PATH, '\n', DEALER_PATH);
  console.log('Папки для веба:', OBJECTS_WEB, '\n', DEALER_WEB);
  console.log('');

  const objectsImages = fs.existsSync(OBJECTS_PATH) ? getAllImages(OBJECTS_PATH, OBJECTS_PATH, []) : [];
  const dealerImages = fs.existsSync(DEALER_PATH) ? getAllImages(DEALER_PATH, DEALER_PATH, []) : [];

  const all = [
    ...objectsImages.map(({ full, rel }) => ({ full, rel, outBase: OBJECTS_WEB })),
    ...dealerImages.map(({ full, rel }) => ({ full, rel, outBase: DEALER_WEB }))
  ];

  console.log('Найдено изображений:', all.length, '(объекты:', objectsImages.length, ', каталог:', dealerImages.length, ')');
  if (all.length === 0) {
    console.log('Нечего обрабатывать. Проверьте пути к папкам.');
    process.exit(0);
    return;
  }

  let totalIn = 0;
  let totalOut = 0;
  let done = 0;

  const tasks = all.map(({ full, rel, outBase }) => () => {
    const outPath = path.join(outBase, rel);
    return processImage(full, outPath).then((r) => {
      totalIn += r.input;
      totalOut += r.output;
      done++;
      if (done % 50 === 0 || done === all.length) {
        console.log('Обработано', done, '/', all.length);
      }
      return r;
    }).catch((err) => {
      done++;
      console.error('Ошибка:', full, err.message);
      return null;
    });
  });

  const start = Date.now();
  await runQueue(tasks, CONCURRENCY);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log('');
  console.log('Готово за', elapsed, 'с');
  console.log('Было (байт):', (totalIn / 1024 / 1024 / 1024).toFixed(2), 'ГБ');
  console.log('Стало (байт):', (totalOut / 1024 / 1024 / 1024).toFixed(2), 'ГБ');
  console.log('Сжатие:', totalIn ? ((1 - totalOut / totalIn) * 100).toFixed(1) : 0, '%');
  console.log('');
  console.log('Папки «обьекты абк web» и «акбарс керамик для дилеров web» готовы.');
  console.log('Дальше: в админке нажмите «Импорт из папки» для галереи и каталога (или удалите');
  console.log('  src/data/gallery.json и src/data/catalog.json и перезапустите сервер).');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
