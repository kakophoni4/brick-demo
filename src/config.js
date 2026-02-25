'use strict';

const path = require('path');
const fs = require('fs');

// Папки с фото: ищем в brick-demo и в родителе brick-demo
const rootDemo = path.join(__dirname, '..');       // brick-demo
const rootParent = path.join(__dirname, '..', '..');
function resolveDir(name) {
  const inDemo = path.join(rootDemo, name);
  const inParent = path.join(rootParent, name);
  if (fs.existsSync(inDemo)) return inDemo;
  if (fs.existsSync(inParent)) return inParent;
  return inParent;
}
const OBJECTS_PATH = resolveDir('обьекты абк');
const DEALER_PATH = resolveDir('акбарс керамик для дилеров');
const OBJECTS_WEB = path.join(path.dirname(OBJECTS_PATH), 'обьекты абк web');
const DEALER_WEB = path.join(path.dirname(DEALER_PATH), 'акбарс керамик для дилеров web');

// Только сжатые папки web (без fallback на исходные)
function objectsDir() {
  return OBJECTS_WEB;
}
function dealerDir() {
  return DEALER_WEB;
}

// Расширения изображений (в папках web — только .webp)
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

module.exports = {
  OBJECTS_PATH,
  DEALER_PATH,
  OBJECTS_WEB,
  DEALER_WEB,
  objectsDir,
  dealerDir,
  IMAGE_EXT
};
