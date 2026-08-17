from PIL import Image, ImageDraw
import os

os.makedirs('public/icons', exist_ok=True)

# Create 192x192 icon
img = Image.new('RGB', (192, 192), color='#4a90d9')
draw = ImageDraw.Draw(img)
draw.rectangle([32, 48, 160, 144], fill='#fff', outline='#357abd', width=3)
draw.rectangle([48, 64, 144, 100], fill='#e8f1fb')
draw.rectangle([56, 72, 72, 88], fill='#4a90d9')
draw.rectangle([80, 72, 96, 88], fill='#4a90d9')
draw.rectangle([104, 72, 120, 88], fill='#4a90d9')
draw.rectangle([56, 104, 72, 120], fill='#4a90d9')
draw.rectangle([80, 104, 96, 120], fill='#4a90d9')
draw.rectangle([104, 104, 120, 120], fill='#4a90d9')
draw.rectangle([88, 100, 96, 128], fill='#4caf50')
draw.rectangle([80, 108, 104, 116], fill='#4caf50')
img.save('public/icons/icon-192.png')

# Create 512x512 icon
img2 = Image.new('RGB', (512, 512), color='#4a90d9')
draw2 = ImageDraw.Draw(img2)
draw2.rectangle([84, 128, 428, 384], fill='#fff', outline='#357abd', width=6)
draw2.rectangle([128, 160, 384, 256], fill='#e8f1fb')
draw2.rectangle([160, 192, 224, 256], fill='#4a90d9')
draw2.rectangle([240, 192, 304, 256], fill='#4a90d9')
draw2.rectangle([320, 192, 384, 256], fill='#4a90d9')
draw2.rectangle([160, 288, 224, 352], fill='#4a90d9')
draw2.rectangle([240, 288, 304, 352], fill='#4a90d9')
draw2.rectangle([320, 288, 384, 352], fill='#4a90d9')
draw2.rectangle([232, 288, 280, 352], fill='#4caf50')
draw2.rectangle([208, 304, 304, 336], fill='#4caf50')
img2.save('public/icons/icon-512.png')

# Create maskable icon
img3 = Image.new('RGB', (512, 512), color='#4a90d9')
draw3 = ImageDraw.Draw(img3)
draw3.rectangle([64, 64, 448, 448], fill='#fff', outline='#357abd', width=6)
draw3.rectangle([96, 96, 416, 352], fill='#e8f1fb')
draw3.rectangle([128, 128, 224, 224], fill='#4a90d9')
draw3.rectangle([256, 128, 352, 224], fill='#4a90d9')
draw3.rectangle([128, 256, 224, 352], fill='#4a90d9')
draw3.rectangle([256, 256, 352, 352], fill='#4a90d9')
draw3.rectangle([160, 288, 352, 320], fill='#4caf50')
draw3.rectangle([224, 256, 288, 352], fill='#4caf50')
img3.save('public/icons/icon-maskable-512.png')

print('Icons created successfully')
