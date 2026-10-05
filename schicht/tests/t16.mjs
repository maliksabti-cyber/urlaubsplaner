import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7']}); await c.addInitScript(()=>{ navigator.canShare=undefined; }); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(800);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(250); }
const heute=async()=>{ await p.evaluate(()=>{ closeSheet(); const a=document.querySelector('#ask'); if(a) a.hidden=true; show('heute'); document.querySelector('#toast').hidden=true; }); await p.waitForTimeout(120); };
await heute(); ok(/App einrichten/i.test(await p.locator('.guide h2').innerText()), 'Neuer Nutzer: Ziel „App einrichten“ startet automatisch');
await p.screenshot({path:'/tmp/claude-0/g1.png'});
await p.getByRole('button',{name:'Anderes Ziel wählen'}).tap(); await p.waitForTimeout(200);
ok(await p.locator('#pan .goalbtn').count()===8, '„Was möchtest du machen?“ mit 8 Zielen');
await p.screenshot({path:'/tmp/claude-0/g2.png'});
await p.locator('#pan .goalbtn',{hasText:'Urlaub fürs Jahr planen'}).tap(); await p.waitForTimeout(200);
ok(/Urlaub fürs Jahr planen/i.test(await p.locator('.guide h2').innerText()) && /Urlaubstage prüfen/.test(await p.locator('.guide .gnext b').innerText()), 'Ziel gewählt → Schritt 1 „Urlaubstage prüfen“');
await p.locator('.guide .btn.pri').tap(); await p.waitForTimeout(200); ok(!(await p.locator('#sheet').isHidden()), '„Los“ öffnet die Urlaubstage-Einstellung');
await heute(); await p.getByRole('button',{name:'✓ Erledigt'}).tap(); await p.waitForTimeout(150);
ok(/Bundesland/.test(await p.locator('.guide .gnext b').innerText()) && /1 von 8/.test(await p.locator('.guide .num').innerText()), '„Erledigt“ → nächster Schritt, 1 von 8');
await p.screenshot({path:'/tmp/claude-0/g3.png'});
// Jeder Schritt jedes Ziels: Knopf führt irgendwohin, ohne Fehler
const res=await p.evaluate(async()=>{ const out=[]; for(const g of GOALS){ for(const k of g.steps){ closeSheet(); const a=document.querySelector('#ask'); if(a) a.hidden=true; show('heute'); const before=view; let err=null;
    try{ await S_[k].go(); }catch(e){ err=e.message; } await new Promise(r=>setTimeout(r,180));
    const moved=!document.querySelector('#sheet').hidden || view!=='heute' || (document.querySelector('#ask')&&!document.querySelector('#ask').hidden) || !document.querySelector('#toast').hidden;
    out.push(g.id+':'+k+(err?' FEHLER '+err:moved?'':' (nichts passiert)')); } } return out; });
const bad=res.filter(x=>/FEHLER|nichts/.test(x)); ok(!bad.length, 'Alle '+res.length+' Schritt-Knöpfe führen direkt zum Ziel'+(bad.length?': '+bad.join(', '):''));
// Abschluss
await heute(); await p.evaluate(()=>{ S.goal='money'; S.pay={rate:20}; S.soll=37.5; save(); }); await heute();
ok(/Uhrzeiten/.test(await p.locator('.guide .gnext b').innerText()) && /2 von 4/.test(await p.locator('.guide .num').innerText()), 'Verdienst-Ziel: Lohn+Soll automatisch abgehakt (2 von 4), nächster: Uhrzeiten');
await p.getByRole('button',{name:'✓ Erledigt'}).tap(); await p.waitForTimeout(150); ok(/Statistik ansehen/.test(await p.locator('.guide .gnext b').innerText()),'dann: Statistik ansehen'); await p.getByRole('button',{name:'✓ Erledigt'}).tap(); await p.waitForTimeout(150);
ok(/Geschafft/.test(await p.locator('.guide').innerText()), 'Alle erledigt → „Geschafft!“');
await p.getByRole('button',{name:'Ziel abschließen'}).tap(); await p.waitForTimeout(150);
ok(/App einrichten|Was möchtest du machen/i.test(await p.locator('.guide h2').innerText()), 'Nach Abschluss: zurück zu Einrichtung bzw. Zielauswahl');
await p.locator('#help').tap(); await p.waitForTimeout(150); await p.getByRole('button',{name:/Was möchtest du machen/}).tap(); await p.waitForTimeout(150);
ok(await p.locator('#pan .goalbtn').count()===8, 'Auch über ? erreichbar');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
