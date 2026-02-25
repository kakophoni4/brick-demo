'use strict';

const path = require('path');
const fs = require('fs');

// Корни для поиска: текущая рабочая папка (деплой Railway и т.п.) и папка проекта (brick-demo)
const cwd = process.cwd();
const projectRoot = path.resolve(__dirname, '..');

function findDir(dirName) {
  const candidates = [
    path.join(cwd, dirName),
    path.join(projectRoot, dirName),
    path.join(projectRoot, '..', dirName)
  ];
  for (const p of candidates) {
    const abs = path.resolve(p);
    if (fs.existsSync(abs)) return abs;
  }
  return path.resolve(projectRoot, dirName);
}

// Папки со сжатыми фото (.webp) — ищем по имени, всегда отдаём абсолютный путь
const OBJECTS_WEB = findDir('обьекты абк web');
const DEALER_WEB = findDir('акбарс керамик для дилеров web');

function objectsDir() {
  return path.resolve(OBJECTS_WEB);
}
function dealerDir() {
  return path.resolve(DEALER_WEB);
}

// Расширения изображений (в папках web — только .webp)
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

module.exports = {
  OBJECTS_WEB,
  DEALER_WEB,
  objectsDir,
  dealerDir,
  IMAGE_EXT
};
