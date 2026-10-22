"""Build review pages for the 2026-10-22 graphics delivery. No game integration."""
from pathlib import Path
import json
from html import escape
ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'output/designs'
PREFIX = '../../../public/'
STYLE = '''*{box-sizing:border-box}body{margin:0;background:#f2ecdd;color:#302a21;font:16px/1.5 "Nunito Sans",sans-serif}main{max-width:1280px;margin:auto;padding:32px}h1{font-size:34px;line-height:1.2}h2{margin-top:36px}p{color:#706653}a{color:#705124}button{font:inherit;padding:8px 16px;border:1px solid #b9ab8e;border-radius:8px;background:#fffaf0;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}.asset{background:#e8deca;padding:16px;border-radius:12px;text-align:center}.art{height:168px;display:flex;align-items:center;justify-content:center}.art img{max-width:155px;max-height:155px}.sizes{display:flex;gap:20px;align-items:center;justify-content:center;min-height:56px}.sizes span{display:grid;justify-items:center;gap:6px;font-size:11px}.asset h3{font-size:16px;margin:10px 0}.path{font:11px/1.4 monospace;overflow-wrap:anywhere;color:#756956}.cards{display:flex;gap:20px;flex-wrap:wrap}.card{width:185px}.card img{width:100%;border-radius:10px}.checker .art,.checker .sizes,.checker .piece{background-color:#fff;background-image:conic-gradient(#ddd 25%,transparent 0 50%,#ddd 0 75%,transparent 0);background-size:20px 20px}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:center;border-bottom:1px solid #cebea0}th:first-child{text-align:left}.piece img{width:120px;vertical-align:middle}.small{display:flex;justify-content:center;align-items:center;gap:22px;min-height:70px}.stack{position:relative;width:68px;height:68px;display:inline-block}.stack img{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}.table{overflow:auto}.compare{display:flex;align-items:center;gap:40px;flex-wrap:wrap}.compare>div{text-align:center}.compare img{display:block;margin:auto}nav{display:flex;gap:22px;flex-wrap:wrap}'''
LABELS = {'river-coin':'Münze','rich':'Voller Geldbeutel','poor':'Leerer Geldbeutel','move-ship':'Schiff versetzen','trade':'Handeln','market':'Markt','council':'Rat','scholars':'Gelehrte','event-ship':'Ereignis: Schiff','event-market':'Ereignis: Markt','event-council':'Ereignis: Rat','event-scholars':'Ereignis: Gelehrte','honor':'Ehrenschild','improve':'Stadtausbau','resource-paper':'Schriften','resource-cloth':'Stoff','resource-coin':'Silber','banner-raiders':'Angriff der Flotte','raiders':'Plündererflotte','wall':'Palisade'}
COLORS = ['red','blue','gold','purple','white','orange','green','brown','grey-light','grey-dark']
COLOR_LABELS = ['Rot','Blau','Goldgelb','Violett','Weiß','Orange','Grün','Braun','Hellgrau','Dunkelgrau']
def image(path, width=None):
    return f'<img src="{PREFIX}{escape(path)}" alt="{escape(path.split("/")[-1])}"'+(f' style="width:{width}px"' if width else '')+'>'
def icon(item):
    path=item['path'][7:]
    web='web/'+path
    sizes=(18,20,28)
    return f'<article class="asset"><div class="art">{image(path)}</div><h3>{LABELS.get(item["name"],item["name"])}</h3><div class="sizes">'+''.join(f'<span>{image(web,n)}{n} px</span>' for n in sizes)+f'</div><div class="path">{path}</div></article>'
def page(group,filename,title,body):
    nav='<nav><a href="../stadtwacht-2026-10-22/vorschau.html">Stadtwacht</a><a href="../stadtwacht-2026-10-22/figuren-vorschau.html">Figuren & Farben</a><a href="../fernhandel-2026-10-22/nachtrag-vorschau.html">Flussläufe</a><a href="../seewege-2026-10-22/nachtrag-vorschau.html">Bedienelemente</a></nav>'
    html=f'<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · Neuland</title><link rel="stylesheet" href="../../../public/fonts/nunito-sans/fonts.css"><style>{STYLE}</style><main>{nav}<h1>{title}</h1><p>Papiercollage · Nunito Sans · Grafiklieferung vom 22.10.2026</p><button onclick="document.body.classList.toggle(\'checker\')">Transparenz prüfen</button>{body}</main></html>'
    (BASE/f'{group}-2026-10-22'/filename).write_text(html,encoding='utf-8')
