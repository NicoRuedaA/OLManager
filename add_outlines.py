from PIL import Image, ImageDraw, ImageFilter
import os

# Colores de los roles (TailwindCSS)
ROLE_COLORS = {
    "top": (239, 68, 68, 200),  # danger/rojo
    "jungler": (34, 197, 94, 200),  # success/verde
    "mid": (234, 179, 8, 200),  # accent/amarillo
    "adc": (59, 130, 246, 200),  # primary/azul
    "support": (107, 114, 128, 200),  # neutral/gris
}


def add_outline(input_path, color_rgba, outline_width=2):
    img = Image.open(input_path).convert("RGBA")

    # Crear nueva imagen con el contorno
    new_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(new_img)

    # Obtener alpha mask
    if img.mode in ("RGBA", "LA"):
        mask = img.split()[-1]
    else:
        mask = None

    # Crear outline dibujando la forma expandida
    if mask:
        # Expandir mask
        expanded = mask.filter(ImageFilter.MaxFilter(size=outline_width * 2 + 1))

        # Dibujar outline
        for y in range(img.height):
            for x in range(img.width):
                orig = mask.getpixel((x, y))
                exp = expanded.getpixel((x, y))
                if exp > 0 and orig == 0:
                    draw.point((x, y), fill=color_rgba)

    # Combinar outline + imagen original
    result = Image.alpha_composite(new_img, img)
    result.save(input_path, "PNG")
    print(f"✓ {os.path.basename(input_path)} - outline {color_rgba[:3]}")


# Procesar cada icono
base_path = "F:/Proyectos/OLManager/public/role-icons/"
for role, color in ROLE_COLORS.items():
    file_path = f"{base_path}{role}.png"
    if os.path.exists(file_path):
        add_outline(file_path, color)
    else:
        print(f"✗ {file_path} no existe")

print("\n¡Listo!")
