require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");

const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Vendor = require("../src/models/Vendor");
const Warehouse = require("../src/models/Warehouse");
const User = require("../src/models/User");
const Product = require("../src/models/Product");
const ProductVariant = require("../src/models/ProductVariant");
const Inventory = require("../src/models/Inventory");
const StorefrontBanner = require("../src/models/StorefrontBanner");
const StorefrontSection = require("../src/models/StorefrontSection");
const StorefrontAnnouncementBar = require("../src/models/StorefrontAnnouncementBar");

async function seedStorefrontCatalog() {
  console.log("Connecting to MongoDB at:", env.MONGODB_URI);
  await mongoose.connect(env.MONGODB_URI);

  try {
    // 1. Resolve Admin & Vendor & Warehouse
    const admin = await User.findOne({ role: { $in: ["admin", "super_admin"] } });
    if (!admin) {
      throw new Error("Admin user not found in database. Please ensure admin exists.");
    }

    let vendor = await Vendor.findOne({ status: "approved" });
    if (!vendor) {
      vendor = await Vendor.findOne();
    }
    if (!vendor) {
      throw new Error("No vendor found in database. Please run initial vendor setup.");
    }

    let warehouse = await Warehouse.findOne({ isActive: true });
    if (!warehouse) {
      warehouse = await Warehouse.findOne();
    }
    if (!warehouse) {
      throw new Error("No warehouse found in database.");
    }

    console.log(`Using Admin: ${admin.email}, Vendor: ${vendor.businessName} (${vendor._id}), Warehouse: ${warehouse.name} (${warehouse._id})`);

    // 2. Categories (Mockup categories + existing tech categories)
    const categoriesData = [
      {
        name: "Mobiles",
        slug: "mobiles",
        description: "Latest 5G smartphones, flagship devices and mobile accessories",
        image: {
          url: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=600&q=80",
          altText: "Mobiles category",
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
          altText: "Laptops category",
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
          altText: "Audio category",
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
          altText: "TV & Home Appliances category",
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
          altText: "Accessories category",
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
          altText: "Smart Home category",
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
          altText: "Gaming category",
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
          altText: "Fashion category",
        },
        sortOrder: 8,
        isActive: true,
      },
      // Existing categories preserved
      {
        name: "Audio & Headphones",
        slug: "audio-headphones",
        description: "Studio monitors, audiophile headphones & high-fidelity wireless audio",
        image: {
          url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
          altText: "Audio & Headphones category",
        },
        sortOrder: 9,
        isActive: true,
      },
      {
        name: "Mechanical Keyboards",
        slug: "keyboards-peripherals",
        description: "Custom mechanical switches, wireless keyboards & hot-swappable boards",
        image: {
          url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80",
          altText: "Mechanical Keyboards category",
        },
        sortOrder: 10,
        isActive: true,
      },
      {
        name: "Displays & Monitors",
        slug: "displays-monitors",
        description: "Color-accurate 4K monitors, ultra-wides & desk illumination bars",
        image: {
          url: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=600&q=80",
          altText: "Displays & Monitors category",
        },
        sortOrder: 11,
        isActive: true,
      },
      {
        name: "Minimalist Gear & EDC",
        slug: "minimalist-gear-edc",
        description: "Precision titanium tools, leather desk pads & everyday essentials",
        image: {
          url: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80",
          altText: "Minimalist Gear & EDC category",
        },
        sortOrder: 12,
        isActive: true,
      },
      {
        name: "Gaming Hardware",
        slug: "gaming-hardware",
        description: "Ultra-lightweight wireless mice, high-polling peripherals & headsets",
        image: {
          url: "https://images.unsplash.com/photo-1612287233207-6f81c96a41f6?auto=format&fit=crop&w=600&q=80",
          altText: "Gaming Hardware category",
        },
        sortOrder: 13,
        isActive: true,
      },
      {
        name: "Smart Home & Power",
        slug: "smart-home-power",
        description: "GaN fast chargers, magnetic wireless docks & smart power solutions",
        image: {
          url: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80",
          altText: "Smart Home & Power category",
        },
        sortOrder: 14,
        isActive: true,
      },
    ];

    const categoryMap = {};
    for (const cat of categoriesData) {
      const saved = await Category.findOneAndUpdate(
        { slug: cat.slug },
        { $set: cat },
        { upsert: true, new: true, runValidators: true }
      );
      categoryMap[cat.slug] = saved;
      console.log(`Upserted category: ${saved.name} (${saved._id})`);
    }

    // 3. Brands (Mockup brands + existing brands)
    const brandsData = [
      {
        name: "Samsung",
        slug: "samsung",
        description: "Cutting-edge Galaxy smartphones, tablets, AMOLED displays and appliances",
        website: "https://samsung.com",
        sortOrder: 1,
        isActive: true,
      },
      {
        name: "Apple",
        slug: "apple",
        description: "Innovative MacBooks, iPhones, iPads and wearable accessories",
        website: "https://apple.com",
        sortOrder: 2,
        isActive: true,
      },
      {
        name: "Lenovo",
        slug: "lenovo",
        description: "High-productivity ThinkPads, Legion gaming systems and monitors",
        website: "https://lenovo.com",
        sortOrder: 3,
        isActive: true,
      },
      {
        name: "HP",
        slug: "hp",
        description: "Reliable laptops, Pavilion workhorses and high-resolution displays",
        website: "https://hp.com",
        sortOrder: 4,
        isActive: true,
      },
      {
        name: "ASUS",
        slug: "asus",
        description: "High-performance ROG and TUF gaming hardware and ZenBook laptops",
        website: "https://asus.com",
        sortOrder: 5,
        isActive: true,
      },
      {
        name: "boAt",
        slug: "boat",
        description: "Leading consumer lifestyle audio and wearable audio gear",
        website: "https://boat-lifestyle.com",
        sortOrder: 6,
        isActive: true,
      },
      {
        name: "Realme",
        slug: "realme",
        description: "Trendsetting 5G smartphones and smart AIoT peripherals",
        website: "https://realme.com",
        sortOrder: 7,
        isActive: true,
      },
      {
        name: "Intel",
        slug: "intel",
        description: "World-class compute processors and performance hardware",
        website: "https://intel.com",
        sortOrder: 8,
        isActive: true,
      },
      {
        name: "Sony",
        slug: "sony",
        description: "Industry-leading noise cancellation, gaming displays and imaging hardware",
        website: "https://sony.com",
        sortOrder: 9,
        isActive: true,
      },
      {
        name: "Logitech",
        slug: "logitech",
        description: "Ergonomic productivity masters and esports-grade wireless peripherals",
        website: "https://logitech.com",
        sortOrder: 10,
        isActive: true,
      },
      {
        name: "Dell",
        slug: "dell",
        description: "Premium enterprise notebooks and XPS productivity displays",
        website: "https://dell.com",
        sortOrder: 11,
        isActive: true,
      },
      {
        name: "Fire-Boltt",
        slug: "fire-boltt",
        description: "Advanced smart wearables with Bluetooth calling and fitness tracking",
        website: "https://fireboltt.com",
        sortOrder: 12,
        isActive: true,
      },
      {
        name: "Nothing",
        slug: "nothing",
        description: "Iconic transparent aesthetics and clean Android operating systems",
        website: "https://nothing.tech",
        sortOrder: 13,
        isActive: true,
      },
      {
        name: "Zebronics",
        slug: "zebronics",
        description: "Dynamic Dolby soundbars, home theatre and consumer audio systems",
        website: "https://zebronics.com",
        sortOrder: 14,
        isActive: true,
      },
      {
        name: "Buybox Genuine",
        slug: "buybox-genuine",
        description: "Official Buybox precision-engineered peripherals and desk accessories",
        website: "https://buybox.internal",
        sortOrder: 15,
        isActive: true,
      },
    ];

    const brandMap = {};
    for (const b of brandsData) {
      const saved = await Brand.findOneAndUpdate(
        { slug: b.slug },
        { $set: b },
        { upsert: true, new: true, runValidators: true }
      );
      brandMap[b.slug] = saved;
      console.log(`Upserted brand: ${saved.name} (${saved._id})`);
    }

    // 4. Products Catalog (Matching the exact items from the user's mockup!)
    const productsData = [
      // 1. Featured Card 1: boAt Airdopes 141
      {
        name: "boAt Airdopes 141",
        slug: "boat-airdopes-141",
        sku: "BOAT-AD141-BLK",
        categorySlug: "audio",
        brandSlug: "boat",
        price: "1299.00",
        compareAtPrice: "4490.00",
        isFeatured: true,
        ratingAverage: 4.1,
        ratingCount: 1211,
        shortDescription: "True Wireless Earbuds with 42H Playtime, Beast Mode, ENx Tech, ASAP Charge.",
        description: "Enjoy an immersive musical journey with boAt Airdopes 141. Equipped with 8mm dynamic drivers, 42 hours playback, and ASAP Fast Charge technology giving 75 minutes of playtime in just 5 minutes of charge.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
            altText: "boAt Airdopes 141 Wireless Earbuds",
            sortOrder: 0,
          },
        ],
        tags: ["earbuds", "boat", "wireless", "audio", "deals"],
      },
      // 2. Featured Card 2: Samsung Galaxy M14 5G
      {
        name: "Samsung Galaxy M14 5G",
        slug: "samsung-galaxy-m14-5g",
        sku: "SAM-M14-5G-BLU",
        categorySlug: "mobiles",
        brandSlug: "samsung",
        price: "12999.00",
        compareAtPrice: "17999.00",
        isFeatured: true,
        ratingAverage: 4.2,
        ratingCount: 854,
        shortDescription: "50MP Triple Camera, 6000mAh Battery, 5nm Octa-Core Processor, Full HD+ 90Hz Display.",
        description: "The Samsung Galaxy M14 5G brings monster entertainment with an expansive 6.6-inch FHD+ 90Hz display and a massive 6000mAh battery that powers you through days of uninterrupted work and gaming.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80",
            altText: "Samsung Galaxy M14 5G Smartphone",
            sortOrder: 0,
          },
        ],
        tags: ["smartphone", "samsung", "5g", "mobiles"],
      },
      // 3. Featured Card 3: HP Laptop 15s
      {
        name: "HP Laptop 15s",
        slug: "hp-laptop-15s",
        sku: "HP-15S-SLV",
        categorySlug: "laptops",
        brandSlug: "hp",
        price: "38999.00",
        compareAtPrice: "47999.00",
        isFeatured: true,
        ratingAverage: 4.3,
        ratingCount: 2100,
        shortDescription: "12th Gen Intel Core i3, 8GB DDR4 RAM, 512GB NVMe SSD, 15.6-inch FHD Micro-Edge Display.",
        description: "Stay connected to what matters most with long-lasting battery life and a thin, portable, micro-edge bezel design. Built to keep you productive and entertained from anywhere.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80",
            altText: "HP Laptop 15s Silver",
            sortOrder: 0,
          },
        ],
        tags: ["laptop", "hp", "intel", "workstation"],
      },
      // 4. Featured Card 4: Fire-Boltt Phoenix Smartwatch
      {
        name: "Fire-Boltt Phoenix Smartwatch",
        slug: "fire-boltt-phoenix-smartwatch",
        sku: "FB-PHOENIX-BLK",
        categorySlug: "accessories",
        brandSlug: "fire-boltt",
        price: "1499.00",
        compareAtPrice: "8999.00",
        isFeatured: true,
        ratingAverage: 4.1,
        ratingCount: 1800,
        shortDescription: "Bluetooth Calling, 1.3-inch High Res Display, 120+ Sports Modes, SpO2 & Heart Rate Monitoring.",
        description: "The Fire-Boltt Phoenix empowers your active lifestyle. Make and receive phone calls directly from your wrist with clear built-in microphone and speaker, wrapped in a sleek metallic casing.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80",
            altText: "Fire-Boltt Phoenix Smartwatch",
            sortOrder: 0,
          },
        ],
        tags: ["smartwatch", "fitness", "wearables", "accessories"],
      },
      // 5. Featured Card 5: ASUS TUF Gaming F15
      {
        name: "ASUS TUF Gaming F15",
        slug: "asus-tuf-gaming-f15",
        sku: "ASUS-TUF-F15",
        categorySlug: "gaming",
        brandSlug: "asus",
        price: "50999.00",
        compareAtPrice: "70999.00",
        isFeatured: true,
        ratingAverage: 4.5,
        ratingCount: 3500,
        shortDescription: "Intel Core i5-11400H, 15.6-inch 144Hz FHD, 4GB NVIDIA GeForce RTX 3050, 16GB RAM, 512GB SSD.",
        description: "Geared for serious gaming and real-world durability, the TUF Gaming F15 is a fully-loaded gaming laptop that can carry you to victory with high-refresh display and efficient cooling.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80",
            altText: "ASUS TUF Gaming F15 Laptop",
            sortOrder: 0,
          },
        ],
        tags: ["gaming", "asus", "rtx", "laptops"],
      },

      // 6. New Arrival 1: Nothing Phone (2a)
      {
        name: "Nothing Phone (2a)",
        slug: "nothing-phone-2a",
        sku: "NOTH-2A-WHT",
        categorySlug: "mobiles",
        brandSlug: "nothing",
        price: "27999.00",
        compareAtPrice: "31999.00",
        isFeatured: false,
        ratingAverage: 4.4,
        ratingCount: 712,
        shortDescription: "Dimensity 7200 Pro, Glyph Interface, 50MP OIS Dual Cameras, 120Hz Flexible AMOLED.",
        description: "Powerfully unique. Nothing Phone (2a) delivers extraordinary performance with custom MediaTek Dimensity 7200 Pro processor, iconic Glyph lights, and clean Nothing OS 2.5.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80",
            altText: "Nothing Phone (2a)",
            sortOrder: 0,
          },
        ],
        tags: ["mobiles", "nothing", "5g", "new-arrivals"],
      },
      // 7. New Arrival 2: Realme Narzo 60
      {
        name: "Realme Narzo 60",
        slug: "realme-narzo-60",
        sku: "RLM-NARZO60-ORG",
        categorySlug: "mobiles",
        brandSlug: "realme",
        price: "15999.00",
        compareAtPrice: "19999.00",
        isFeatured: false,
        ratingAverage: 4.2,
        ratingCount: 510,
        shortDescription: "90Hz Super AMOLED Display, Ultra-Slim Vegan Leather Design, 64MP Street Photography Camera.",
        description: "Unleash bold design with luxury Mars Orange vegan leather texture, ultra-fast 33W SUPERVOOC charging, and a vivid 90Hz Super AMOLED display.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=800&q=80",
            altText: "Realme Narzo 60 Smartphone",
            sortOrder: 0,
          },
        ],
        tags: ["mobiles", "realme", "amoled", "new-arrivals"],
      },
      // 8. New Arrival 3: Sony WH-CH520
      {
        name: "Sony WH-CH520",
        slug: "sony-wh-ch520",
        sku: "SONY-CH520-BLU",
        categorySlug: "audio",
        brandSlug: "sony",
        price: "3499.00",
        compareAtPrice: "4990.00",
        isFeatured: false,
        ratingAverage: 4.3,
        ratingCount: 1140,
        shortDescription: "Wireless Bluetooth On-Ear Headphones with Mic, 50 Hours Battery Life, DSEE Upscaling.",
        description: "Enjoy high sound quality all day long. The Sony WH-CH520 headphones with up to 50 hours of battery life, stable multi-point connectivity, and enhanced call performance.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80",
            altText: "Sony WH-CH520 On-Ear Headphones",
            sortOrder: 0,
          },
        ],
        tags: ["headphones", "sony", "wireless", "audio", "new-arrivals"],
      },
      // 9. New Arrival 4: Logitech MX Master 3S
      {
        name: "Logitech MX Master 3S",
        slug: "logitech-mx-master-3s-mouse",
        sku: "LOGI-MXM3S-GRY",
        categorySlug: "accessories",
        brandSlug: "logitech",
        price: "8999.00",
        compareAtPrice: "10995.00",
        isFeatured: false,
        ratingAverage: 4.8,
        ratingCount: 342,
        shortDescription: "Performance Wireless Mouse with Quiet Clicks, 8K DPI Sensor, MagSpeed Scrolling.",
        description: "An icon remastered. Feel every single moment of your workflow with even more precision, tactility, and performance, thanks to Quiet Clicks and an 8,000 DPI track-on-glass sensor.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80",
            altText: "Logitech MX Master 3S Mouse",
            sortOrder: 0,
          },
        ],
        tags: ["mouse", "logitech", "ergonomic", "productivity", "accessories"],
      },
      // 10. New Arrival 5: Dell Inspiron 15
      {
        name: "Dell Inspiron 15",
        slug: "dell-inspiron-15",
        sku: "DELL-INSP15-SLV",
        categorySlug: "laptops",
        brandSlug: "dell",
        price: "46999.00",
        compareAtPrice: "58990.00",
        isFeatured: false,
        ratingAverage: 4.3,
        ratingCount: 714,
        shortDescription: "Intel Core i5 12th Gen, 16GB RAM, 512GB SSD, 15.6-inch 120Hz Anti-Glare Display.",
        description: "Stylishly engineered with an ergonomic lift hinge for typing comfort, expansive screen-to-body borders, and powerful 12th Gen Intel performance.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80",
            altText: "Dell Inspiron 15 Laptop",
            sortOrder: 0,
          },
        ],
        tags: ["laptops", "dell", "intel", "workstation"],
      },

      // 11. Best Seller 1: Samsung Galaxy A54
      {
        name: "Samsung Galaxy A54",
        slug: "samsung-galaxy-a54",
        sku: "SAM-A54-BLK",
        categorySlug: "mobiles",
        brandSlug: "samsung",
        price: "10299.00",
        compareAtPrice: "14999.00",
        isFeatured: false,
        ratingAverage: 4.3,
        ratingCount: 1200,
        shortDescription: "IP67 Water Resistant, 50MP No Shake Cam (OIS), 120Hz Super AMOLED, Nightography.",
        description: "Capture your Awesome moments with triple rear cameras, premium glass finish, clean camera layout, and vibrant colors on a 6.4-inch FHD+ Infinity-O display.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&q=80",
            altText: "Samsung Galaxy A54 Smartphone",
            sortOrder: 0,
          },
        ],
        tags: ["mobiles", "samsung", "bestsellers"],
      },
      // 12. Best Seller 4: Fire-Boltt Ninja Call Pro
      {
        name: "Fire-Boltt Ninja Call Pro",
        slug: "fire-boltt-ninja-call-pro",
        sku: "FB-NINJA-BLK",
        categorySlug: "accessories",
        brandSlug: "fire-boltt",
        price: "1999.00",
        compareAtPrice: "4999.00",
        isFeatured: false,
        ratingAverage: 4.1,
        ratingCount: 1500,
        shortDescription: "Bluetooth Calling Smartwatch with AI Voice Assistant, 1.69-inch HD Display, 100 Sports Modes.",
        description: "Answer calls on the go! Built with dual-tone metal body, comprehensive health suite with SpO2 and continuous heart monitoring.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
            altText: "Fire-Boltt Ninja Call Pro Smartwatch",
            sortOrder: 0,
          },
        ],
        tags: ["smartwatch", "wearables", "bestsellers"],
      },
      // 13. Best Seller 5: Zebronics Soundbar
      {
        name: "Zebronics Soundbar",
        slug: "zebronics-soundbar",
        sku: "ZEB-SNDBAR-BLK",
        categorySlug: "tv-appliances",
        brandSlug: "zebronics",
        price: "2499.00",
        compareAtPrice: "4999.00",
        isFeatured: false,
        ratingAverage: 4.2,
        ratingCount: 890,
        shortDescription: "Dolby Audio Soundbar with Subwoofer, HDMI ARC, Bluetooth v5.0, AUX, USB & Optical input.",
        description: "Transform your living room into a theatre with rich stereo acoustic drivers, dedicated wired subwoofer, and premium multi-connectivity options.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80",
            altText: "Zebronics Soundbar with Subwoofer",
            sortOrder: 0,
          },
        ],
        tags: ["soundbar", "audio", "tv-appliances", "bestsellers"],
      },
    ];

    const productMap = {};
    let createdCount = 0;

    for (const p of productsData) {
      const category = categoryMap[p.categorySlug] || categoryMap["audio"];
      const brand = brandMap[p.brandSlug] || brandMap["samsung"];

      const productPayload = {
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription,
        categoryId: category._id,
        brandId: brand ? brand._id : null,
        vendorId: vendor._id,
        price: mongoose.Types.Decimal128.fromString(p.price),
        compareAtPrice: p.compareAtPrice ? mongoose.Types.Decimal128.fromString(p.compareAtPrice) : null,
        currency: "INR",
        stockStatus: "in_stock",
        status: "active",
        isFeatured: Boolean(p.isFeatured),
        ratingAverage: p.ratingAverage || 0,
        ratingCount: p.ratingCount || 0,
        images: p.images,
        tags: p.tags,
        submittedAt: new Date(),
        approvedAt: new Date(),
        moderatedBy: admin._id,
        deletedAt: null,
      };

      const product = await Product.findOneAndUpdate(
        { sku: p.sku },
        { $set: productPayload },
        { upsert: true, new: true, runValidators: true }
      );

      productMap[p.sku] = product;

      // ProductVariant
      const variantSku = `${p.sku}-DEF`;
      const variantPayload = {
        productId: product._id,
        sku: variantSku,
        name: "Standard Edition",
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        currency: "INR",
        stockQuantity: 100,
        stockStatus: "in_stock",
        image: p.images[0] || null,
      };

      const variant = await ProductVariant.findOneAndUpdate(
        { sku: variantSku },
        { $set: variantPayload },
        { upsert: true, new: true, runValidators: true }
      );

      // Inventory
      await Inventory.findOneAndUpdate(
        { productVariantId: variant._id, warehouseId: warehouse._id },
        {
          $set: {
            onHand: 100,
            reserved: 0,
            lowStockThreshold: 10,
            lastStockUpdateAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      createdCount++;
      console.log(`Saved product & inventory: ${product.name} (${product._id})`);
    }

    // 5. Storefront Sections configuration
    const featuredSkus = ["BOAT-AD141-BLK", "SAM-M14-5G-BLU", "HP-15S-SLV", "FB-PHOENIX-BLK", "ASUS-TUF-F15"];
    const newArrivalSkus = ["NOTH-2A-WHT", "RLM-NARZO60-ORG", "SONY-CH520-BLU", "LOGI-MXM3S-GRY", "DELL-INSP15-SLV"];
    const bestSellerSkus = ["SAM-A54-BLK", "BOAT-AD141-BLK", "HP-15S-SLV", "FB-NINJA-BLK", "ZEB-SNDBAR-BLK"];
    const flashDealSkus = ["BOAT-AD141-BLK", "FB-PHOENIX-BLK", "FB-NINJA-BLK", "ZEB-SNDBAR-BLK"];
    const flashSaleSkus = ["HP-15S-SLV", "SONY-CH520-BLU", "SAM-M14-5G-BLU", "ASUS-TUF-F15"];

    const getProductIds = (skus) => skus.map((sku) => productMap[sku]?._id).filter(Boolean);

    const sectionsData = [
      {
        title: "Featured Products",
        subtitle: "Handpicked for you, only the best.",
        key: "featured_products",
        type: "featured_products",
        productIds: getProductIds(featuredSkus),
        displayOrder: 1,
        isActive: true,
        createdBy: admin._id,
        updatedBy: admin._id,
      },
      {
        title: "New Arrivals",
        subtitle: "Latest products, just for you.",
        key: "new_arrivals",
        type: "new_arrivals",
        productIds: getProductIds(newArrivalSkus),
        displayOrder: 2,
        isActive: true,
        createdBy: admin._id,
        updatedBy: admin._id,
      },
      {
        title: "Best Sellers",
        subtitle: "Most loved products, top quality.",
        key: "best_sellers",
        type: "best_sellers",
        productIds: getProductIds(bestSellerSkus),
        displayOrder: 3,
        isActive: true,
        createdBy: admin._id,
        updatedBy: admin._id,
      },
      {
        title: "Today's Hot Deals",
        subtitle: "Grab the best deals before they're gone!",
        key: "flash_deal",
        type: "products",
        productIds: getProductIds(flashDealSkus),
        displayOrder: 4,
        isActive: true,
        createdBy: admin._id,
        updatedBy: admin._id,
      },
      {
        title: "Flash Sale",
        subtitle: "Up to 70% | Big discounts, limited time only!",
        key: "flash_sale",
        type: "products",
        productIds: getProductIds(flashSaleSkus),
        displayOrder: 5,
        isActive: true,
        createdBy: admin._id,
        updatedBy: admin._id,
      },
    ];

    for (const sec of sectionsData) {
      await StorefrontSection.findOneAndUpdate(
        { key: sec.key },
        { $set: sec },
        { upsert: true, new: true, runValidators: true }
      );
      console.log(`Upserted storefront section: ${sec.title} (${sec.key})`);
    }

    // 6. Storefront Announcement Bar
    const announcement = {
      title: "Marketplace Guarantees",
      message: "Free Shipping on Orders Above ₹999 | 100% Genuine Products | Easy 30-Day Returns | Customer Support",
      linkUrl: "/shop",
      linkLabel: "Shop Now",
      displayOrder: 1,
      isActive: true,
      createdBy: admin._id,
    };

    await StorefrontAnnouncementBar.findOneAndUpdate(
      { title: announcement.title },
      { $set: announcement },
      { upsert: true, new: true }
    );
    console.log("Upserted active storefront announcement bar.");

    console.log(`\n=== CATALOG & MERCHANDISING SEEDING COMPLETED SUCCESSFULLY ===`);
    console.log(`Total Products Synced: ${createdCount}`);
    console.log(`Total Categories: ${Object.keys(categoryMap).length}`);
    console.log(`Total Brands: ${Object.keys(brandMap).length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error during catalog seeding:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedStorefrontCatalog();
