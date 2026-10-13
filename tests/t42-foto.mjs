// Foto einlesen (standardmäßig ausgeblendet; hier per APP_FEATURES eingeschaltet): Kamera/Galerie, Verkleinern, Laden, Fehler/Offline, Legende/ohne Legende, Jahr fragen,
// unsichere Tage, Korrektur, Behalten/Überschreiben, Kontingent, Übernehmen, Rückgängig, Abbrechen, Neuladen.
// Der Foto-Dienst läuft hier echt (foto-dienst/src/index.js) – im Testbetrieb (MOCK) mit Beispieldaten.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import worker from '../foto-dienst/src/index.js';
const SHOT=process.env.SHOT||'/tmp/claude-0/foto'; const fs=await import('fs'); fs.mkdirSync(SHOT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--disable-background-networking','--disable-sync','--no-first-run']});
const ok=(x,m)=>{ console.log((x?'✔ ':'✘ ')+m); if(!x) process.exitCode=1; }; const errs=[];
let mode='legend', delay=0, status=0, lastBody=null;
const API='https://foto.test';
async function ctxNew(dev,extra){ const c=await b.newContext({...dev,timezoneId:'Europe/Berlin',serviceWorkers:'block',...(extra||{})});
  await c.route('**/config.js',async r=>{ const res=await r.fetch(); r.fulfill({response:res,body:(await res.text()).replace('photoApi: ""','photoApi: "'+API+'"')+'\nwindow.APP_FEATURES=Object.assign(window.APP_FEATURES||{},{photo:true});'}); });
  await c.route(API+'/**',async r=>{ const q=r.request(); lastBody=q.postData(); if(delay) await new Promise(x=>setTimeout(x,delay));
    if(status){ const m={429:'Für heute sind alle Foto-Auswertungen aufgebraucht. Bitte morgen erneut versuchen.',502:'Das Foto konnte gerade nicht gelesen werden. Bitte später erneut versuchen.'}[status]; return r.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({error:'x',message:m})}); }
    const h=Object.fromEntries(Object.entries(q.headers())); h.origin='http://localhost:8765';
    const res=await worker.fetch(new Request(API+'/lesen?mock='+mode,{method:'POST',headers:h,body:lastBody}),{ALLOWED_ORIGINS:'http://localhost:8765',DAILY_LIMIT:'500',MOCK:'1'});
    r.fulfill({status:res.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:await res.text()}); });
  return c; }
