"""Builds assets/data.js + web-optimised images + clean profile files from the source pack."""
import re, json, glob, os, unicodedata
from PIL import Image
SRC = os.environ.get("SRC", "../z/Website")
def slug(s):
    s = unicodedata.normalize("NFKD", s); s = re.sub(r"[^\w\s-]", "", s.encode("ascii","ignore").decode()).strip().lower()
    return re.sub(r"[\s_]+", "-", s)
P = [
 ("~ ⭐ Harmen OG [711].txt","Harmen OG","711","Closest to the Harman IE 2019 curve; ten bands, gentle bass.","04_kz_edx_pro_711_harmen_og"),
 ("~ 🌀 ɪɴᴤᴛɪɴᴄᴛ [711].txt","Instinct","711","Balanced V with firm presence and a tamed 5 kHz peak.","05_kz_edx_pro_711_instinct"),
 ("~ 🎗 PeqDB Audio [711].txt","PeqDB Audio","711","Fuller bass and lower mids; twelve-band database style.","06_kz_edx_pro_711_peqdb_audio"),
 ("~ 🎼 Ultra x Harmen [711].text","Ultra x Harmen","711","Instinct skeleton with extra treble air around 9 kHz.","07_kz_edx_pro_711_ultra_x_harmen"),
 ("~ 🗿 Zenith OG [711].txt","Zenith OG","711","Deepest mid-bass cut; cleanest, most reference-like.","08_kz_edx_pro_711_zenith_og"),
 ("~ 🥏 MKIII Reference [711].txt","MKIII Reference","711","Reference balance with a slightly lifted 3.4 kHz.","09_kz_edx_pro_711_mkiii_reference"),
 ("~ 🧿 Harman MoA 2025.txt","Harman MoA 2025","711","Softer presence lift; relaxed on long sessions.","10_kz_edx_pro_711_harman_moa_2025"),
 ("~ 🪩 Instinct Studio [711].txt","Instinct Studio","711","Instinct with deeper 5 kHz notch and more sparkle.","11_kz_edx_pro_711_instinct_studio"),
 ("~ 🪬 Instinct Energy [711].txt","Instinct Energy","711","Seven bands, lively mids and a lifted top end.","12_kz_edx_pro_711_instinct_energy"),
 ("~ 🛸 Ultra Instinct [711].txt","Ultra Instinct","711","Biggest bass shelf cut, most open and fast.","13_kz_edx_pro_711_ultra_instinct"),
 ("∆ 🌪 Zenith OG [5128].txt","Zenith OG","5128","Wide, shallow cuts tuned for the 5128 fixture.","15_kz_edx_pro_5128_zenith_og"),
 ("∆ 🌊 Zenith Hybrid [5128].txt","Zenith Hybrid","5128","Narrower filters, keeps more bass weight.","14_kz_edx_pro_5128_zenith_hybrid"),
 ("~ [One Above All] ~.txt","One Above All","5128","Smooth variant; filter set identical to Zenith OG 5128.","15_kz_edx_pro_5128_zenith_og"),
 ("- 🐦‍🔥 Stellar Master™ [Speaker•Limit].txt","Stellar Master","spk","Four notches only; protects the driver, no bass boost.","01_redmi12_stellar_master"),
 ("- 🦢 Equilibrium [Speaker].txt","Equilibrium","spk","Low shelf and 480 Hz lift to fake body; nine bands.","02_redmi12_equilibrium"),
 ("- 🦩 Fusion Hybrid [Speaker].txt","Fusion Hybrid","spk","Equilibrium plus a 1.35 kHz cut; ten bands.","03_redmi12_fusion_hybrid"),
]
rx = re.compile(r"Filter\s+\d+:\s*(ON|OFF)\s+(LSC|LS|HSC|HS|PK)\s+Fc\s+([\d.]+)\s*Hz\s+Gain\s+([+-]?[\d.]+)\s*dB\s+Q\s+([\d.]+)")
out=[]
for f,name,dev,tag,img in P:
    t=open(os.path.join(SRC,f),encoding="utf-8").read()
    pre=float(re.search(r"Preamp:\s*([+-]?[\d.]+)",t).group(1))
    fl=[[m[1],float(m[2]),float(m[3]),float(m[4])] for m in rx.findall(t) if m[0]=="ON"]
    d={"id":slug(f"{name}-{dev}"),"name":name,"dev":dev,"tag":tag,"pre":pre,"f":fl,"img":img}
    out.append(d)
    clean="\n".join([f"Preamp: {pre:.1f} dB"]+[f"Filter {i+1}: ON {a} Fc {b:g} Hz Gain {c:+.1f} dB Q {e:.2f}" for i,(a,b,c,e) in enumerate(fl)])+"\n"
    open(f"profiles/{d['id']}.txt","w",encoding="utf-8").write(clean)
def raw(f,step):
    import math
    rows=[re.split(r"[,\s]+",l.strip()) for l in open(os.path.join(SRC,f),encoding="utf-8").read().splitlines()[1:] if l.strip()]
    rows=[(float(r[0]),float(r[1])) for r in rows]
    for i in range(1,len(rows)):
        if rows[i-1][0]<=1000<=rows[i][0]:
            (x0,y0),(x1,y1)=rows[i-1],rows[i]; ref=y0+(y1-y0)*math.log(1000/x0)/math.log(x1/x0); break
    return [[round(a,2),round(b-ref,2)] for a,b in rows[::step]]  # normalised to 0 dB @ 1 kHz
R={"711":raw("KZ EDX Pro — raw FR (711).txt",4),"5128":raw("KZ EDX Pro — raw FR (5128).txt",1),"spk":raw("Redmi 12 speaker — raw FR.txt",1)}
open("assets/data.js","w").write("window.PEQ_DATA="+json.dumps({"profiles":out,"raw":R},ensure_ascii=False,separators=(",",":"))+";")
for im in set(p[4] for p in P)|{"kz_edx_pro_711_comparison"}:
    p=glob.glob(f"{SRC}/Images/*/{im}.png")[0]; i=Image.open(p).convert("RGB"); i.thumbnail((1600,1600)); i.save(f"assets/img/{im}.webp","WEBP",quality=80,method=6)
print(len(out),{k:len(v) for k,v in R.items()}, os.popen("du -sh assets").read())
