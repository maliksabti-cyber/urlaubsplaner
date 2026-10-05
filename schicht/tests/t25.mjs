// Runde 2: Tag-Fenster ohne doppeltes „F“, klarer Rhythmus-Hinweis, Urlaubsantrag als PDF
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
const c = await b.newContext({...devices['Pixel 7'], acceptDownloads:true}); await c.addInitScript(()=>{ navigator.canShare=undefined; });
const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const ok=(c,m)=>console.log((c?'✔ ':'✘ ')+m);
await p.goto('http://localhost:8765/schicht/'); await p.waitForTimeout(700);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(200); }
const Y=new Date().getFullYear()+1;
await p.evaluate(()=>{ setSel(false); S.rots=[{id:'r',name:'Mo-Fr',start:'2024-01-01',pattern:['F','F','F','F','F',null,null]}]; S.tpls=[]; S.ov={}; S.vacs=[]; S.name='Anna Test'; S.guide={hide:true,pickhide:true}; S.newsSeen=9; S.holFree=true; save(); show('heute'); document.querySelector('#toast').hidden=true; });
// 1) Tag-Fenster: nur ein „Frei“-Knopf
const mon=await p.evaluate(([y])=>mondayOnOrBefore(y+'-03-10'),[Y]);
await p.evaluate(s=>openDay(s),mon); await p.waitForTimeout(150);
ok(await p.locator('#pan .pick button[aria-label="Frei"]').count()===1, 'Tag-Fenster zeigt „Frei“ nur einmal');
await p.locator('#pan .pick button[aria-label="Frei"]').tap(); await p.waitForTimeout(150);
ok(await p.evaluate(s=>dayKind(s)==='f',mon) && await p.locator('#pan .pick button[aria-label="Frei"]').getAttribute('aria-pressed')==='true', 'Frei antippen: Tag ist frei und „Frei“ markiert');
const sat=await p.evaluate(s=>addD(s,5),mon); await p.evaluate(s=>openDay(s),sat); await p.waitForTimeout(100);
ok(await p.locator('#pan .pick button[aria-label="Frei"]').getAttribute('aria-pressed')==='true', 'Samstag (laut Plan frei): „Frei“ ist markiert');
await p.locator('#pan .pick button[aria-label="Frei"]').tap(); await p.waitForTimeout(100);
ok(await p.evaluate(s=>!Object.prototype.hasOwnProperty.call(S.ov,s),sat), 'Frei auf freiem Tag: keine unnötige Abweichung gespeichert');
// 2) Rhythmus-Fenster: kein widersprüchliches „Noch kein Rhythmus“
await p.evaluate(()=>{ closeSheet(); openRotations(); }); await p.waitForTimeout(150);
const rt=await p.locator('#pan').innerText();
ok(!/Noch kein Rhythmus angelegt/.test(rt) && /Noch keine Vorlage gespeichert/.test(rt), 'Mein Rhythmus: Hinweis passt, wenn nur ein Rhythmus im Kalender steht');
// 3) Urlaubsantrag
await p.evaluate(([y])=>{ closeSheet(); const m=mondayOnOrBefore(y+'-03-17'); S.vacs=[{id:'v1',a:m,e:addD(m,11)}]; save(); uY=y; show('urlaub'); },[Y]); await p.waitForTimeout(200);
await p.locator('#v-urlaub .vrow').first().tap(); await p.waitForTimeout(150);
ok(await p.locator('#antrag').isVisible(), 'Urlaub antippen: Knopf „Urlaubsantrag für den Chef (PDF)“');
const [dl]=await Promise.all([p.waitForEvent('download'), p.locator('#antrag').tap()]);
const path='/tmp/claude-0/antrag.pdf'; await dl.saveAs(path); const pdf=fs.readFileSync(path,'latin1');
const exp=await p.evaluate(()=>{ const v=S.vacs[0]; return {n:vacDaysOf(v).length, a:fmt(v.a), e:fmt(v.e)}; });
ok(/^Urlaubsantrag_\d{4}-\d\d-\d\d_bis_\d{4}-\d\d-\d\d\.pdf$/.test(dl.suggestedFilename()), 'Datei: '+dl.suggestedFilename());
ok(pdf.startsWith('%PDF') && pdf.includes('(Urlaubsantrag)') && pdf.includes('(Anna Test)') && pdf.includes('('+exp.a+')') && pdf.includes('('+exp.n+' Tage \\(12 Kalendertage\\))'), 'PDF enthält Name, Datum und '+exp.n+' Urlaubstage');
ok(pdf.includes('(genehmigt)') && pdf.includes('(Unterschrift Vorgesetzte/r)'), 'PDF hat Felder für Genehmigung und Unterschrift');
ok(errs.length===0,'Keine Skriptfehler '+errs.join('|')); await b.close();