const c=await ctxNew(devices['Pixel 7']); const p=await c.newPage();
p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error' && !/foto\.test|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) errs.push('console: '+m.text()); });
// großes Testbild 3200×2400 erzeugen
const big=await p.evaluate(()=>{ const c=document.createElement('canvas'); c.width=3200; c.height=2400; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,3200,2400); for(let i=0;i<400;i++){ x.fillStyle='hsl('+(i*37%360)+',60%,60%)'; x.fillRect((i*97)%3200,(i*53)%2400,120,90); } return c.toDataURL('image/png').split(',')[1]; }).catch(()=>null);
await p.goto('http://localhost:8765/'); await p.waitForTimeout(600);
for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap(); await p.waitForTimeout(150); }
const IMG=SHOT+'/plan.png'; fs.writeFileSync(IMG,Buffer.from(big||await p.evaluate(()=>{ const c=document.createElement('canvas'); c.width=3200; c.height=2400; return c.toDataURL('image/png').split(',')[1]; }),'base64'));
await p.evaluate(()=>{ S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['T','T','T','T','T',null,null]}]; S.vacPerYear=30; S.vacs=[]; S.ov={'2026-03-03':'K'}; save(); show('urlaub'); });
await p.waitForTimeout(300);
const state=()=>p.evaluate(()=>JSON.stringify({ov:S.ov,vacs:S.vacs,types:S.types}));
const s0=await state();
const fb=p.locator('#v-urlaub .plfoto'); ok(await fb.isVisible(),'Knopf „Foto einlesen“ in der Plan-Leiste');
{ const r=await p.evaluate(()=>{ const f=document.querySelector('#v-urlaub .plfoto').getBoundingClientRect(), u=document.querySelector('#v-urlaub .plu').getBoundingClientRect(); return {own:f.top>=u.bottom-1,h:f.height}; }); ok(r.own && r.h>=48,'Schmaler Bildschirm: eigene Zeile, ≥48 px ('+JSON.stringify(r)+')'); }
// Hinweis: Abbrechen → nichts passiert
await fb.tap(); await p.waitForTimeout(150); ok(/nicht gespeichert/.test(await p.locator('#ask').innerText()),'Einmaliger Hinweis zum Server');
await p.locator('#ask button',{hasText:'Abbrechen'}).tap(); ok(await p.evaluate(()=>lsGet('su_fotook')!=='1' && $('#sheet').hidden),'Hinweis abgebrochen: nichts gemerkt, nichts offen');
await fb.tap(); await p.locator('#ask button',{hasText:'Verstanden'}).tap(); await p.waitForTimeout(150);
ok(await p.evaluate(()=>lsGet('su_fotook')==='1'),'Bestätigung wird gemerkt');
const inCam=p.locator('#pan input[data-src=kamera]'), inGal=p.locator('#pan input[data-src=galerie]');
ok(await inCam.getAttribute('capture')==='environment' && await inCam.getAttribute('accept')==='image/*','„Foto aufnehmen“: Kamera (capture)');
ok(await inGal.getAttribute('capture')===null && await inGal.getAttribute('accept')==='image/*','„Bild auswählen“: Galerie');
await p.screenshot({path:SHOT+'/01-auswahl.png'});
await p.locator('#pan .fotocancel').tap(); await p.waitForTimeout(100); ok(await p.evaluate(()=>$('#sheet').hidden),'Auswahl: Abbrechen');
// zweites Mal: kein Hinweis mehr
await fb.tap(); await p.waitForTimeout(150); ok(await p.evaluate(()=>$('#ask')?$('#ask').hidden:true) && await inCam.count()===1,'Hinweis kommt nur einmal');
// Offline
await c.setOffline(true); await inGal.setInputFiles(IMG); await p.waitForTimeout(700);
ok(/Keine Verbindung\. Bitte später erneut versuchen\./.test(await p.locator('#foto').innerText()),'Offline: „Keine Verbindung …“');
ok(await state()===s0,'Offline: keine Daten verloren/verändert');
await p.screenshot({path:SHOT+'/02-offline.png'});
await c.setOffline(false);
// Erneut versuchen + Ladebildschirm + Verkleinerung
delay=1200; await p.locator('#foto button',{hasText:'Erneut versuchen'}).tap(); await p.waitForTimeout(300);
ok(/Foto wird gelesen …/.test(await p.locator('#foto').innerText()),'Ladebildschirm „Foto wird gelesen …“');
await p.screenshot({path:SHOT+'/03-laden.png'});
await p.waitForTimeout(1500); delay=0;
{ const j=JSON.parse(lastBody), buf=Buffer.from(j.image,'base64'); let w=0,h=0; for(let i=2;i<buf.length;){ if(buf[i]!==0xFF){ i++; continue; } const mk=buf[i+1]; if(mk>=0xC0&&mk<=0xC3){ h=buf.readUInt16BE(i+5); w=buf.readUInt16BE(i+7); break; } i+=2+buf.readUInt16BE(i+2); }
  ok(buf[0]===0xFF&&buf[1]===0xD8 && Math.max(w,h)===1600 && buf.length<4.5*1024*1024,'Verkleinert auf '+w+'×'+h+' JPEG, '+Math.round(buf.length/1024)+' KB (Original 3200×2400)'); }
