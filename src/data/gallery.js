'use strict';

// Фото положи в public/assets/gallery/...
const galleryTags = ['Фасады', 'Дома', 'Заборы', 'Крыльцо/ступени', 'Интерьер', 'Коммерция'];

const gallery = [
  {
    id: 1,
    title: 'Фасад: баварская кладка + графитовый шов',
    image: '/public/assets/gallery/g-1.jpg',
    tags: ['Фасады', 'Дома']
  },
  {
    id: 2,
    title: 'Дом в светлом кирпиче (айвори) с тёмной кровлей',
    image: '/public/assets/gallery/g-2.jpg',
    tags: ['Дома', 'Фасады']
  },
  {
    id: 3,
    title: 'Забор: комбинированная кладка, колпаки',
    image: '/public/assets/gallery/g-3.jpg',
    tags: ['Заборы']
  },
  {
    id: 4,
    title: 'Крыльцо: клинкерные ступени, антискольжение',
    image: '/public/assets/gallery/g-4.jpg',
    tags: ['Крыльцо/ступени']
  },
  {
    id: 5,
    title: 'Фрагмент фасада: рельефный кирпич, аккуратная расшивка',
    image: '/public/assets/gallery/g-5.jpg',
    tags: ['Фасады']
  },
  {
    id: 6,
    title: 'Интерьер: акцентная стена из кирпича',
    image: '/public/assets/gallery/g-6.jpg',
    tags: ['Интерьер']
  }
];

// добиваем для демо “пачкой”
let id = 100;
for (let i = 0; i < 30; i++) {
  const tag = galleryTags[i % galleryTags.length];
  gallery.push({
    id: id++,
    title: `Объект #${i + 1}: пример кладки (${tag})`,
    image: `/public/assets/gallery/auto-g-${(i % 12) + 1}.jpg`,
    tags: [tag]
  });
}

module.exports = { gallery, galleryTags };
