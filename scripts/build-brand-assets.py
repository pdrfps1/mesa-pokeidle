# Gera os assets de marca a partir de build/logo-source.webp.
# Uso: python scripts/build-brand-assets.py
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'build' / 'logo-source.webp'
BG = (0x00, 0x17, 0x3F)
INSET = 6
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def circular_logo(size):
    # Máscara em 4x e reduzida com LANCZOS: borda suave (anti-alias).
    scale = 4
    big = size * scale
    inset = INSET * size / 1024 * scale
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).ellipse((inset, inset, big - 1 - inset, big - 1 - inset), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    src = Image.open(SOURCE).convert('RGB').resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    return out


def on_background(logo, width, height, box_size, x, y):
    canvas = Image.new('RGB', (width, height), BG)
    small = logo.resize((box_size, box_size), Image.LANCZOS)
    canvas.paste(small, (x, y), small)
    return canvas


def main():
    icon = circular_logo(1024)
    (ROOT / 'build').mkdir(exist_ok=True)
    (ROOT / 'src' / 'assets' / 'brand').mkdir(parents=True, exist_ok=True)

    icon.save(ROOT / 'build' / 'icon.png')
    icon.save(ROOT / 'build' / 'icon.ico', sizes=ICO_SIZES)
    icon.save(ROOT / 'src' / 'assets' / 'brand' / 'icon.ico', sizes=ICO_SIZES)

    for size in (256, 64, 32):
        icon.resize((size, size), Image.LANCZOS).save(ROOT / 'src' / 'assets' / 'brand' / f'logo-{size}.png')

    # Sidebar do instalador e do desinstalador: 164x314, logo de 132px no terço de cima.
    side = circular_logo(132)
    x = (164 - 132) // 2
    y = 314 // 3 - 132 // 2
    sidebar = on_background(side, 164, 314, 132, x, y)
    sidebar.save(ROOT / 'build' / 'installerSidebar.bmp', format='BMP')
    sidebar.save(ROOT / 'build' / 'uninstallerSidebar.bmp', format='BMP')

    # Cabeçalho do instalador: 150x57, logo de 45px alinhada à direita com 6px de margem.
    header_logo = circular_logo(45)
    header = on_background(header_logo, 150, 57, 45, 150 - 6 - 45, (57 - 45) // 2)
    header.save(ROOT / 'build' / 'installerHeader.bmp', format='BMP')

    print('assets de marca gerados')


if __name__ == '__main__':
    main()
