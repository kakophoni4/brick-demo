'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');
const multer = require('multer');
const sharp = require('sharp');

const site = require('./src/data/site');
const { loadLeads, addLead } = require('./src/data/leads');
const {
  loadGallery, loadCatalog, saveGallery, saveCatalog,
  importGalleryFromScan, importCatalogFromScan,
  addGalleryImages, removeGalleryImage, removeGalleryImages, updateGalleryAlbum,
  getCatalogProductFolder, addCatalogImages, removeCatalogImage, removeCatalogImages, updateCatalogProduct
} = require('./src/data/loadData');
const { categories: defaultCategories, getProductBySlug: getProductBySlugFromCatalog } = require('./src/data/catalog');
const { objectsDir, dealerDir } = require('./src/config');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const MAX_IMAGE_SIDE = 1920;
const WEBP_QUALITY = 90;

let gallery = [];
let catalog = [];

function refreshData() {
  gallery = loadGallery();
  catalog = loadCatalog();
}

refreshData();

function getProductBySlug(slug) {
  return catalog.find(p => p.slug === slug);
}

const categories = defaultCategories;

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');


app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'brick-admin-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  name: 'brick.sid',
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
}));

const objectsPath = objectsDir();
const dealerPath = dealerDir();
[objectsPath, dealerPath].forEach(p => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

function staticWithWebpFallback(rootDir) {
  return (req, res, next) => {
    const subPath = decodeURIComponent(req.path).replace(/^\//, '').replace(/\//g, path.sep);
    const filePath = path.join(rootDir, subPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return next();
    const webpPath = filePath.replace(/\.[a-z]+$/i, '.webp');
    if (fs.existsSync(webpPath) && fs.statSync(webpPath).isFile()) {
      res.setHeader('Content-Type', 'image/webp');
      return res.sendFile(webpPath, { maxAge: '7d' }, err => err && next());
    }
    next();
  };
}
app.use('/assets/objects', staticWithWebpFallback(objectsPath));
app.use('/assets/objects', express.static(objectsPath, { maxAge: '7d' }));
app.use('/assets/catalog', staticWithWebpFallback(dealerPath));
app.use('/assets/catalog', express.static(dealerPath, { maxAge: '7d' }));

// хелперы для шаблонов
function formatPhone(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 10) return '+7(' + d.slice(0, 3) + ')' + d.slice(3, 6) + '-' + d.slice(6, 8) + '-' + d.slice(8);
  return digits || '';
}
function capFirst(s) {
  if (!s || typeof s !== 'string') return s || '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.site = site;
  res.locals.formatPhone = formatPhone;
  res.locals.capFirst = capFirst;
  res.locals.metaDescription = res.locals.metaDescription || '';
  res.locals.pageTitle = res.locals.pageTitle || '';
  next();
});

// Главная
app.get('/', (req, res) => {
  const featured = catalog.filter(p => p.isFeatured).slice(0, 8);
  const bestsellers = catalog.filter(p => p.isBestseller).slice(0, 6);
  const galleryPreview = gallery.slice(0, 8);

  res.render('pages/home', {
    pageTitle: 'Кирпич и керамика в Ульяновске',
    metaDescription: 'Каталог кирпича, керамических блоков, сопутствующих товаров. Доставка на объект. Подбор по проекту.',
    featured,
    bestsellers,
    categories: categories.slice(0, 6),
    galleryPreview
  });
});

// О нас
app.get('/about', (req, res) => {
  res.render('pages/about', {
    pageTitle: 'О нас',
    metaDescription: 'О компании: поставки кирпича и керамики, консультации, расчет, логистика.'
  });
});

// Каталог + фильтры через query
app.get('/catalog', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const cat = (req.query.cat || '').trim();
  const color = (req.query.color || '').trim();
  const format = (req.query.format || '').trim();
  const price = (req.query.price || '').trim();

  let items = [...catalog];

  if (cat) items = items.filter(p => p.category === cat);
  if (color) items = items.filter(p => (p.color || '').includes(color));
  if (format) items = items.filter(p => p.format === format);
  if (q) items = items.filter(p =>
    (p.title + ' ' + (p.short || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q)
  );

  if (price === 'low') items.sort((a, b) => (a.priceRub || 0) - (b.priceRub || 0));
  if (price === 'high') items.sort((a, b) => (b.priceRub || 0) - (a.priceRub || 0));

  res.render('pages/catalog', {
    pageTitle: 'Каталог',
    metaDescription: 'Каталог кирпича, блоков, растворов и аксессуаров. Фильтры, поиск, карточки товаров.',
    items,
    categories,
    filters: { q: req.query.q || '', cat, color, format, price }
  });
});

// Карточка товара
app.get('/catalog/:slug', (req, res) => {
  const product = getProductBySlug(req.params.slug);
  if (!product) {
    return res.status(404).render('pages/notfound', {
      pageTitle: 'Товар не найден',
      metaDescription: 'Страница не найдена'
    });
  }

  // похожие: та же категория
  const related = catalog
    .filter(p => p.category === product.category && p.slug !== product.slug)
    .slice(0, 8);

  res.render('pages/product', {
    pageTitle: product.title,
    metaDescription: product.short || 'Карточка товара',
    product,
    related
  });
});

// Галерея
app.get('/gallery', (req, res) => {
  res.render('pages/gallery', {
    pageTitle: 'Галерея объектов',
    metaDescription: 'Фото выполненных объектов.',
    items: gallery
  });
});

// Доставка
app.get('/delivery', (req, res) => {
  res.render('pages/delivery', {
    pageTitle: 'Условия доставки',
    metaDescription: 'Доставка на объект, самовывоз, разгрузка, сроки, документы.'
  });
});

// Контакты
app.get('/contacts', (req, res) => {
  res.render('pages/contacts', {
    pageTitle: 'Контакты',
    metaDescription: 'Телефоны, адреса офисов, форма обратной связи.'
  });
});

// Политика конфиденциальности
app.get('/privacy', (req, res) => {
  res.render('pages/privacy', {
    pageTitle: 'Политика конфиденциальности',
    metaDescription: 'Политика конфиденциальности и использования cookie.'
  });
});

// Заявки с сайта — сохраняем и отдаём в админку
app.post('/api/lead', (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const message = String(req.body.message || '').trim();
  const source = String(req.body.source || '').trim();

  if (!name || !phone) {
    return res.status(400).json({ ok: false, message: 'Заполните имя и телефон.' });
  }

  addLead({ name, phone, message, source, fromCrm: false });
  return res.json({
    ok: true,
    message: 'Заявка принята. Мы перезвоним в ближайшее время.'
  });
});

// Webhook для приёма заявок из CRM (опционально: CRM_WEBHOOK_TOKEN в env)
app.post('/api/lead/webhook', (req, res) => {
  const token = req.headers['x-crm-token'] || req.query.token || (req.body && req.body.token);
  const secret = process.env.CRM_WEBHOOK_TOKEN;
  if (secret && token !== secret) {
    return res.status(403).json({ ok: false, message: 'Неверный токен' });
  }
  const name = String((req.body && req.body.name) || '').trim();
  const phone = String((req.body && req.body.phone) || '').trim();
  const message = String((req.body && req.body.message) || '').trim();
  const source = String((req.body && req.body.source) || 'CRM').trim();
  if (!name || !phone) {
    return res.status(400).json({ ok: false, message: 'Нужны name и phone' });
  }
  addLead({ name, phone, message, source, fromCrm: true });
  return res.json({ ok: true, message: 'Заявка из CRM сохранена' });
});

// ——— Админ-панель (логин/пароль из env или admin/qwe) ———
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'qwe';

function adminAuth(req, res, next) {
  if (!req.path.startsWith('/admin')) return next();
  if (req.session.adminAuth) return next();
  if (req.path === '/admin/login') return next();
  return res.redirect('/admin/login');
}

app.use(adminAuth);

app.get('/admin/login', (req, res) => {
  if (req.session.adminAuth) return res.redirect('/admin');
  res.render('pages/adminLogin', {
    layout: 'layouts/main',
    pageTitle: 'Вход в админку',
    metaDescription: '',
    error: req.query.error != null
  });
});

app.post('/admin/login', (req, res) => {
  const login = (req.body && req.body.admin_login) || '';
  const pass = (req.body && req.body.admin_password) || '';
  if (login === ADMIN_LOGIN && pass === ADMIN_PASSWORD) {
    req.session.adminAuth = true;
    return res.redirect('/admin');
  }
  return res.redirect('/admin/login?error=1');
});

app.get('/admin', (req, res) => {
  if (!req.session.adminAuth) return res.redirect('/admin/login');
  res.render('pages/adminIndex', {
    layout: 'layouts/admin',
    pageTitle: 'Админ-панель',
    currentPath: '/admin'
  });
});

app.get('/admin/gallery', (req, res) => {
  if (!req.session.adminAuth) return res.redirect('/admin/login');
  res.render('pages/adminGallery', {
    layout: 'layouts/admin',
    pageTitle: 'Галерея — админка',
    items: gallery,
    currentPath: '/admin/gallery',
    err: req.query.err === 'import'
  });
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

app.post('/admin/api/gallery/import', (req, res) => {
  try {
    importGalleryFromScan();
    refreshData();
  } catch (e) {
    return res.redirect('/admin/gallery?err=import');
  }
  res.redirect('/admin/gallery');
});

app.post('/admin/api/gallery/save', (req, res) => {
  const body = req.body;
  const list = Array.isArray(body.items) ? body.items : (body.items ? JSON.parse(body.items) : []);
  const toSave = list.map((item, i) => ({
    id: typeof item.id !== 'undefined' ? item.id : i + 1,
    title: String(item.title || '').trim() || 'Без названия',
    images: Array.isArray(item.images) ? item.images.map(u => {
      const s = String(u);
      return s.startsWith('/assets/objects/') ? s.slice('/assets/objects/'.length).split('/').map(decodeURIComponent).join('/') : s;
    }) : []
  })).filter(a => a.title);
  saveGallery(toSave.map(a => ({ ...a, images: a.images })));
  refreshData();
  res.redirect('/admin/gallery');
});

app.post('/admin/api/gallery/album/:id/save', (req, res) => {
  const albumId = req.params.id;
  const title = String(req.body.title || '').trim() || 'Без названия';
  let images = req.body.images;
  if (typeof images === 'string') try { images = JSON.parse(images); } catch (_) { images = []; }
  images = Array.isArray(images) ? images.map(u => {
    const s = String(u);
    return s.startsWith('/assets/objects/') ? s.slice('/assets/objects/'.length).split('/').map(decodeURIComponent).join('/') : s;
  }) : [];
  updateGalleryAlbum(albumId, { title, images });
  refreshData();
  res.redirect('/admin/gallery');
});

app.post('/admin/api/gallery/album/:id/upload', upload.array('photos', 20), async (req, res) => {
  const albumId = req.params.id;
  const album = gallery.find(a => a.id === parseInt(albumId, 10));
  if (!album || !req.files || req.files.length === 0) return res.redirect('/admin/gallery');
  const baseDir = objectsDir();
  const folderName = album.title.replace(/[/\\]/g, '-');
  const dir = path.join(baseDir, folderName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const newRels = [];
  for (let i = 0; i < req.files.length; i++) {
    const f = req.files[i];
    const ext = (path.extname(f.originalname) || '').toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) continue;
    const outName = (Date.now() + '-' + i + '.webp').replace(/\s/g, '');
    const outPath = path.join(dir, outName);
    await sharp(f.buffer)
      .resize(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outPath);
    newRels.push(folderName + '/' + outName);
  }
  if (newRels.length) {
    addGalleryImages(albumId, newRels);
    refreshData();
  }
  res.redirect('/admin/gallery');
});

app.post('/admin/api/gallery/album/:id/delete-image', (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.redirect('/admin/gallery');
  const rel = imageUrl.replace(/^\/assets\/objects\//, '').split('/').map(decodeURIComponent).join(path.sep);
  const filePath = path.join(objectsDir(), rel);
  if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
  removeGalleryImage(req.params.id, imageUrl);
  refreshData();
  res.redirect('/admin/gallery');
});

app.post('/admin/api/gallery/album/:id/delete-images', (req, res) => {
  let urls = req.body.imageUrls;
  if (typeof urls === 'string') try { urls = JSON.parse(urls); } catch (_) { urls = []; }
  if (!Array.isArray(urls) || urls.length === 0) return res.redirect('/admin/gallery');
  const albumId = req.params.id;
  urls.forEach(url => {
    const rel = String(url).replace(/^\/assets\/objects\//, '').split('/').map(decodeURIComponent).join(path.sep);
    const filePath = path.join(objectsDir(), rel);
    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
  });
  removeGalleryImages(albumId, urls);
  refreshData();
  res.redirect('/admin/gallery');
});

app.get('/admin/leads', (req, res) => {
  if (!req.session.adminAuth) return res.redirect('/admin/login');
  const leads = loadLeads();
  res.render('pages/adminLeads', {
    layout: 'layouts/admin',
    pageTitle: 'Заявки — админка',
    leads,
    currentPath: '/admin/leads'
  });
});

app.get('/admin/catalog', (req, res) => {
  if (!req.session.adminAuth) return res.redirect('/admin/login');
  res.render('pages/adminCatalog', {
    layout: 'layouts/admin',
    pageTitle: 'Каталог — админка',
    items: catalog,
    categories,
    currentPath: '/admin/catalog',
    err: req.query.err === 'import'
  });
});

app.post('/admin/api/catalog/import', (req, res) => {
  try {
    importCatalogFromScan();
    refreshData();
  } catch (e) {
    return res.redirect('/admin/catalog?err=import');
  }
  res.redirect('/admin/catalog');
});

app.post('/admin/api/catalog/product/:id/save', (req, res) => {
  const productId = req.params.id;
  const body = req.body;
  const title = String(body.title || '').trim() || 'Товар';
  const category = String(body.category || 'Кирпич облицовочный').trim();
  const short = String(body.short || '').trim();
  const priceFrom = body.priceFrom === '' || body.priceFrom == null ? null : (isNaN(Number(body.priceFrom)) ? null : Number(body.priceFrom));
  let gallery = body.gallery;
  if (typeof gallery === 'string') try { gallery = JSON.parse(gallery); } catch (_) { gallery = []; }
  gallery = Array.isArray(gallery) ? gallery.map(u => (u || '').toString().replace(/^\/assets\/catalog\//, '').split('/').map(decodeURIComponent).join('/')) : [];
  const image = gallery[0] || '';
  updateCatalogProduct(productId, { title, category, short, priceFrom, image, gallery });
  refreshData();
  res.redirect('/admin/catalog');
});

app.post('/admin/api/catalog/product/:id/upload', upload.array('photos', 20), async (req, res) => {
  const productId = req.params.id;
  const folderName = getCatalogProductFolder(productId);
  if (!folderName || !req.files || req.files.length === 0) return res.redirect('/admin/catalog');
  const baseDir = dealerDir();
  const dir = path.join(baseDir, folderName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const newRels = [];
  for (let i = 0; i < req.files.length; i++) {
    const f = req.files[i];
    const ext = (path.extname(f.originalname) || '').toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) continue;
    const outName = (Date.now() + '-' + i + '.webp').replace(/\s/g, '');
    const outPath = path.join(dir, outName);
    await sharp(f.buffer)
      .resize(MAX_IMAGE_SIDE, MAX_IMAGE_SIDE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outPath);
    newRels.push(folderName + '/' + outName);
  }
  if (newRels.length) {
    addCatalogImages(productId, newRels);
    refreshData();
  }
  res.redirect('/admin/catalog');
});

app.post('/admin/api/catalog/product/:id/delete-image', (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.redirect('/admin/catalog');
  const rel = imageUrl.replace(/^\/assets\/catalog\//, '').split('/').map(decodeURIComponent).join(path.sep);
  const filePath = path.join(dealerDir(), rel);
  if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
  removeCatalogImage(req.params.id, imageUrl);
  refreshData();
  res.redirect('/admin/catalog');
});

app.post('/admin/api/catalog/product/:id/delete-images', (req, res) => {
  let urls = req.body.imageUrls;
  if (typeof urls === 'string') try { urls = JSON.parse(urls); } catch (_) { urls = []; }
  if (!Array.isArray(urls) || urls.length === 0) return res.redirect('/admin/catalog');
  const productId = req.params.id;
  urls.forEach(url => {
    const rel = String(url).replace(/^\/assets\/catalog\//, '').split('/').map(decodeURIComponent).join(path.sep);
    const filePath = path.join(dealerDir(), rel);
    if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
  });
  removeCatalogImages(productId, urls);
  refreshData();
  res.redirect('/admin/catalog');
});

app.post('/admin/api/catalog/save', (req, res) => {
  const body = req.body;
  let list = [];
  try {
    list = typeof body.items === 'string' ? JSON.parse(body.items) : (body.items || []);
  } catch (_) {}
  const toSave = (Array.isArray(list) ? list : []).map((p, i) => {
    const id = p.id != null ? p.id : i + 1;
    const title = String(p.title || '').trim() || 'Товар';
    const slug = (p.slug || title).toLowerCase().replace(/ё/g, 'е').replace(/[^a-z0-9а-я\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-') || 'item-' + id;
    const image = (p.image || '').toString().replace(/^\/assets\/catalog\//, '').split('/').map(decodeURIComponent).join('/');
    const gallery = (p.gallery || []).map(u => (u || '').toString().replace(/^\/assets\/catalog\//, '').split('/').map(decodeURIComponent).join('/'));
    return {
      id,
      slug,
      title,
      category: String(p.category || 'Кирпич облицовочный').trim(),
      image: image || (gallery[0] || ''),
      gallery: gallery.length ? gallery : [image],
      short: String(p.short || '').trim(),
      description: String(p.description || '').trim(),
      specs: Array.isArray(p.specs) ? p.specs : [['Наименование', title], ['Цена', 'Уточняйте по телефону']],
      color: String(p.color || '').trim(),
      format: String(p.format || '').trim(),
      tags: Array.isArray(p.tags) ? p.tags : [],
      priceFrom: p.priceFrom != null ? (isNaN(p.priceFrom) ? null : Number(p.priceFrom)) : null,
      priceRub: p.priceRub != null ? (isNaN(p.priceRub) ? null : Number(p.priceRub)) : null,
      unit: String(p.unit || 'шт.').trim(),
      availability: String(p.availability || 'В наличии').trim(),
      isFeatured: !!p.isFeatured,
      isBestseller: !!p.isBestseller
    };
  });
  saveCatalog(toSave);
  refreshData();
  res.redirect('/admin/catalog');
});

// 404
app.use((req, res) => {
  res.status(404).render('pages/notfound', {
    pageTitle: 'Страница не найдена',
    metaDescription: 'Страница не найдена'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server started: http://localhost:${PORT}`);
});
