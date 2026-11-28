import sys, json, wave
from pocketsphinx import Decoder, Config
text = sys.argv[2]
words = [w.strip('.,…?!').lower().replace("nvidia's","nvidias") for w in text.split()]
d = Decoder(lm=None, samprate=16000, loglevel='FATAL')
# add unknown words to dict
for w in set(words):
    if d.lookup_word(w) is None:
        prons = {'nvidias':'EH N V IH D IY AH Z','ai':'EY AY'}
        d.add_word(w, prons.get(w, 'AH'), True)
d.set_align_text(' '.join(words))
with wave.open(sys.argv[1],'rb') as f: raw = f.readframes(f.getnframes())
d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
d.set_alignment(); d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
out=[]
for seg in d.get_alignment():
    if seg.name in ('<s>','</s>','<sil>'): continue
    out.append({'w':seg.name,'s':round(seg.start/100,2),'e':round((seg.start+seg.duration)/100,2)})
json.dump(out, open(sys.argv[3],'w'), indent=0); print(len(out), out[:3], out[-2:])
