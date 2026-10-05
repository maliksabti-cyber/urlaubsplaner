// Runde 1: Urlaub über den Jahreswechsel richtig zählen + Resturlaub automatisch übernehmen
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7']}); const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
// Mo–Fr Tagschicht, fester Rhythmus; Jahre in der Zukunft, damit der Test nicht vom heutigen Datum abhängt
const Y=new Date().getFullYear()+1;
await p.evaluate(()=>{ setSel(false); S.rots=[{id:'r',name:'x',start:'2024-01-01',pattern:['F','F','F','F','F',null,null]}]; S.guide={hide:true,pickhide:true}; S.newsSeen=9; S.vacs=[]; S.carry={}; S.vacPerYear=30; S.holFree=true; save(); show('heute'); document.querySelector('#toast').hidden=true; });
// Urlaub eintragen 28.12.Y – 8.1.Y+1
await p.evaluate(()=>openVac()); await p.waitForTimeout(200);
await p.fill('#vfrom',Y+'-12-28'); await p.dispatchEvent('#vfrom','input'); await p.fill('#vto',(Y+1)+'-01-08'); await p.dispatchEvent('#vto','input'); await p.waitForTimeout(150);
const exp=await p.evaluate(([a,e])=>{ const r=vacCount(a,e); return {n:r.n, ys:vacYears(r.days)}; },[Y+'-12-28',(Y+1)+'-01-08']);
const txt=(await p.locator('.vrest').innerText()).replace(/\s+/g,' ');
ok(exp.ys.length===2 && txt.includes('Jahreswechsel') && txt.includes(Y+': '+exp.ys[0].n) && txt.includes((Y+1)+': '+exp.ys[1].n), 'Hinweis teilt Tage je Jahr auf: '+txt);
await p.locator('#pan').getByRole('button',{name:'Eintragen'}).tap(); await p.waitForTimeout(300);
const tt=await p.locator('#toastt').innerText();
ok(tt.startsWith(exp.n+' Urlaubstage'), 'Meldung zählt alle Tage beider Jahre ('+exp.n+'): '+tt);
ok(await p.evaluate(([y])=>vacUsed(y)+vacUsed(y+1),[Y])===exp.n, 'Gespeichert: Summe beider Jahre stimmt');
// Urlaubsrechner-Kalender: gleiche Aufteilung
await p.evaluate(()=>{ S.vacs=[]; save(); }); 
const pick=await p.evaluate(([y])=>{ const box=vacPicker(y,null); document.body.append(box); return true; },[Y]);
// Resturlaub: Urlaub im Jahr Y eintragen, dann Jahr Y+1 ansehen
await p.evaluate(([y])=>{ document.querySelector('#vpick')?.remove(); const m=mondayOnOrBefore(y+'-03-10'); S.vacs=[{id:'a',a:m,e:addD(m,4)}]; save(); uY=y+1; show('urlaub'); },[Y]); await p.waitForTimeout(200);
const pr1=await p.evaluate(([y])=>vacTotal(y)-vacUsed(y),[Y]);
ok(await p.locator('#carryhint').isVisible() && new RegExp('noch '+pr1+' Tage übrig').test(await p.locator('#carryhint').innerText()), 'Urlaub '+(Y+1)+': Hinweis „noch '+pr1+' Tage übrig“ aus '+Y);
await p.locator('#carryhint').getByRole('button',{name:'Übernehmen'}).tap(); await p.waitForTimeout(200);
ok(await p.evaluate(([y])=>vacTotal(y+1),[Y])===30+pr1 && await p.locator('#carryhint').count()===0, 'Übernommen: Anspruch '+(Y+1)+' = '+(30+pr1));

await p.evaluate(([y])=>{ const m=mondayOnOrBefore(y+'-05-12'); S.vacs.push({id:'b',a:m,e:addD(m,4)}); save(); render(); },[Y]); await p.waitForTimeout(100);
const pr2=await p.evaluate(([y])=>vacTotal(y)-vacUsed(y),[Y]);
ok(pr2<pr1 && await p.evaluate(([y])=>vacTotal(y+1),[Y])===30+pr2 && new RegExp(pr2+' Tage Rest').test(await p.locator('#v-urlaub').innerText()), 'Mehr Urlaub in '+Y+' → Rest passt sich an ('+(30+pr2)+')');
// Leeres Vorjahr: kein Hinweis
await p.evaluate(([y])=>{ uY=y+3; renderUrlaub(); },[Y]);
ok(await p.locator('#carryhint').count()===0, 'Kein Hinweis, wenn im Vorjahr nichts eingetragen ist');
// Nein = kein Hinweis mehr; Einstellen-Fenster bietet Übernehmen an
await p.evaluate(([y])=>{ delete S.carryAuto[y+1]; save(); uY=y+1; renderUrlaub(); },[Y]); await p.locator('#carryhint').getByRole('button',{name:'Nein'}).tap(); await p.waitForTimeout(100);
ok(await p.locator('#carryhint').count()===0 && await p.evaluate(([y])=>vacTotal(y+1),[Y])===30, '„Nein“ blendet aus, Anspruch bleibt 30');
await p.evaluate(([y])=>openVacSettings(y+1),[Y]); await p.waitForTimeout(150); await p.locator('#vs_take').tap(); await p.waitForTimeout(80);
ok(await p.inputValue('#vs_carry')===String(pr2), 'Urlaub einstellen: „Rest übernehmen“ füllt '+pr2+' ein');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
