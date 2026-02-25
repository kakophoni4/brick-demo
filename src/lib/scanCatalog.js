'use strict';

const fs = require('fs');
const path = require('path');
const { dealerDir, IMAGE_EXT } = require('../config');

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function collectImages(dir, baseDir, list) {
  if (!fs.existsSync(dir)) return list;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.isDirectory()) {
      collectImages(full, baseDir, list);
    } else if (e.isFile() && IMAGE_EXT.includes(path.extname(e.name).toLowerCase())) {
      list.push(rel.replace(/\\/g, '/'));
    }
  }
  return list;
}

const TYPICAL_DESCRIPTION = 'Облицовочный керамический кирпич. Подходит для фасадов, заборов и интерьерных решений. Уточняйте наличие, цену и доставку по телефону.';
const TYPICAL_SHORT = 'Керамический кирпич. Цена и наличие — уточняйте по телефону.';

function scanCatalog() {
  const result = [];
  const baseDir = dealerDir();
  if (!fs.existsSync(baseDir)) return result;

  const topDirs = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let id = 1;
  for (const folderName of topDirs) {
    const folderPath = path.join(baseDir, folderName);
    const images = collectImages(folderPath, baseDir, []).sort();
    if (images.length > 0) {
      const slug = slugify(folderName);
      result.push({
        id,
        slug,
        title: folderName,
        category: 'Кирпич облицовочный',
        image: images[0],
        gallery: images,
        short: TYPICAL_SHORT,
        description: TYPICAL_DESCRIPTION,
        specs: [
          ['Наименование', folderName],
          ['Цена', 'Уточняйте по телефону']
        ],
        color: '',
        format: '',
        tags: [],
        priceFrom: null,
        priceRub: null,
        unit: 'шт.',
        availability: 'В наличии',
        isFeatured: false,
        isBestseller: false
      });
      id++;
    }
  }
  return result;
}

module.exports = { scanCatalog };
