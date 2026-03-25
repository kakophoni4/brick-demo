'use strict';

const fs = require('fs');
const path = require('path');
const { scanGallery } = require('../lib/scanGallery');
const { scanCatalog } = require('../lib/scanCatalog');
const { objectsDir, dealerDir } = require('../config');

const DATA_DIR = path.join(__dirname);
const GALLERY_JSON = path.join(DATA_DIR, 'gallery.json');
const CATALOG_JSON = path.join(DATA_DIR, 'catalog.json');

const ASSETS_OBJECTS = '/assets/objects';
const ASSETS_CATALOG = '/assets/catalog';

function urlToRel(url, prefix) {
  if (!url || typeof url !== 'string') return '';
  const s = url.startsWith(prefix) ? url.slice(prefix.length + 1) : url;
  try {
    return decodeURIComponent(s).split('/').map(decodeURIComponent).join('/');
  } catch (_) {
    return s;
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadGallery() {
  let data = [];
  if (fs.existsSync(GALLERY_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(GALLERY_JSON, 'utf8'));
    } catch (_) {}
  }
  if (data.length === 0) {
    data = scanGallery();
    if (data.length > 0) {
      ensureDir(DATA_DIR);
      fs.writeFileSync(GALLERY_JSON, JSON.stringify(data, null, 2), 'utf8');
    }
  }
  return data.map(album => ({
    ...album,
    images: (album.images || [])
      .filter(rel => {
        const raw = String(rel).trim();
        if (!raw) return false;
        const base = path.join(objectsDir(), ...raw.split('/'));
        const asWebp = base.replace(/\.[a-z]+$/i, '.webp');
        return fs.existsSync(base) || fs.existsSync(asWebp);
      })
      .map(rel => {
        let r = String(rel).trim();
        if (!/\.webp$/i.test(r)) r = r.replace(/\.[a-z]+$/i, '.webp');
        return ASSETS_OBJECTS + '/' + r.split('/').map(encodeURIComponent).join('/');
      })
  }));
}

function saveGallery(gallery) {
  const toSave = gallery.map(album => ({
    id: album.id,
    title: album.title,
    images: (album.images || []).map(url => {
      const s = String(url);
      const p = s.startsWith(ASSETS_OBJECTS) ? s.slice(ASSETS_OBJECTS.length + 1) : s;
      try {
        return decodeURIComponent(p).split('/').map(decodeURIComponent).join('/');
      } catch (_) {
        return p;
      }
    })
  }));
  ensureDir(DATA_DIR);
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(toSave, null, 2), 'utf8');
}

function loadCatalog() {
  let data = [];
  if (fs.existsSync(CATALOG_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8'));
    } catch (_) {}
  }
  if (data.length === 0) {
    data = scanCatalog();
    if (data.length > 0) {
      ensureDir(DATA_DIR);
      fs.writeFileSync(CATALOG_JSON, JSON.stringify(data, null, 2), 'utf8');
    }
  }
  return data.map(p => {
    const category = p.category === 'Клинкер и ступени' ? 'Кирпич рядовой' : p.category;
    const allImages = (p.gallery || (p.image ? [p.image] : [])).filter(Boolean);
    const existing = allImages.filter(rel => {
      const raw = String(rel).trim();
      if (!raw || raw.startsWith('http')) return true;
      const relPath = raw.startsWith(ASSETS_CATALOG + '/') ? raw.slice(ASSETS_CATALOG.length + 1).split('/').map(decodeURIComponent).join('/') : raw;
      const base = path.join(dealerDir(), ...relPath.split('/'));
      const asWebp = base.replace(/\.[a-z]+$/i, '.webp');
      return fs.existsSync(base) || fs.existsSync(asWebp);
    });
    const toUrl = rel => {
      let r = String(rel).trim();
      if (r.startsWith('http')) return r;
      if (r.startsWith(ASSETS_CATALOG + '/')) r = r.slice(ASSETS_CATALOG.length + 1).split('/').map(decodeURIComponent).join('/');
      if (!/\.webp$/i.test(r)) r = r.replace(/\.[a-z]+$/i, '.webp');
      return ASSETS_CATALOG + '/' + r.split('/').map(encodeURIComponent).join('/');
    };
    const image = existing[0] ? toUrl(existing[0]) : (p.image && p.image.startsWith('http') ? p.image : '');
    const gallery = existing.map(toUrl);
    return {
      ...p,
      category,
      image: image || (p.image && p.image.startsWith('http') ? p.image : ''),
      gallery
    };
  });
}

