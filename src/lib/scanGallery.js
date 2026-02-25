'use strict';

const fs = require('fs');
const path = require('path');
const { objectsDir, IMAGE_EXT } = require('../config');

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

function scanGallery() {
  const result = [];
  const baseDir = objectsDir();
  if (!fs.existsSync(baseDir)) return result;

  const topDirs = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  let id = 1;
  for (const folderName of topDirs) {
    const folderPath = path.join(baseDir, folderName);
    const images = collectImages(folderPath, baseDir, []);
    if (images.length > 0) {
      result.push({
        id,
        title: folderName,
        images: images.sort()
      });
      id++;
    }
  }
  return result;
}

module.exports = { scanGallery };