// Legende erkannt
ok(/Legende erkannt/.test(await p.locator('#foto').innerText()),'Legende erkannt → Vorschläge');
ok(/Urlaub/.test(await p.locator('#foto .fleg').nth(0).innerText()) && /Krank/.test(await p.locator('#foto .fleg').nth(1).innerText()),'Vorschlag: grün = Urlaub, rot = Krank');
await p.screenshot({path:SHOT+'/04-legende.png'});
await p.locator('#foto button',{hasText:'Passt so'}).tap(); await p.waitForTimeout(200);
// Vorschau
const sum=await p.locator('#fotosum').innerText(); ok(/^20 Tage erkannt · 2 unsicher · 5 Urlaubstage, danach 25 übrig$/.test(sum),'Zusammenfassung: '+sum);
ok(await p.locator('#foto .fc.uns').count()===2 && await p.locator('#foto .fc.uns .fq').count()===2,'Unsichere Tage: gelber Rahmen + „?“');
ok(await p.locator('#foto .fc .fx').count()===1 && /schon belegt/.test(await p.locator('#foto .fotoconf').innerText()),'Konflikt mit bestehendem Eintrag (3.3. Krank)');
ok(await p.locator('#foto .fotoconf button[aria-pressed=true]').innerText()==='Behalten','Standard: Behalten');
ok(await state()===s0,'Vorschau: noch nichts gespeichert');
await p.screenshot({path:SHOT+'/05-vorschau.png'});
// Korrektur: 5.3. (unsicher, N) → Tagschicht
await p.locator('#foto .fc[data-s="2026-03-05"]').tap(); await p.waitForTimeout(100); ok(/unsicher/.test(await p.locator('#fotodlg').innerText()),'Tag antippen: Korrektur-Fenster');
await p.screenshot({path:SHOT+'/06-tag.png'});
await p.locator('#fotodlg .fopt',{hasText:'Tagschicht'}).tap(); await p.waitForTimeout(100);
ok(await p.locator('#foto .fc[data-s="2026-03-05"] .fck').innerText()==='T' && !(await p.locator('#foto .fc[data-s="2026-03-05"]').getAttribute('class')).includes('uns'),'Korrigiert: 5.3. = T, nicht mehr unsicher');
// Entfernen: 14.3.
await p.locator('#foto .fc[data-s="2026-03-14"]').tap(); await p.locator('#fotodlg button',{hasText:'Aus der Vorschau entfernen'}).tap(); await p.waitForTimeout(100);
ok(await p.locator('#foto .fc[data-s="2026-03-14"] .fck').count()===0 && /^19 Tage erkannt · 1 unsicher/.test(await p.locator('#fotosum').innerText()),'Entfernt: 14.3. · '+await p.locator('#fotosum').innerText());
// Konflikt einzeln: 3.3. überschreiben
await p.locator('#foto .fc[data-s="2026-03-03"]').tap(); await p.locator('#fotodlg .fotoseg button',{hasText:'Überschreiben'}).tap(); await p.waitForTimeout(100);
ok(await p.locator('#foto .fc[data-s="2026-03-03"] .fck').innerText()==='S','Konflikt einzeln: 3.3. wird überschrieben (S)');
// Alle behalten → wieder K
await p.locator('#foto .fotoconf button',{hasText:'Behalten'}).tap(); await p.waitForTimeout(100);
ok(await p.locator('#foto .fc[data-s="2026-03-03"] .fck').innerText()==='K','Für alle: Behalten → 3.3. bleibt Krank');
await p.locator('#foto .fotoconf button',{hasText:'Überschreiben'}).tap(); await p.waitForTimeout(100);
// Übernehmen
const rest0=await p.evaluate(()=>vacRest(2026));
await p.locator('#foto .fotook').tap(); await p.waitForTimeout(400);
const st1=await p.evaluate(()=>({ov3:S.ov['2026-03-03'],ov5:shiftOf('2026-03-05').id,ov24:S.ov['2026-03-24'],v:vacList().map(v=>v.a+'..'+v.e),rest:vacRest(2026),foto:!$('#foto')||$('#foto').hidden,undo:!!document.querySelector('#v-urlaub .fundo')}));
ok(st1.foto && st1.undo,'Übernommen: Vorschau zu, großes „Rückgängig“ sichtbar');
ok(st1.ov3==='S' && st1.ov5==='T' && st1.ov24==='K' && st1.v.join()==='2026-03-16..2026-03-20' && st1.rest===rest0-5,'Daten richtig: '+JSON.stringify(st1));
ok(await p.locator('#v-urlaub .plrest').innerText()===(rest0-5)+' Urlaubstage übrig','Resturlaub in der Leiste aktualisiert');
await p.screenshot({path:SHOT+'/07-uebernommen.png'});
// Neuladen: Daten + Rückgängig bleiben
await p.reload(); await p.waitForTimeout(700); await p.evaluate(()=>show('urlaub')); await p.waitForTimeout(200);
ok(await p.evaluate(()=>shiftOf('2026-03-05').id==='T' && vacList().length===1) && await p.locator('#v-urlaub .fundob').isVisible(),'Nach Neuladen: Daten da, „Rückgängig“ noch da');
await p.locator('#v-urlaub .fundob').tap(); await p.waitForTimeout(300);
ok(await state()===s0 && !(await p.locator('#v-urlaub .fundo').count()),'Rückgängig: alles wie vorher');
// Abbrechen beim Laden
delay=1500; await fb.tap(); await inGal.setInputFiles(IMG); await p.waitForTimeout(400); await p.locator('#foto button',{hasText:'Abbrechen'}).tap(); await p.waitForTimeout(1600); delay=0;
ok(await p.evaluate(()=>$('#foto').hidden) && await state()===s0,'Laden abgebrochen: zu, nichts geändert, kommt nicht zurück');
// Ohne Legende: je Markierung fragen; Abbrechen bei der Frage
mode='nolegend'; await fb.tap(); await inCam.setInputFiles(IMG); await p.waitForTimeout(600);
ok(/Was bedeutet das\?/.test(await p.locator('#foto').innerText()) && /grün markiert/.test(await p.locator('#foto').innerText()),'Ohne Legende: „Was bedeutet das?“ (Kamera)');
const opts=await p.locator('#foto .fopt').allInnerTexts(); ok(['Urlaub','Tagschicht','Spätschicht','Nachtschicht','Frühschicht','Krank','Frei','Ignorieren'].every(o=>opts.some(x=>x.includes(o))),'Optionen: '+opts.map(x=>x.replace(/\s+/g,' ').trim()).join(' | '));
await p.screenshot({path:SHOT+'/08-frage.png'});
await p.locator('#foto button',{hasText:'Abbrechen'}).tap(); ok(await p.evaluate(()=>$('#foto').hidden) && await state()===s0,'Frage abgebrochen: nichts geändert');
await fb.tap(); await inGal.setInputFiles(IMG); await p.waitForTimeout(600);
await p.locator('#foto .fopt',{hasText:'Urlaub'}).tap(); await p.waitForTimeout(100);
ok(/rot eingekreist/.test(await p.locator('#foto').innerText()),'Zweite Markierung wird einmal gefragt');
await p.locator('#foto .fopt',{hasText:'Ignorieren'}).tap(); await p.waitForTimeout(100);
ok(/^19 Tage erkannt/.test(await p.locator('#fotosum').innerText()) && await p.locator('#foto .fc[data-s="2026-03-24"] .fck').count()===0,'Ignoriert: 24.3. nicht in der Vorschau');
await p.locator('#foto .fotox').tap(); ok(await p.evaluate(()=>$('#foto').hidden) && await state()===s0,'Vorschau abgebrochen: nichts geändert');
// Jahr nicht lesbar
mode='noyear'; await fb.tap(); await inGal.setInputFiles(IMG); await p.waitForTimeout(600);
ok(/Welches Jahr zeigt das Foto\?/.test(await p.locator('#foto').innerText()),'Jahr unlesbar → Frage');
await p.screenshot({path:SHOT+'/09-jahr.png'});
await p.locator('#foto .fotoyears button',{hasText:'2027'}).tap(); await p.waitForTimeout(100); await p.locator('#foto button',{hasText:'Passt so'}).tap(); await p.waitForTimeout(100);
ok(await p.locator('#foto .fotomh').first().innerText()==='März 2027','Jahr übernommen: März 2027');
await p.locator('#foto .fotox').tap();
await fb.tap(); await inGal.setInputFiles(IMG); await p.waitForTimeout(600); await p.locator('#foto button',{hasText:'Abbrechen'}).tap(); ok(await p.evaluate(()=>$('#foto').hidden) && await state()===s0,'Jahr-Frage abgebrochen');
// Legende: Abbrechen; Legende ändern
mode='legend'; await fb.tap(); await inGal.setInputFiles(IMG); await p.waitForTimeout(600); await p.locator('#foto button',{hasText:'Abbrechen'}).tap(); ok(await p.evaluate(()=>$('#foto').hidden),'Legende abgebrochen');
// Kontingent überschritten → Warnung, Import trotzdem möglich
await p.evaluate(()=>{ S.vacPerYear=2; save(); }); const s2=await state();
await fb.tap(); await inGal.setInputFiles(IMG); await p.waitForTimeout(600);
await p.locator('#foto .fleg').nth(1).tap(); await p.locator('#foto .fopt',{hasText:'Frei'}).tap(); await p.waitForTimeout(100);
ok(/Frei/.test(await p.locator('#foto .fleg').nth(1).innerText()),'Legende geändert: rot = Frei');
await p.locator('#foto button',{hasText:'Passt so'}).tap(); await p.waitForTimeout(100);
ok(/reichen deine Urlaubstage nicht/.test(await p.locator('#foto').innerText()) && /es fehlen 3/.test(await p.locator('#fotosum').innerText()),'Kontingent: Warnung in der Vorschau');
await p.screenshot({path:SHOT+'/10-kontingent.png'});
await p.locator('#foto .fotook').tap(); await p.waitForTimeout(150); ok(/Urlaubskontingent/.test(await p.locator('#ask').innerText()),'Übernehmen: Rückfrage wegen Kontingent');
await p.locator('#ask button',{hasText:'Zurück'}).tap(); ok(await state()===s2 && await p.isVisible('#foto .fotook'),'„Zurück“: nichts gespeichert, Vorschau bleibt');
await p.locator('#foto .fotook').tap(); await p.locator('#ask button',{hasText:'Trotzdem übernehmen'}).tap(); await p.waitForTimeout(300);
ok(await p.evaluate(()=>vacRest(2026))===-3 && /zu viel/.test(await p.locator('#v-urlaub .plrest').innerText()),'Trotzdem übernommen: '+await p.locator('#v-urlaub .plrest').innerText());
await p.locator('#v-urlaub .fundob').tap(); await p.waitForTimeout(200); ok(await state()===s2,'Rückgängig auch hier');
// Fehler vom Dienst
status=429; await fb.tap(); await inGal.setInputFiles(IMG); await p.waitForTimeout(600);
ok(/aufgebraucht/.test(await p.locator('#foto').innerText()) && !(await p.locator('#foto button',{hasText:'Erneut versuchen'}).count()),'Tageslimit: klare Meldung, kein „Erneut“');
await p.locator('#foto button',{hasText:'Schließen'}).tap();
status=502; await fb.tap(); await inGal.setInputFiles(IMG); await p.waitForTimeout(600);
ok(/später erneut/.test(await p.locator('#foto').innerText()) && await p.locator('#foto button',{hasText:'Erneut versuchen'}).count()===1,'Serverfehler: Meldung + „Erneut versuchen“');
status=0; await p.locator('#foto button',{hasText:'Erneut versuchen'}).tap(); await p.waitForTimeout(600); ok(/Legende erkannt/.test(await p.locator('#foto').innerText()),'Erneut versuchen klappt');
await p.goBack().catch(()=>{}); await p.evaluate(()=>goBack()); await p.waitForTimeout(100); ok(await p.evaluate(()=>$('#foto').hidden),'Zurück-Taste schließt');
ok(await state()===s2,'Am Ende: keine Daten verloren');
await c.close();