function saveCatalog(catalog) {
  const toSave = catalog.map(p => {
    const strip = url => {
      if (!url || url.startsWith('http')) return url;
      const rest = String(url).replace(ASSETS_CATALOG + '/', '');
      try {
        return rest.split('/').map(s => decodeURIComponent(s)).join('/');
      } catch (_) {
        return rest;
      }
    };
    return {
      ...p,
      image: strip(p.image),
      gallery: (p.gallery || []).map(strip)
    };
  });
  ensureDir(DATA_DIR);
  fs.writeFileSync(CATALOG_JSON, JSON.stringify(toSave, null, 2), 'utf8');
}

function importGalleryFromScan() {
  const data = scanGallery();
  ensureDir(DATA_DIR);
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(data, null, 2), 'utf8');
  return loadGallery();
}

function loadGalleryRaw() {
  let data = [];
  if (fs.existsSync(GALLERY_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(GALLERY_JSON, 'utf8'));
    } catch (_) {}
  }
  return data;
}

function addGalleryImages(albumId, newRelativePaths) {
  const data = loadGalleryRaw();
  const album = data.find(a => a.id === parseInt(albumId, 10));
  if (!album) return false;
  album.images = album.images || [];
  album.images.push(...newRelativePaths);
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function removeGalleryImage(albumId, imageUrl) {
  const rel = urlToRel(imageUrl, ASSETS_OBJECTS);
  const data = loadGalleryRaw();
  const album = data.find(a => a.id === parseInt(albumId, 10));
  if (!album) return false;
  album.images = (album.images || []).filter(p => {
    const r = typeof p === 'string' && p.startsWith('/') ? urlToRel(p, ASSETS_OBJECTS) : p;
    return r !== rel;
  });
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function removeGalleryImages(albumId, imageUrls) {
  const toRemove = new Set((imageUrls || []).map(url => urlToRel(url, ASSETS_OBJECTS)));
  if (toRemove.size === 0) return false;
  const data = loadGalleryRaw();
  const album = data.find(a => a.id === parseInt(albumId, 10));
  if (!album) return false;
  album.images = (album.images || []).filter(p => {
    const r = typeof p === 'string' && p.startsWith('/') ? urlToRel(p, ASSETS_OBJECTS) : p;
    return !toRemove.has(r);
  });
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function updateGalleryAlbum(albumId, payload) {
  const data = loadGalleryRaw();
  const album = data.find(a => a.id === parseInt(albumId, 10));
  if (!album) return false;
  if (payload.title != null) album.title = String(payload.title).trim() || album.title;
  if (Array.isArray(payload.images)) album.images = payload.images;
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function galleryFolderNameFromTitle(title) {
  return String(title || '').replace(/[/\\]/g, '-').trim() || 'album';
}

function unlinkObjectImage(rel) {
  const raw = String(rel || '').trim();
  if (!raw) return;
  const fp = path.join(objectsDir(), ...raw.split('/'));
  if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) {}
}

/** Новый альбом: пустой, папка под заголовок в objects */
function addGalleryAlbum(title) {
  const data = loadGalleryRaw();
  const maxId = data.reduce((m, a) => Math.max(m, typeof a.id === 'number' ? a.id : 0), 0);
  const id = maxId + 1;
  const t = String(title || '').trim() || 'Новый объект';
  const folderName = galleryFolderNameFromTitle(t);
  const dir = path.join(objectsDir(), folderName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  data.push({ id, title: t, images: [] });
  ensureDir(DATA_DIR);
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(data, null, 2), 'utf8');
  return id;
}

/** Удалить альбом из JSON и файлы фото; пустые папки снимаем */
function deleteGalleryAlbum(albumId) {
  const data = loadGalleryRaw();
  const idx = data.findIndex(a => a.id === parseInt(albumId, 10));
  if (idx < 0) return false;
  const album = data[idx];
  const imgs = album.images || [];
  const dirs = new Set();
  imgs.forEach(rel => {
    unlinkObjectImage(rel);
    const parts = String(rel || '').trim().split('/').filter(Boolean);
    if (parts.length > 1) dirs.add(path.join(objectsDir(), ...parts.slice(0, -1)));
  });
  data.splice(idx, 1);
  ensureDir(DATA_DIR);
  fs.writeFileSync(GALLERY_JSON, JSON.stringify(data, null, 2), 'utf8');
  dirs.forEach(d => {
    try {
      if (fs.existsSync(d) && fs.readdirSync(d).length === 0) fs.rmdirSync(d);
    } catch (_) {}
  });
  const fallbackDir = path.join(objectsDir(), galleryFolderNameFromTitle(album.title));
  try {
    if (fs.existsSync(fallbackDir) && fs.readdirSync(fallbackDir).length === 0) fs.rmdirSync(fallbackDir);
  } catch (_) {}
  return true;
}

function loadCatalogRaw() {
  let data = [];
  if (fs.existsSync(CATALOG_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf8'));
    } catch (_) {}
  }
  return data;
}

function getCatalogProductFolder(productId) {
  const data = loadCatalogRaw();
  const p = data.find(x => x.id === parseInt(productId, 10));
  if (!p) return null;
  if (p.catalogFolder && String(p.catalogFolder).trim()) {
    return String(p.catalogFolder).trim().replace(/[/\\]/g, '-');
  }
  const img = p.image || (p.gallery && p.gallery[0]);
  if (!img) return null;
  const rel = typeof img === 'string' && img.startsWith('/') ? urlToRel(img, ASSETS_CATALOG) : img;
  return rel.split('/')[0] || null;
}

function addCatalogImages(productId, newRelativePaths) {
  const data = loadCatalogRaw();
  const p = data.find(x => x.id === parseInt(productId, 10));
  if (!p) return false;
  p.gallery = p.gallery || [];
  p.gallery.push(...newRelativePaths);
  if (!p.image) p.image = p.gallery[0];
  fs.writeFileSync(CATALOG_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function removeCatalogImage(productId, imageUrl) {
  const rel = urlToRel(imageUrl, ASSETS_CATALOG);
  const data = loadCatalogRaw();
  const p = data.find(x => x.id === parseInt(productId, 10));
  if (!p) return false;
  p.gallery = (p.gallery || []).filter(img => {
    const r = typeof img === 'string' && img.startsWith('/') ? urlToRel(img, ASSETS_CATALOG) : img;
    return r !== rel;
  });
  p.image = p.gallery[0] || p.image;
  fs.writeFileSync(CATALOG_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function removeCatalogImages(productId, imageUrls) {
  const toRemove = new Set((imageUrls || []).map(url => urlToRel(url, ASSETS_CATALOG)));
  if (toRemove.size === 0) return false;
  const data = loadCatalogRaw();
  const p = data.find(x => x.id === parseInt(productId, 10));
  if (!p) return false;
  p.gallery = (p.gallery || []).filter(img => {
    const r = typeof img === 'string' && img.startsWith('/') ? urlToRel(img, ASSETS_CATALOG) : img;
    return !toRemove.has(r);
  });
  p.image = p.gallery[0] || p.image;
  fs.writeFileSync(CATALOG_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function updateCatalogProduct(productId, payload) {
  const data = loadCatalogRaw();
  const p = data.find(x => x.id === parseInt(productId, 10));
  if (!p) return false;
  if (payload.title != null) p.title = String(payload.title).trim() || p.title;
  if (payload.category != null) p.category = String(payload.category).trim() || p.category;
  if (payload.short != null) p.short = String(payload.short).trim();
  if (payload.priceFrom !== undefined) p.priceFrom = payload.priceFrom;
  if (payload.image != null) p.image = payload.image;
  if (Array.isArray(payload.gallery)) {
    p.gallery = payload.gallery;
    if (!p.image && p.gallery[0]) p.image = p.gallery[0];
  }
  fs.writeFileSync(CATALOG_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function slugifyCatalogTitle(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'tovar';
}

function deleteCatalogProduct(productId) {
  const data = loadCatalogRaw();
  const idx = data.findIndex(x => x.id === parseInt(productId, 10));
  if (idx < 0) return false;
  const p = data[idx];
  const dealer = dealerDir();
  const rels = new Set();
  (p.gallery || []).forEach(g => {
    if (g) rels.add(typeof g === 'string' && g.startsWith('/') ? urlToRel(g, ASSETS_CATALOG) : String(g));
  });
  if (p.image) rels.add(typeof p.image === 'string' && p.image.startsWith('/') ? urlToRel(p.image, ASSETS_CATALOG) : String(p.image));
  rels.forEach(rel => {
    if (!rel || rel.startsWith('http')) return;
    const fp = path.join(dealer, ...rel.split('/'));
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (_) {}
  });
  data.splice(idx, 1);
  ensureDir(DATA_DIR);
  fs.writeFileSync(CATALOG_JSON, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function addCatalogProduct(payload) {
  const data = loadCatalogRaw();
  const maxId = data.reduce((m, x) => Math.max(m, typeof x.id === 'number' ? x.id : 0), 0);
  const id = maxId + 1;
  const title = String(payload.title || 'Новый товар').trim() || 'Новый товар';
  const category = String(payload.category || 'Кирпич облицовочный').trim();
  const short = String(payload.short || '').trim();
  const priceFrom = payload.priceFrom === '' || payload.priceFrom == null ? null : (isNaN(Number(payload.priceFrom)) ? null : Number(payload.priceFrom));
  const slug = slugifyCatalogTitle(title) + '-' + id;
  const catalogFolder = slugifyCatalogTitle(title).slice(0, 48).replace(/-+$/g, '') + '-' + id;
  const baseDir = dealerDir();
  const dir = path.join(baseDir, catalogFolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const p = {
    id,
    slug,
    title,
    category,
    image: '',
    gallery: [],
    short,
    description: String(payload.description || '').trim() || short,
    specs: [['Наименование', title], ['Цена', 'Уточняйте по телефону']],
    color: '',
    format: '',
    tags: [],
    priceFrom,
    priceRub: null,
    unit: 'шт.',
    availability: 'В наличии',
    isFeatured: false,
    isBestseller: false,
    catalogFolder
  };
  data.push(p);
  ensureDir(DATA_DIR);
  fs.writeFileSync(CATALOG_JSON, JSON.stringify(data, null, 2), 'utf8');
  return p;
}

function importCatalogFromScan() {
  const data = scanCatalog();
  ensureDir(DATA_DIR);
  fs.writeFileSync(CATALOG_JSON, JSON.stringify(data, null, 2), 'utf8');
  return loadCatalog();
}

module.exports = {
  loadGallery,
  saveGallery,
  loadCatalog,
  saveCatalog,
  importGalleryFromScan,
  importCatalogFromScan,
  loadGalleryRaw,
  addGalleryImages,
  removeGalleryImage,
  removeGalleryImages,
  updateGalleryAlbum,
  loadCatalogRaw,
  getCatalogProductFolder,
  addCatalogImages,
  removeCatalogImage,
  removeCatalogImages,
  updateCatalogProduct,
  addCatalogProduct,
  deleteCatalogProduct,
  addGalleryAlbum,
  deleteGalleryAlbum,
  GALLERY_JSON,
  CATALOG_JSON,
  ASSETS_OBJECTS,
  ASSETS_CATALOG
};
