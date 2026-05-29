/**
 * Amazon Price Tracker - Mock Database
 * Contiene i dati iniziali di prodotti popolari con storici di prezzo realistici.
 * Progettato per essere caricato direttamente nel browser.
 */

const INITIAL_PRODUCTS = [
  {
    id: "prod-1",
    asin: "B0CHX19FF5",
    title: "Apple iPhone 15 Pro (128 GB) - Titanio Naturale",
    url: "https://www.amazon.it/dp/B0CHX19FF5",
    imageUrl: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=400&q=80",
    category: "Elettronica",
    currentPrice: 1099.00,
    originalPrice: 1239.00,
    targetPrice: 999.00,
    rating: 4.7,
    reviewsCount: 1420,
    volatility: "Media", // Bassa, Media, Alta
    alertEnabled: true,
    history: [
      { date: "2026-03-31", price: 1239.00 },
      { date: "2026-04-05", price: 1239.00 },
      { date: "2026-04-10", price: 1219.00 },
      { date: "2026-04-15", price: 1199.00 },
      { date: "2026-04-20", price: 1199.00 },
      { date: "2026-04-25", price: 1149.00 },
      { date: "2026-04-30", price: 1189.00 },
      { date: "2026-05-05", price: 1149.00 },
      { date: "2026-05-10", price: 1129.00 },
      { date: "2026-05-15", price: 1129.00 },
      { date: "2026-05-20", price: 1099.00 },
      { date: "2026-05-25", price: 1099.00 },
      { date: "2026-05-29", price: 1099.00 }
    ]
  },
  {
    id: "prod-2",
    asin: "B09Y2MY1V2",
    title: "Sony WH-1000XM5 Cuffie Wireless con Noise Cancelling - Nero",
    url: "https://www.amazon.it/dp/B09Y2MY1V2",
    imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=400&q=80",
    category: "Audio",
    currentPrice: 319.00,
    originalPrice: 399.00,
    targetPrice: 299.00,
    rating: 4.6,
    reviewsCount: 3850,
    volatility: "Alta",
    alertEnabled: true,
    history: [
      { date: "2026-03-31", price: 399.00 },
      { date: "2026-04-05", price: 379.00 },
      { date: "2026-04-10", price: 389.00 },
      { date: "2026-04-15", price: 349.00 },
      { date: "2026-04-20", price: 349.00 },
      { date: "2026-04-25", price: 369.00 },
      { date: "2026-04-30", price: 329.00 },
      { date: "2026-05-05", price: 359.00 },
      { date: "2026-05-10", price: 319.00 },
      { date: "2026-05-15", price: 339.00 },
      { date: "2026-05-20", price: 329.00 },
      { date: "2026-05-25", price: 319.00 },
      { date: "2026-05-29", price: 319.00 }
    ]
  },
  {
    id: "prod-3",
    asin: "B0CLT5S4WM",
    title: "PlayStation®5 Standard Slim Edition Console",
    url: "https://www.amazon.it/dp/B0CLT5S4WM",
    imageUrl: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=400&q=80",
    category: "Gaming",
    currentPrice: 479.00,
    originalPrice: 549.00,
    targetPrice: 449.00,
    rating: 4.8,
    reviewsCount: 5120,
    volatility: "Bassa",
    alertEnabled: false,
    history: [
      { date: "2026-03-31", price: 549.00 },
      { date: "2026-04-05", price: 549.00 },
      { date: "2026-04-10", price: 549.00 },
      { date: "2026-04-15", price: 529.00 },
      { date: "2026-04-20", price: 529.00 },
      { date: "2026-04-25", price: 549.00 },
      { date: "2026-04-30", price: 499.00 },
      { date: "2026-05-05", price: 499.00 },
      { date: "2026-05-10", price: 499.00 },
      { date: "2026-05-15", price: 489.00 },
      { date: "2026-05-20", price: 479.00 },
      { date: "2026-05-25", price: 479.00 },
      { date: "2026-05-29", price: 479.00 }
    ]
  },
  {
    id: "prod-4",
    asin: "B09TMF1252",
    title: "Kindle Paperwhite (16 GB) - Schermo da 6,8” e tonalità della luce regolabile",
    url: "https://www.amazon.it/dp/B09TMF1252",
    imageUrl: "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=400&q=80",
    category: "Libri & E-Reader",
    currentPrice: 139.00,
    originalPrice: 169.00,
    targetPrice: 129.00,
    rating: 4.7,
    reviewsCount: 2280,
    volatility: "Alta",
    alertEnabled: true,
    history: [
      { date: "2026-03-31", price: 169.00 },
      { date: "2026-04-05", price: 169.00 },
      { date: "2026-04-10", price: 139.00 },
      { date: "2026-04-15", price: 169.00 },
      { date: "2026-04-20", price: 169.00 },
      { date: "2026-04-25", price: 169.00 },
      { date: "2026-04-30", price: 139.00 },
      { date: "2026-05-05", price: 139.00 },
      { date: "2026-05-10", price: 169.00 },
      { date: "2026-05-15", price: 159.00 },
      { date: "2026-05-20", price: 149.00 },
      { date: "2026-05-25", price: 139.00 },
      { date: "2026-05-29", price: 139.00 }
    ]
  },
  {
    id: "prod-5",
    asin: "B0CSS73F5S",
    title: "ASUS ROG Zephyrus G14 Gaming Laptop OLED - Ryzen 9, RTX 4060",
    url: "https://www.amazon.it/dp/B0CSS73F5S",
    imageUrl: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=400&q=80",
    category: "Computer",
    currentPrice: 1799.00,
    originalPrice: 1999.00,
    targetPrice: 1699.00,
    rating: 4.5,
    reviewsCount: 310,
    volatility: "Bassa",
    alertEnabled: true,
    history: [
      { date: "2026-03-31", price: 1999.00 },
      { date: "2026-04-05", price: 1999.00 },
      { date: "2026-04-10", price: 1959.00 },
      { date: "2026-04-15", price: 1959.00 },
      { date: "2026-04-20", price: 1899.00 },
      { date: "2026-04-25", price: 1899.00 },
      { date: "2026-04-30", price: 1899.00 },
      { date: "2026-05-05", price: 1849.00 },
      { date: "2026-05-10", price: 1849.00 },
      { date: "2026-05-15", price: 1799.00 },
      { date: "2026-05-20", price: 1799.00 },
      { date: "2026-05-25", price: 1799.00 },
      { date: "2026-05-29", price: 1799.00 }
    ]
  }
];

// Categorie predefinite supportate dal sistema
const CATEGORIES = ["Tutti", "Elettronica", "Audio", "Gaming", "Computer", "Libri & E-Reader", "Casa & Cucina", "Abbigliamento", "Altro"];
