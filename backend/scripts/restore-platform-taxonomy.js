const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const env = require("../src/config/env");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");

async function restoreTaxonomy() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB:", env.MONGODB_URI);

  const categoriesData = [
    {
      name: "Mobiles",
      slug: "mobiles",
      description: "Latest 5G smartphones, flagship devices and mobile accessories",
      image: {
        url: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80",
        altText: "Mobiles",
      },
      sortOrder: 1,
      isActive: true,
    },
    {
      name: "Laptops",
      slug: "laptops",
      description: "Thin & light ultrabooks, creator workstations and gaming powerhouses",
      image: {
        url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80",
        altText: "Laptops",
      },
      sortOrder: 2,
      isActive: true,
    },
    {
      name: "Audio",
      slug: "audio",
      description: "Studio monitors, noise-canceling headphones & wireless earbuds",
      image: {
        url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
        altText: "Audio",
      },
      sortOrder: 3,
      isActive: true,
    },
    {
      name: "TV & Home Appliances",
      slug: "tv-appliances",
      description: "Smart 4K OLED TVs, air fryers and connected living appliances",
      image: {
        url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?auto=format&fit=crop&w=600&q=80",
        altText: "TV & Home Appliances",
      },
      sortOrder: 4,
      isActive: true,
    },
    {
      name: "Accessories",
      slug: "accessories",
      description: "Smartwatches, ergonomic mice, GaN chargers and desk setups",
      image: {
        url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
        altText: "Accessories",
      },
      sortOrder: 5,
      isActive: true,
    },
    {
      name: "Smart Home",
      slug: "smart-home",
      description: "Smart speakers, voice assistants and automated illumination",
      image: {
        url: "https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=600&q=80",
        altText: "Smart Home",
      },
      sortOrder: 6,
      isActive: true,
    },
    {
      name: "Gaming",
      slug: "gaming",
      description: "Esports peripherals, gaming mechanical keyboards and displays",
      image: {
        url: "https://images.unsplash.com/photo-1612287233207-6f81c96a41f6?auto=format&fit=crop&w=600&q=80",
        altText: "Gaming",
      },
      sortOrder: 7,
      isActive: true,
    },
    {
      name: "Fashion",
      slug: "fashion",
      description: "Minimalist EDC gear, tech backpacks and lifestyle accessories",
      image: {
        url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80",
        altText: "Fashion",
      },
      sortOrder: 8,
      isActive: true,
    },
  ];

  for (const c of categoriesData) {
    const res = await Category.findOneAndUpdate(
      { slug: c.slug },
      { $set: c },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("Category upserted:", res.name, `(${res._id})`);
  }

  const brandsData = [
    {
      name: "Samsung",
      slug: "samsung",
      description: "Cutting-edge Galaxy smartphones and AMOLED displays",
      website: "https://samsung.com",
      logo: {
        url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=200&q=80",
        altText: "Samsung",
      },
      sortOrder: 1,
      isActive: true,
    },
    {
      name: "Apple",
      slug: "apple",
      description: "Innovative iPhones, MacBooks and accessories",
      website: "https://apple.com",
      logo: {
        url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=200&q=80",
        altText: "Apple",
      },
      sortOrder: 2,
      isActive: true,
    },
    {
      name: "Sony",
      slug: "sony",
      description: "World-class audio equipment and gaming systems",
      website: "https://sony.com",
      logo: {
        url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80",
        altText: "Sony",
      },
      sortOrder: 3,
      isActive: true,
    },
    {
      name: "AuraVue",
      slug: "auravue",
      description: "Premium lifestyle and electronics brand",
      website: "https://auravue.com",
      logo: {
        url: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=200&q=80",
        altText: "AuraVue",
      },
      sortOrder: 4,
      isActive: true,
    },
    {
      name: "Nike",
      slug: "nike",
      description: "Performance athletic footwear and apparel",
      website: "https://nike.com",
      logo: {
        url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80",
        altText: "Nike",
      },
      sortOrder: 5,
      isActive: true,
    },
    {
      name: "Lenovo",
      slug: "lenovo",
      description: "High-productivity ThinkPads and Legion systems",
      website: "https://lenovo.com",
      logo: {
        url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=200&q=80",
        altText: "Lenovo",
      },
      sortOrder: 6,
      isActive: true,
    },
  ];

  for (const b of brandsData) {
    const res = await Brand.findOneAndUpdate(
      { slug: b.slug },
      { $set: b },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log("Brand upserted:", res.name, `(${res._id})`);
  }

  console.log("Taxonomy successfully restored in MongoDB!");
  await mongoose.disconnect();
}

restoreTaxonomy().catch((err) => {
  console.error("Error restoring taxonomy:", err);
  process.exit(1);
});
