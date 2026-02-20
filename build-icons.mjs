#!/usr/bin/env node

import sharp from 'sharp';
import png2icons from 'png2icons';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_PNG = resolve(__dirname, 'resources/logo.png');
const SOURCE_CANARY_PNG = resolve(__dirname, 'resources/logo_canary.png');
const BUILD_DIR = resolve(__dirname, 'build');

// Ensure build directory exists
if (!existsSync(BUILD_DIR)) {
  mkdirSync(BUILD_DIR, { recursive: true });
}

async function generateIcons() {
  console.log('🎨 Generating app icons...');

  if (!existsSync(SOURCE_PNG)) {
    console.error('❌ Error: Source PNG not found at', SOURCE_PNG);
    process.exit(1);
  }

  try {
    await generateIconSet(SOURCE_PNG, '');

    if (existsSync(SOURCE_CANARY_PNG)) {
      await generateIconSet(SOURCE_CANARY_PNG, '_canary');
    } else {
      console.warn('⚠️  Canary source PNG not found; skipping canary installer icons.');
    }

    // ============================================
    // Summary
    // ============================================
    console.log('');
    console.log('✅ All icons generated successfully!');
    console.log('');
    console.log('📦 Next steps:');
    console.log('   1. Run "pnpm run dev" to test in development');
    console.log('   2. Run "pnpm run package" to build distributable');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

async function generateIconSet(sourcePngPath, suffix) {
  const prefix = suffix ? `icon${suffix}` : 'icon';
  const sourceBuffer = readFileSync(sourcePngPath);

  console.log(`📱 Generating macOS .icns file (${prefix})...`);
  const icnsInput = await sharp(sourceBuffer)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const icnsOutput = png2icons.createICNS(icnsInput, png2icons.BILINEAR, 0);
  writeFileSync(resolve(BUILD_DIR, `${prefix}.icns`), icnsOutput);
  console.log(`✓ Created build/${prefix}.icns`);

  console.log(`🪟 Generating Windows .ico file (${prefix})...`);
  const icoInput = await sharp(sourceBuffer)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const icoOutput = png2icons.createICO(icoInput, png2icons.BILINEAR, 0, false);
  writeFileSync(resolve(BUILD_DIR, `${prefix}.ico`), icoOutput);
  console.log(`✓ Created build/${prefix}.ico`);

  console.log(`🐧 Generating Linux PNG icons (${prefix})...`);
  await sharp(sourceBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(BUILD_DIR, `${prefix}.png`));
  console.log(`✓ Created build/${prefix}.png (512x512)`);

  const fallbackName = suffix ? `${prefix}_256.png` : 'icon_256.png';
  await sharp(sourceBuffer)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(BUILD_DIR, fallbackName));
  console.log(`✓ Created build/${fallbackName} (256x256)`);
}

generateIcons();
