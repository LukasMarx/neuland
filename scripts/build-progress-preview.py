"""Review Stadtwacht III and optional artwork, using the saved delivery manifest."""
from pathlib import Path
import json
from html import escape
ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT/'output/designs/stadtwacht-2026-10-23'
STYLE = '''*{box-sizing:border-box}body{margin:0;background:#f3eddf;color:#332b20;font:16px/1.5 "Nunito Sans",sans-serif}main{max-width:1320px;margin:auto;padding:32px}h1{font-size:36px;line-height:1.2}h2{margin-top:36px}p{color:#73654e}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:18px}.asset{background:#e7ddc7;padding:15px;border-radius:12px;text-align:center;border-top:5px solid var(--color,#ae9d77)}.art{height:170px;display:flex;align-items:center;justify-content:center}.art img{max-width:100%;max-height:160px}.card .art{height:260px}.card .art img{max-height:250px}.sample{display:flex;gap:18px;align-items:center;justify-content:center;min-height:72px}.sample img{object-fit:contain}.path{font:11px/1.4 monospace;overflow-wrap:anywhere;color:#75664e}h3{font-size:16px;margin:12px 0 8px}.smallcard{display:inline-flex;width:78px;height:108px;flex-direction:column;overflow:hidden;border-radius:5px;background:#fff8e8;border:1px solid #b8a88b;font-size:9px;line-height:1.1}.smallcard img{width:78px;height:58px;object-fit:cover}.smallcard span{padding:5px 2px}.smallcard i{display:block;width:80%;height:2px;margin:3px auto;background:#d4c7af}button{font:inherit;padding:8px 16px;background:#fff9ed;border:1px solid #b7a88a;border-radius:8px;cursor:pointer}.checker .art,.checker .sample{background-color:#fff;background-image:conic-gradient(#ddd 25%,transparent 0 50%,#ddd 0 75%,transparent 0);background-size:20px 20px}.pending{color:#8c795c}.colors{display:flex;flex-wrap:wrap;gap:18px}.colors figure{margin:0;text-align:center}.colors img{width:100px}.colors figcaption{font-size:13px}nav{display:flex;gap:20px;flex-wrap:wrap}a{color:#72542d}.table{overflow:auto}'''
def img(path,width=None):
    return '<img alt="'+escape(path.split('/')[-1])+'" src="../../../public/'+path+'"'+(f' style="width:{width}px"' if width else '')+'>'
def asset(a):
    path=a['path'].removeprefix('public/')
    color={'market':'#d0a12b','council':'#3d6fb0','scholars':'#4e8052'}.get(a.get('direction'),'#ae9d77')
    exists=(ROOT/a['path']).exists()
    art=img(path) if exists else '<span class="pending">In Vorbereitung</span>'
    sample=''
    if exists and a['kind']=='motif':
        sample='<div class="sample"><div class="smallcard">'+img('web/'+str(Path(path).with_suffix('.jpg')).replace('\\','/'))+'<span>'+escape(a['label'])+'</span><i></i><i></i></div><small>78 × 108 px</small></div>'
    elif exists and a['kind']=='icon':
        sample='<div class="sample">'+img('web/'+path,22)+'<small>22 px</small>'+img('web/'+path,32)+'<small>32 px</small></div>'
    elif exists and a['kind']=='back':
        sample='<div class="sample">'+img('web/'+str(Path(path).with_suffix('.jpg')).replace('\\','/'),52)+'<small>52 × 78 px</small></div>'
    return '<article class="asset '+('card' if a['kind']=='back' else '')+'" style="--color:'+color+'"><div class="art">'+art+'</div><h3>'+escape(a['label'])+'</h3>'+sample+'<div class="path">'+escape(path)+'</div></article>'
def main():
    data=json.loads((DESIGN/'prompts.json').read_text(encoding='utf-8-sig'))
    assets=data['assets']
    body='<p>25 Einflusskarten, drei Rückseiten, Händlerfigur und alle acht optionalen Motive. Die kleine Kartenvorschau ergänzt Namen als echten Text; das Bild bleibt textfrei.</p><button onclick="document.body.classList.toggle(\'checker\')">Transparenz prüfen</button>'
    body+='<nav style="margin-top:20px">'+''.join(f'<button onclick="showGroup(\'{key}\')">{label}</button>' for key,label in [('all','Alles'),('market','Markt'),('council','Rat'),('scholars','Gelehrte'),('backs','Rückseiten'),('extras','Zusatzmotive'),('trader','Händler')])+'</nav>'
    sections=[('market','Markt – Einflusskarten',lambda a:a['kind']=='motif' and a.get('direction')=='market'),('council','Rat – Einflusskarten',lambda a:a['kind']=='motif' and a.get('direction')=='council'),('scholars','Gelehrte – Einflusskarten',lambda a:a['kind']=='motif' and a.get('direction')=='scholars'),('backs','Rückseiten der Einflusskarten',lambda a:a['name'].startswith('back-')),('extras','Optionale Symbole und Banner',lambda a:a['kind']=='icon'),('extras','Würfelstapel',lambda a:a['name'].startswith('dice-deck'))]
    for group,title,predicate in sections:
        body+='<section data-group="'+group+'"><h2>'+title+'</h2><div class="grid">'+''.join(asset(a) for a in assets if predicate(a))+'</div></section>'
    body+='<section data-group="trader"><h2>Händlerfigur – Draufsicht und Spielerfarben</h2><div class="colors">'
    for color,label in [('red','Rot'),('blue','Blau'),('gold','Goldgelb'),('purple','Violett'),('white','Weiß'),('orange','Orange'),('green','Grün'),('brown','Braun'),('grey-light','Hellgrau'),('grey-dark','Dunkelgrau')]:
        path=f'pieces/papiercollage/trader-{color}.png'
        if (ROOT/'public'/path).exists():
            body+='<figure>'+img(path)+'<figcaption>'+label+'</figcaption><div class="sample">'+img('web/'+path,30)+'<small>30 px</small></div></figure>'
    body+='</div></section><script>function showGroup(group){document.querySelectorAll("section[data-group]").forEach(s=>s.hidden=group!=="all"&&s.dataset.group!==group)}</script>'
    html='<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stadtwacht III · Neuland</title><link rel="stylesheet" href="../../../public/fonts/nunito-sans/fonts.css"><style>'+STYLE+'</style><main><nav><a href="../stadtwacht-2026-10-22/vorschau.html">Stadtwacht I/II</a><a href="LIEFERUNG.md">Lieferübersicht</a><a href="prompts.json">Prompts</a></nav><h1>Stadtwacht III & zusätzliche Motive</h1><p>Papiercollage · Nunito Sans · 23.10.2026</p>'+body+'</main></html>'
    (DESIGN/'vorschau.html').write_text(html,encoding='utf-8')
if __name__=='__main__':
    main()
