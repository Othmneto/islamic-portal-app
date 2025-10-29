/**
 * PWA Icon Generator Script
 * Creates the necessary icons for PWA installation
 */

const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const iconSizes = [
  { size: 16, name: 'favicon-16x16' },
  { size: 32, name: 'favicon-32x32' },
  { size: 48, name: 'favicon-48x48' },
  { size: 70, name: 'icon-70x70' },
  { size: 72, name: 'icon-72x72' },
  { size: 96, name: 'icon-96x96' },
  { size: 128, name: 'icon-128x128' },
  { size: 144, name: 'icon-144x144' },
  { size: 150, name: 'icon-150x150' },
  { size: 152, name: 'icon-152x152' },
  { size: 167, name: 'icon-167x167' },
  { size: 180, name: 'icon-180x180' },
  { size: 192, name: 'icon-192x192' },
  { size: 310, name: 'icon-310x310' },
  { size: 384, name: 'icon-384x384' },
  { size: 512, name: 'icon-512x512' }
];

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create a simple SVG icon
function createSVGIcon(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#6366f1" rx="${size * 0.1}"/>
    <text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="white" font-family="Arial, sans-serif" font-size="${size * 0.4}" font-weight="bold">📅</text>
  </svg>`;
}

// Create a simple HTML file to generate icons
function createIconGeneratorHTML() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PWA Icon Generator</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .icon-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
    .icon-item { text-align: center; padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
    .icon-preview { margin: 10px 0; }
    .download-btn { background: #6366f1; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>PWA Icon Generator</h1>
  <p>This page generates the necessary icons for PWA installation. Right-click on each icon and save it to the /public/icons/ directory.</p>
  
  <div class="icon-grid">
    ${iconSizes.map(icon => `
      <div class="icon-item">
        <h3>${icon.name}</h3>
        <div class="icon-preview">
          <canvas id="canvas-${icon.size}" width="${icon.size}" height="${icon.size}" style="border: 1px solid #ccc;"></canvas>
        </div>
        <button class="download-btn" onclick="downloadIcon(${icon.size})">Download</button>
      </div>
    `).join('')}
  </div>

  <script>
    // Generate icons
    ${iconSizes.map(icon => `
      (function() {
        const canvas = document.getElementById('canvas-${icon.size}');
        const ctx = canvas.getContext('2d');
        const size = ${icon.size};
        
        // Background
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(0, 0, size, size);
        
        // Icon (calendar emoji)
        ctx.font = '${icon.size * 0.4}px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📅', size/2, size/2);
      })();
    `).join('')}

    function downloadIcon(size) {
      const canvas = document.getElementById('canvas-' + size);
      const link = document.createElement('a');
      link.download = 'icon-' + size + 'x' + size + '.png';
      link.href = canvas.toDataURL();
      link.click();
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, '../public/icon-generator.html'), html);
  console.log('✅ Icon generator HTML created at /public/icon-generator.html');
}

// Create a simple favicon
function createFavicon() {
  const faviconSVG = createSVGIcon(32);
  fs.writeFileSync(path.join(__dirname, '../public/favicon.svg'), faviconSVG);
  console.log('✅ Favicon SVG created');
}

// Main execution
console.log('🔧 Generating PWA icons...');

createIconGeneratorHTML();
createFavicon();

console.log('✅ PWA icon generation setup complete!');
console.log('📝 Instructions:');
console.log('1. Open /public/icon-generator.html in your browser');
console.log('2. Download all the generated icons');
console.log('3. Save them to /public/icons/ directory with the correct names');
console.log('4. The icons will be used for PWA installation');
