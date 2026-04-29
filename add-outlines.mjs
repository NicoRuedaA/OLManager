import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ROLE_COLORS = {
  top: { r: 239, g: 68, b: 68, a: 200 },      // danger/rojo
  jungler: { r: 34, g: 197, b: 94, a: 200 },  // success/verde
  mid: { r: 234, g: 179, b: 8, a: 200 },      // accent/amarillo
  adc: { r: 59, g: 130, b: 246, a: 200 },     // primary/azul
  support: { r: 107, g: 114, b: 128, a: 200 }, // neutral/gris
};

const baseDir = 'F:/Proyectos/OLManager/public/role-icons';

async function addOutline(filePath, color) {
  try {
    const image = await sharp(filePath).ensureAlpha().raw().toBuffer();
    const metadata = await sharp(filePath).metadata();
    const { width, height } = metadata;
    
    // Crear buffer para el outline
    const outline = Buffer.alloc(image.length);
    outline.fill(0);
    
    // Función simple para obtener pixel
    const getPixel = (x, y, buf) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return buf[(y * width + x) * 4 + 3]; // alpha channel
    };
    
    // Añadir outline
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const origAlpha = image[idx + 3];
        
        if (origAlpha === 0) {
          // Verificar si hay pixels vecinos con alpha > 0
          let hasNeighbor = false;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (getPixel(x + dx, y + dy, image) > 0) {
                hasNeighbor = true;
                break;
              }
            }
            if (hasNeighbor) break;
          }
          
          if (hasNeighbor) {
            outline[idx] = color.r;
            outline[idx + 1] = color.g;
            outline[idx + 2] = color.b;
            outline[idx + 3] = color.a;
          }
        }
      }
    }
    
    // Combinar outline + original
    const result = Buffer.alloc(image.length);
    for (let i = 0; i < image.length; i += 4) {
      if (outline[i + 3] > 0 && image[i + 3] === 0) {
        result[i] = outline[i];
        result[i + 1] = outline[i + 1];
        result[i + 2] = outline[i + 2];
        result[i + 3] = outline[i + 3];
      } else {
        result[i] = image[i];
        result[i + 1] = image[i + 1];
        result[i + 2] = image[i + 2];
        result[i + 3] = image[i + 3];
      }
    }
    
    // Guardar
    await sharp(result, {
      raw: { width, height, channels: 4 }
    }).png().toFile(filePath);
    
    console.log(`✓ ${path.basename(filePath)} - outline RGB(${color.r},${color.g},${color.b})`);
  } catch (error) {
    console.error(`✗ ${path.basename(filePath)}: ${error.message}`);
  }
}

async function main() {
  console.log('Añadiendo contornos a iconos de roles...\n');
  
  for (const [role, color] of Object.entries(ROLE_COLORS)) {
    const filePath = path.join(baseDir, `${role}.png`);
    if (fs.existsSync(filePath)) {
      await addOutline(filePath, color);
    } else {
      console.log(`✗ ${role}.png no existe`);
    }
  }
  
  console.log('\n¡Listo!');
}

main();
