# usage: python3 sbs.py out.jpg --ours a.jpg b.jpg --ref r1.jpg r2.jpg   (side-by-side sheet, 480 px tall)
import sys; from PIL import Image, ImageDraw
a=sys.argv; out=a[1]; i=a.index('--ours'); j=a.index('--ref')
ours=a[i+1:j]; refs=a[j+1:]
ims=[(Image.open(p).convert('RGB'),'OURS') for p in ours]+[(Image.open(p).convert('RGB'),'REF') for p in refs]
ims=[(im.resize((int(im.width*480/im.height),480)),t) for im,t in ims]
S=Image.new('RGB',(sum(im.width for im,_ in ims),500),'black'); x=0; d=ImageDraw.Draw(S)
for im,t in ims: S.paste(im,(x,20)); d.text((x+6,4),t,fill='white'); x+=im.width
S.save(out)
