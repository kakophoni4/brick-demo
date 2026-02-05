'use strict';

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');

const site = require('./src/data/site');
const { catalog, categories, getProductBySlug } = require('./src/data/catalog');
const { gallery, galleryTags } = require('./src/data/gallery');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');


app.use(helmet({
  contentSecurityPolicy: false // чтобы не мешать локальным стилям/картам в демо
}));
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
}));

// маленький хелпер для активного пункта меню
app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.site = site;
  next();
});

// Главная
app.get('/', (req, res) => {
  const featured = catalog.filter(p => p.isFeatured).slice(0, 8);
  const bestsellers = catalog.filter(p => p.isBestseller).slice(0, 6);
  const galleryPreview = gallery.slice(0, 8);

  res.render('pages/home', {
    pageTitle: 'Кирпич и керамика в Ульяновске — демо',
    metaDescription: 'Каталог кирпича, керамических блоков, сопутствующих товаров. Доставка на объект. Подбор по проекту. Демо-версия.',
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
  const tag = (req.query.tag || '').trim();
  const items = tag ? gallery.filter(g => g.tags.includes(tag)) : gallery;

  res.render('pages/gallery', {
    pageTitle: 'Галерея объектов',
    metaDescription: 'Фото выполненных объектов: фасады, дома, заборы, декоративные элементы.',
    items,
    galleryTags,
    activeTag: tag
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

// Форма — обработчик демо (без отправки)
app.post('/api/lead', (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const message = String(req.body.message || '').trim();
  const source = String(req.body.source || '').trim();

  if (!name || !phone) {
    return res.status(400).json({ ok: false, message: 'Заполните имя и телефон.' });
  }

  // Здесь обычно: отправка в CRM/почту/телеграм. В демо просто возвращаем ok.
  return res.json({
    ok: true,
    message: 'Заявка принята (демо). Мы перезвоним в ближайшее время.',
    echo: { name, phone, message, source }
  });
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
