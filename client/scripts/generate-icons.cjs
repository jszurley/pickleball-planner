const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../public/icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  // Create a pickleball-style icon programmatically
  for (const size of sizes) {
    const image = new Jimp({ width: size, height: size, color: 0x4CAF50FF }); // Green background

    const center = size / 2;
    const radius = size * 0.45;
    const holeRadius = size * 0.05;
    const borderWidth = size * 0.03;

    // Draw border circle (darker green)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
        if (dist > radius) {
          image.setPixelColor(0xFFFFFFFF, x, y); // White outside
        } else if (dist > radius - borderWidth) {
          image.setPixelColor(0x2E7D32FF, x, y); // Dark green border
        }
      }
    }

    // Draw holes (5 holes like a pickleball)
    const holePositions = [
      { x: 0.35, y: 0.35 },
      { x: 0.65, y: 0.35 },
      { x: 0.50, y: 0.50 },
      { x: 0.35, y: 0.65 },
      { x: 0.65, y: 0.65 }
    ];

    for (const pos of holePositions) {
      const holeX = size * pos.x;
      const holeY = size * pos.y;
      const holeR = holeRadius;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dist = Math.sqrt((x - holeX) ** 2 + (y - holeY) ** 2);
          if (dist <= holeR) {
            image.setPixelColor(0xFFFFFFFF, x, y); // White holes
          }
        }
      }
    }

    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
    await image.write(outputPath);
    console.log(`Generated: icon-${size}x${size}.png`);
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
