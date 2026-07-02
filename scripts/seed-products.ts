#!/usr/bin/env bun
// Seed the catalog from the mockup photos in public/products — resizes each to
// the 400/800/1600 webp set (mirroring the admin upload pipeline), uploads to
// the product-images bucket, and inserts product + image + variants rows.
// Idempotent: a product whose slug already exists is skipped.
// Usage: bun run seed:products

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import type { Database } from '@/db/types.gen';
import { IMAGE_SIZES } from '@/lib/images';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supa = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SeedProduct {
  slug: string;
  file: string;
  name: { th: string; en: string };
  description: { th: string; en: string };
  basePriceThb: number;
  weightGrams: number;
  category: string;
  featured?: boolean;
  /** Size axis (adds one variant per size); omitted → single one-size variant. */
  sizes?: string[];
  stockPerVariant: number;
}

const SEED: SeedProduct[] = [
  {
    slug: 'aura-tote',
    file: 'public/products/pomelli_photoshoot_image_9_16_0634.png',
    name: { en: 'Aura Tote Bag', th: 'กระเป๋าผ้า Aura' },
    description: {
      en: 'Natural cotton canvas tote with the Aura mark. Roomy enough for a day out, sturdy enough for every day.',
      th: 'กระเป๋าผ้าแคนวาสฝ้ายธรรมชาติพร้อมโลโก้ Aura จุใจสำหรับวันเที่ยว ทนทานพอสำหรับทุกวัน',
    },
    basePriceThb: 390,
    weightGrams: 180,
    category: 'accessories',
    featured: true,
    stockPerVariant: 20,
  },
  {
    slug: 'nano-tee',
    file: 'public/products/pomelli_photoshoot_image_9_16_0636.png',
    name: { en: 'Nano Tee', th: 'เสื้อยืด Nano' },
    description: {
      en: 'Heavyweight charcoal tee with a tonal Nano print. Pre-shrunk, boxy fit.',
      th: 'เสื้อยืดสีชาร์โคลเนื้อหนา พิมพ์ลาย Nano โทนเดียวกับผ้า ผ่านการหดล่วงหน้า ทรงบ็อกซี่',
    },
    basePriceThb: 590,
    weightGrams: 220,
    category: 'apparel',
    featured: true,
    sizes: ['S', 'M', 'L', 'XL'],
    stockPerVariant: 10,
  },
  {
    slug: 'nano-notebook',
    file: 'public/products/pomelli_photoshoot_image_9_16_0637.png',
    name: { en: 'Nano Notebook', th: 'สมุดโน้ต Nano' },
    description: {
      en: 'Grey vegan-leather notebook, embossed Nano mark, metal bookmark. Lined pages.',
      th: 'สมุดโน้ตหนังวีแกนสีเทา ปั๊มโลโก้ Nano พร้อมที่คั่นโลหะ กระดาษมีเส้น',
    },
    basePriceThb: 290,
    weightGrams: 320,
    category: 'stationery',
    featured: true,
    stockPerVariant: 30,
  },
  {
    slug: 'nano-mug',
    file: 'public/products/pomelli_photoshoot_image_9_16_0639.png',
    name: { en: 'Nano Mug', th: 'แก้ว Nano' },
    description: {
      en: 'Cream ceramic mug with the Nano mark. Dishwasher and microwave safe.',
      th: 'แก้วเซรามิกสีครีมพร้อมโลโก้ Nano เข้าเครื่องล้างจานและไมโครเวฟได้',
    },
    basePriceThb: 350,
    weightGrams: 400,
    category: 'homeware',
    featured: true,
    stockPerVariant: 25,
  },
];

for (const seed of SEED) {
  const { data: existing } = await supa
    .from('products')
    .select('id')
    .eq('slug', seed.slug)
    .maybeSingle();
  if (existing) {
    console.log(`↷ ${seed.slug} already exists — skipped`);
    continue;
  }

  const { data: product, error: productErr } = await supa
    .from('products')
    .insert({
      slug: seed.slug,
      status: 'active',
      name: seed.name,
      description: seed.description,
      base_price_thb: seed.basePriceThb,
      weight_grams: seed.weightGrams,
      category: seed.category,
      is_featured: seed.featured ?? false,
    })
    .select('id')
    .single();
  if (productErr || !product) {
    console.error(`✗ ${seed.slug}: product insert failed:`, productErr?.message);
    process.exit(1);
  }

  // Image set — same paths/sizes the admin ImagePicker produces.
  const source = readFileSync(seed.file);
  const stamp = Date.now();
  const urls: Partial<Record<number, string>> = {};
  let storagePath = '';
  for (const size of IMAGE_SIZES) {
    const webp = await sharp(source)
      .resize({ width: size, withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    const path = `products/${product.id}/${stamp}-${size}.webp`;
    const { error: upErr } = await supa.storage
      .from('product-images')
      .upload(path, webp, { contentType: 'image/webp' });
    if (upErr) {
      console.error(`✗ ${seed.slug}: upload ${size}w failed:`, upErr.message);
      process.exit(1);
    }
    urls[size] = supa.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    if (size === IMAGE_SIZES[0]) storagePath = path;
  }

  const { data: image, error: imageErr } = await supa
    .from('product_images')
    .insert({
      product_id: product.id,
      sort: 0,
      storage_path: storagePath,
      url_400: urls[400] ?? '',
      url_800: urls[800] ?? '',
      url_1600: urls[1600] ?? '',
      alt: seed.name,
    })
    .select('id')
    .single();
  if (imageErr || !image) {
    console.error(`✗ ${seed.slug}: image insert failed:`, imageErr?.message);
    process.exit(1);
  }
  await supa.from('products').update({ hero_image_id: image.id }).eq('id', product.id);

  // Variants — one per size, or a single one-size row (option_values: {}).
  if (seed.sizes) {
    await supa.from('variant_options').insert({
      product_id: product.id,
      name: 'size',
      values: seed.sizes,
      sort: 0,
    });
  }
  const optionSets = seed.sizes ? seed.sizes.map((s) => ({ size: s })) : [{}];
  const { error: variantErr } = await supa.from('variants').insert(
    optionSets.map((option_values, i) => ({
      product_id: product.id,
      sku: `${product.id.slice(0, 8)}-${i}`,
      option_values,
      stock_available: seed.stockPerVariant,
      is_active: true,
    })),
  );
  if (variantErr) {
    console.error(`✗ ${seed.slug}: variants insert failed:`, variantErr.message);
    process.exit(1);
  }

  console.log(
    `✓ ${seed.slug} — ${seed.name.en}, ฿${seed.basePriceThb}, ${optionSets.length} variant(s)`,
  );
}

console.log('Done.');