def records(group):
    path=BASE/f'{group}-2026-10-22/prompts.json'
    return json.loads(path.read_text(encoding='utf-8'))['assets']
def main():
    city=records('stadtwacht')
    cards='<h2>Güter neben den bisherigen Rohstoffen</h2><div class="cards">'
    for key,label in [('wood','Holz · Referenz'),('paper','Schriften'),('cloth','Stoff'),('silver','Silber'),('ore','Erz · Referenz')]:
        cards+=f'<div class="card">{image("web/cards-large/symbolstark/"+key+".jpg")}<h3>{label}</h3></div>'
    cards+='</div><h2>Symbole in Detail- und Spielgröße</h2><div class="grid">'+''.join(icon(a) for a in city if '/icons/' in a['path'])+'</div>'
    cards+='<h2>Flotte und Angriff</h2><div class="grid">'+''.join(icon(a) for a in city if a['name'] in ('raiders','banner-raiders'))+'</div><p>Silber verwendet im Code den Schlüssel <code>coin</code>; die Karte heißt <code>silver.jpg</code>.</p>'
    page('stadtwacht','vorschau.html','Stadtwacht – Karten und Symbole',cards)
    figures='<h2>Silhouetten und Palisade in Brettgröße</h2><div class="compare">'
    for key,label,width in [('city','Stadt',40),('metropolis','Prachtstadt',52)]:
        figures+=f'<div>{image("web/pieces/papiercollage-organic-v2/"+key+"-red.png",width)}{label} · {width} px</div>'
    figures+='<div><span class="stack">'+image('web/pieces/papiercollage/wall.png',68)+image('web/pieces/papiercollage-organic-v2/city-red.png',40)+'</span><br>Stadt mit Palisade</div></div>'
    figures+='<div class="small">'+''.join(f'<span>{image("web/pieces/papiercollage/guard"+str(n)+"-red.png",24)} Wächter {n} · 24 px</span>' for n in (1,2,3))+'</div>'
    figures+='<h2>Alle Spielerfarben und neutrale Grautöne</h2><div class="table"><table><tr><th>Farbe</th><th>Wächter I</th><th>Wächter II</th><th>Wächter III</th><th>Prachtstadt</th></tr>'
    for color,label in zip(COLORS,COLOR_LABELS):
        figures+=f'<tr><th>{label}</th>'+''.join('<td class="piece">'+image(f'pieces/papiercollage/guard{n}-{color}.png')+'</td>' for n in (1,2,3))+'<td class="piece">'+image(f'pieces/papiercollage-organic-v2/metropolis-{color}.png')+'</td></tr>'
    figures+='</table></div><h2>Palisade – freie Mitte</h2><div class="art">'+image('pieces/papiercollage/wall.png',160)+'</div><p>Alle Brettfiguren mit steiler Draufsicht. Umhänge, Dächer und Wimpel folgen der Spielerfarbe; Holz und Stein bleiben neutral. Die Palisade liegt unter der Stadt.</p>'
    page('stadtwacht','figuren-vorschau.html','Stadtwacht – Figuren und Farben',figures)
    rivers='<h2>Münzen und Geldbeutel</h2><div class="grid">'+''.join(icon(a) for a in records('fernhandel') if a['name'] in ('river-coin','rich','poor'))+'</div><h2>Brücke – Belag in Spielerfarbe</h2><div class="table"><table><tr><th>Farbe</th><th>Detail</th><th>44 px</th><th>Straße zum Vergleich</th></tr>'
    for color,label in zip(COLORS,COLOR_LABELS):
        rivers+=f'<tr><th>{label}</th><td class="piece">'+image(f'pieces/papiercollage/bridge-{color}.png',280)+'</td><td>'+image(f'web/pieces/papiercollage/bridge-{color}.png',44)+'</td><td>'+image(f'web/pieces/papiercollage/road-{color}.png',44)+'</td></tr>'
    page('fernhandel','nachtrag-vorschau.html','Flussläufe – Brücke und Münzen',rivers+'</table></div>')
    page('seewege','nachtrag-vorschau.html','Neue Bedienelemente','<h2>Versetzen und Handeln</h2><div class="grid">'+''.join(icon(a) for a in records('seewege') if a['name'] in ('move-ship','trade'))+'</div>')
if __name__=='__main__':
    main()