// Bildschirmfotos: 3 Größen × normal/sehr groß × hell/dunkel (Plan-Leiste + Vorschau)
for(const [w,h] of [[360,640],[390,844],[412,915]]) for(const fsz of ['n','xl']) for(const th of ['light','dark']){
  mode='legend'; const cc=await ctxNew({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true},{colorScheme:th}); const q=await cc.newPage(); q.on('pageerror',e=>errs.push(w+fsz+th+': '+e.message));
  await q.goto('http://localhost:8765/'); await q.waitForTimeout(500); for(let i=0;i<6 && await q.isVisible('#onb');i++){ await q.locator('#onbbox button.pri').last().tap(); await q.waitForTimeout(120); }
  await q.evaluate(([fsz,th])=>{ lsSet('su_fs',fsz); lsSet('su_fotook','1'); S.theme=th; S.rots=[{id:'r',name:'x',start:'2026-01-05',pattern:['T','T','T','T','T',null,null]}]; S.ov={'2026-03-03':'K'}; S.vacs=[]; save(); applyTheme(); show('urlaub'); },[fsz,th]); await q.waitForTimeout(300);
  const tag=w+'x'+h+'-'+fsz+'-'+th; await q.screenshot({path:SHOT+'/plan-'+tag+'.png'});
  const r=await q.evaluate(()=>{ const f=document.querySelector('#v-urlaub .plfoto'); if(!f) return null; const b=f.getBoundingClientRect(); return {vis:b.bottom<=innerHeight&&b.top>=0,w:b.width,over:document.documentElement.scrollWidth>innerWidth}; });
  ok(r&&r.vis&&!r.over,tag+': Foto-Knopf sichtbar, kein Querscrollen');
  await q.locator('#v-urlaub .plfoto').tap(); await q.locator('#pan input[data-src=galerie]').setInputFiles(IMG); await q.waitForTimeout(600); await q.locator('#foto button',{hasText:'Passt so'}).tap(); await q.waitForTimeout(200);
  const v=await q.evaluate(()=>{ const o=$('#foto'); const cells=[...o.querySelectorAll('.fc')].map(x=>x.getBoundingClientRect()); const ok=document.querySelector('.fotook').getBoundingClientRect(); return {over:o.scrollWidth>o.clientWidth,minW:Math.min(...cells.map(x=>x.width)),minH:Math.min(...cells.map(x=>x.height)),btn:ok.height}; });
  ok(!v.over && v.minH>=48 && v.btn>=48,tag+': Vorschau passt (Zelle '+Math.round(v.minW)+'×'+Math.round(v.minH)+', Knopf '+Math.round(v.btn)+')');
  await q.screenshot({path:SHOT+'/vorschau-'+tag+'.png'}); await cc.close(); }
ok(!errs.length,'Keine Konsolenfehler'+(errs.length?': '+errs.join(' | '):''));
await b.close();
