const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Tamanhos dos ícones necessários para APK/PWA
const sizes = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 1024, name: 'icon-1024x1024.png' }
];

// Ícones para shortcuts
const shortcutIcons = [
  { size: 96, name: 'shortcut-dashboard.png' },
  { size: 96, name: 'shortcut-presence.png' },
  { size: 96, name: 'shortcut-reports.png' }
];

async function generateIcons() {
  const svgPath = path.join(__dirname, 'public', 'icon-512x512.svg');
  const iconsDir = path.join(__dirname, 'public', 'icons');
  
  console.log('🎨 Gerando ícones PNG...');
  
  // Verificar se o SVG existe
  if (!fs.existsSync(svgPath)) {
    console.error('❌ Arquivo SVG não encontrado:', svgPath);
    return;
  }
  
  // Garantir que o diretório existe
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  // Gerar ícones principais
  for (const icon of sizes) {
    try {
      await sharp(svgPath)
        .resize(icon.size, icon.size)
        .png()
        .toFile(path.join(iconsDir, icon.name));
      console.log(`✅ Gerado: ${icon.name}`);
    } catch (error) {
      console.error(`❌ Erro ao gerar ${icon.name}:`, error.message);
    }
  }
  
  // Gerar ícones para shortcuts
  for (const icon of shortcutIcons) {
    try {
      await sharp(svgPath)
        .resize(icon.size, icon.size)
        .png()
        .toFile(path.join(iconsDir, icon.name));
      console.log(`✅ Gerado: ${icon.name}`);
    } catch (error) {
      console.error(`❌ Erro ao gerar ${icon.name}:`, error.message);
    }
  }
  
  console.log('🎉 Ícones gerados com sucesso!');
}

generateIcons().catch(console.error);