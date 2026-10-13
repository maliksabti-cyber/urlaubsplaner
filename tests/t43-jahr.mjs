// Wochenleiste zeigt Einträge · Jahreskalender: Wochentage, dezente Randtage, Antippen und
// Gedrückthalten-und-Ziehen (auch über Monatsgrenzen), Ansicht bleibt immer im Jahr.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SHOT=process.env.SHOT||'/tmp/claude-0/jahr'; const fs=await import('fs'); fs.mkdirSync(SHOT,{recursive:true});
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--disable-background-networking','--disable-sync','--no-first-run']});
const ok=(x,m)=>{ console.log((x?'✔ ':'✘ ')+m); if(!x) process.exitCode=1; }; const errs=[];
async function page(opt,fsz,th){ const c=await b.newContext({timezoneId:'Europe/Berlin',serviceWorkers:'block',...opt,colorScheme:th||'light'}); const p=await c.newPage();
  p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/Failed to load resource|fonts\.g/.test(m.text())) errs.push('console: '+m.text()); });
  await p.goto('http://localhost:8765/'); await p.waitForTimeout(500); for(let i=0;i<6 && await p.isVisible('#onb');i++){ await p.locator('#onbbox button.pri').last().tap().catch(()=>p.locator('#onbbox button.pri').last().click()); await p.waitForTimeout(120); }
  await p.evaluate(([fsz,th])=>{ lsSet('su_fs',fsz||'n'); S.theme=th; S.rots=[]; S.vacPerYear=30; S.vacs=[]; const t=TODAY(), A=i=>addD(t,i);
    // nächste 7 Tage: F, S, N, K, Frei, Urlaub, nichts
    S.ov={[A(1)]:'F',[A(2)]:'S',[A(3)]:'N',[A(4)]:'K',[A(5)]:''}; save(); if([0,6].includes(parse(A(6)).getDay())) S.vacs.push({id:'v1',a:A(6),e:A(6),fixed:[A(6)]}); else addVac(A(6),A(6)); save(); applyTheme(); show('heute'); $('#toast').hidden=true; },[fsz,th]);
  await p.waitForTimeout(250); return p; }
const yearOpen=p=>p.evaluate(()=>!!document.querySelector('#v-urlaub .plyear') && ypU.pv==='y');

// 1) Wochenleiste
let p=await page({...devices['Pixel 7']});
const wk=await p.evaluate(()=>[...document.querySelectorAll('.hwd')].map(x=>{ const k=x.querySelector('.yps'), cs=getComputedStyle(k); return {t:k.textContent,bg:cs.backgroundColor,cls:k.className}; }));
const col=await p.evaluate(()=>{ const c=h=>{ const d=document.createElement('i'); d.style.color=h; document.body.append(d); const r=getComputedStyle(d).color; d.remove(); return r; }; return {F:c(typeOf('F').color),S:c(typeOf('S').color),N:c(typeOf('N').color),K:c(typeOf('K').color),U:c(vacColor())}; });
ok(wk.map(x=>x.t).join(',')==='F,S,N,K,–,U,','Kürzel: '+wk.map(x=>x.t||'(leer)').join(' '));
ok(wk[0].bg===col.F&&wk[1].bg===col.S&&wk[2].bg===col.N&&wk[3].bg===col.K&&wk[5].bg===col.U,'Farben wie im Kalender');
ok(/free/.test(wk[4].cls) && /none/.test(wk[6].cls) && wk[6].bg==='rgba(0, 0, 0, 0)','Frei als „–“, Tag ohne Eintrag leer/neutral');
{ const cal=await p.evaluate(()=>{ const t=TODAY(), r={}; for(let i=1;i<=7;i++){ const s=addD(t,i), c=plCell(ypU,s,parse(s).getMonth(),t,true); r[i]=(c.classList.contains('va')?'U':c.querySelector('.plk').textContent); } return Object.values(r).join(','); });
  ok(cal==='F,S,N,K,–,U,','Gleich wie Monatskalender: '+cal); }
await p.screenshot({path:SHOT+'/heute.png'});

// 2) Jahreskalender
await p.evaluate(()=>{ ypU.pv='y'; lsSet('su_pview','y'); ypU.yv=2026; show('urlaub'); }); await p.waitForTimeout(250);
ok(await yearOpen(p),'Jahresansicht offen');
ok(await p.locator('.plyear .plmg i.wd').count()===84 && (await p.locator('.plyear .plmini').first().locator('i.wd').allInnerTexts()).join(' ')==='Mo Di Mi Do Fr Sa So','Wochentags-Kürzel über den Tagen (12×7)');
{ const o=await p.evaluate(()=>{ const i=document.querySelector('.plyear .plmini:nth-child(10) i.out'); const n=document.querySelector('.plyear .plmini:nth-child(10) i:not(.out):not(.wd)'); return {out:document.querySelectorAll('.plyear i.out').length,op:+getComputedStyle(i).opacity,opn:+getComputedStyle(n).opacity}; });
  ok(o.out>20 && o.op<.5 && o.opn===1,'Randtage dezent ('+o.out+' Stück, Deckkraft '+o.op+')'); }
await p.screenshot({path:SHOT+'/jahr.png',fullPage:true});
const cell=s=>p.locator('.plyear i[data-s="'+s+'"]:not(.out)');
// kurzes Antippen: Tagesfenster, bleibt im Jahr
await cell('2026-10-21').click(); await p.waitForTimeout(200);
ok(await p.isVisible('#pan') && /21/.test(await p.locator('#pan h2').first().innerText()),'Kurz antippen: Tagesauswahl wie bisher');
await p.locator('#pan .dq',{hasText:'Spät'}).first().click(); await p.waitForTimeout(250);
ok(await p.evaluate(()=>S.ov['2026-10-21']==='S') && await yearOpen(p),'Nach dem Eintragen per Antippen: bleibt im Jahreskalender');
// Gedrückthalten + Ziehen (Maus) über Monatsgrenze
async function lpDrag(from,to,via){ await p.evaluate(s=>{ const c=document.querySelector('.plyear i[data-s="'+s+'"]:not(.out)'); window.scrollBy(0,c.getBoundingClientRect().top-160); },from); await p.waitForTimeout(100); const a=await cell(from).boundingBox(); await p.mouse.move(a.x+a.width/2,a.y+a.height/2); await p.mouse.down(); await p.waitForTimeout(650);
  for(const s of [...(via||[]),to]){ const bb=await cell(s).boundingBox(); await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:8}); await p.waitForTimeout(60); }
  const mid=await yearOpen(p); await p.mouse.up(); await p.waitForTimeout(300); return mid; }
const mid=await lpDrag('2026-10-26','2026-11-04',['2026-10-30','2026-11-02']);
ok(mid,'Während der Auswahl: im Jahreskalender');
const bar=await p.locator('#v-urlaub .plconf').innerText().catch(()=>'');
ok(/26\.\s*Okt.*4\.\s*Nov|26\.10\..*4\.11\./s.test(bar) && /Urlaubstage/.test(bar) && /danach \d+ übrig/.test(bar) && /Speichern/.test(bar) && /Ändern/.test(bar),'Bestätigungsleiste: '+bar.replace(/\s+/g,' '));
ok(await yearOpen(p) && await p.locator('.plyear i.sel').count()>=10,'Nach dem Loslassen: im Jahr, Zeitraum markiert');
await p.screenshot({path:SHOT+'/jahr-auswahl.png'});
await p.locator('#v-urlaub .plsave').click(); await p.waitForTimeout(300);
ok(await p.evaluate(()=>vacList().some(v=>v.a==='2026-10-26'&&v.e==='2026-11-04')) && await yearOpen(p) && !(await p.evaluate(()=>ypU.paint)),'Gespeichert, bleibt im Jahreskalender');
// Ändern
await lpDrag('2026-12-07','2026-12-09'); await p.locator('#v-urlaub .plchg').click(); await p.waitForTimeout(200);
ok(await yearOpen(p) && await p.evaluate(()=>ypU.paint&&!ypU.a),'„Ändern“: Auswahl neu, im Jahr'); await p.locator('#v-urlaub .plcancel').click(); await p.waitForTimeout(200);
ok(await yearOpen(p) && await p.evaluate(()=>!ypU.paint),'Abbrechen: im Jahr');
// „Urlaub eintragen“ mit Antippen: bleibt im Jahr
await p.locator('#v-urlaub .plu').click(); await p.waitForTimeout(200); ok(await yearOpen(p),'„Urlaub eintragen“: bleibt im Jahreskalender');
await cell('2026-12-14').click(); await cell('2026-12-16').click(); await p.waitForTimeout(200);
ok(/3 Urlaubstage/.test(await p.locator('#v-urlaub .plconf').innerText()) && await yearOpen(p),'Antippen Anfang/Ende → Bestätigungsleiste im Jahr');
await p.locator('#v-urlaub .plsave').click(); await p.waitForTimeout(250); ok(await p.evaluate(()=>vacList().some(v=>v.a==='2026-12-14')) && await yearOpen(p),'Gespeichert, im Jahr');
// „Schicht eintragen“: Antippen + Ziehen stempelt sofort, im Jahr
await p.locator('#v-urlaub .pls').click(); await p.waitForTimeout(200); ok(await yearOpen(p),'„Schicht eintragen“: bleibt im Jahreskalender');
await p.locator('#v-urlaub .plshb',{hasText:'Nacht'}).click(); await p.waitForTimeout(150);
await cell('2026-09-01').click(); await p.waitForTimeout(200); ok(await p.evaluate(()=>S.ov['2026-09-01']==='N') && await yearOpen(p),'Schicht per Antippen, im Jahr');
await lpDrag('2026-09-28','2026-10-02'); ok(await p.evaluate(()=>['2026-09-28','2026-09-30','2026-10-01','2026-10-02'].every(d=>S.ov[d]==='N')) && await yearOpen(p),'Schicht per Gedrückthalten-und-Ziehen über Monatsgrenze, im Jahr');
await p.locator('#v-urlaub .plcancel').click(); await p.waitForTimeout(200);
// Touch (echte Fingergesten über CDP): halten, ziehen, Seite scrollt nicht weg
{ const cdp=await p.context().newCDPSession(p); const pt=async s=>{ const bb=await cell(s).boundingBox(); return {x:bb.x+bb.width/2,y:bb.y+bb.height/2}; };
  const a=await pt('2027-01-01').catch(()=>null); await p.evaluate(()=>{ ypU.yv=2027; render(); }); await p.waitForTimeout(200);
  await p.evaluate(()=>{ const c=document.querySelector('.plyear i[data-s="2027-01-27"]:not(.out)'); window.scrollBy(0,c.getBoundingClientRect().top-160); }); await p.waitForTimeout(100); const A=await pt('2027-01-27'), B=await pt('2027-02-03'); const sy=await p.evaluate(()=>scrollY);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[A]}); await p.waitForTimeout(600);
  for(let k=1;k<=10;k++){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:A.x+(B.x-A.x)*k/10,y:A.y+(B.y-A.y)*k/10}]}); await p.waitForTimeout(30); }
  const midT=await yearOpen(p); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await p.waitForTimeout(300);
  const bt=await p.locator('#v-urlaub .plconf').innerText().catch(()=>'');
  ok(midT && await yearOpen(p) && /27\.\s*Jan.*3\.\s*Feb|27\.1\..*3\.2\./s.test(bt) && Math.abs(await p.evaluate(()=>scrollY)-sy)<40,'Finger: halten + ziehen 27.1.–3.2. (über Monatsgrenze), im Jahr: '+bt.replace(/\s+/g,' ').slice(0,60));
  await p.locator('#v-urlaub .plcancel').click().catch(()=>{}); await p.locator('#v-urlaub .plx').click().catch(()=>{}); await p.waitForTimeout(200);
  // kurzer Finger-Tipp: Tagesfenster, im Jahr
  const C=await pt('2027-03-10'); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[C]}); await p.waitForTimeout(80); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await p.waitForTimeout(300);
  ok(await p.isVisible('#pan') && await yearOpen(p),'Finger kurz tippen: Tagesfenster, im Jahr'); await p.evaluate(()=>closeSheet()); }
// Monatsname öffnet weiterhin den Monat
await p.locator('.plyear .plminih').nth(4).click(); await p.waitForTimeout(200); ok(await p.evaluate(()=>ypU.pv==='m' && ypU.one%12===4),'Monatsname antippen öffnet den Monat (wie bisher)');
await p.context().close();

// 3) Alle Größen, Schrift, Hell/Dunkel
for(const [w,h] of [[360,640],[390,844],[412,915]]) for(const fsz of ['n','xl']) for(const th of ['light','dark']){
  const tag=w+'x'+h+'-'+fsz+'-'+th, q=await page({viewport:{width:w,height:h},deviceScaleFactor:2,isMobile:true,hasTouch:true},fsz,th);
  const r1=await q.evaluate(()=>({over:document.documentElement.scrollWidth>innerWidth,n:[...document.querySelectorAll('.hwd .yps')].map(x=>x.textContent).join(',')}));
  ok(!r1.over && r1.n==='F,S,N,K,–,U,',tag+': Wochenleiste '+r1.n); await q.screenshot({path:SHOT+'/heute-'+tag+'.png'});
  await q.evaluate(()=>{ ypU.pv='y'; lsSet('su_pview','y'); show('urlaub'); }); await q.waitForTimeout(250);
  const r2=await q.evaluate(()=>{ const wd=document.querySelector('.plyear i.wd'), o=document.querySelector('.plyear i.out'), n=document.querySelector('.plyear i:not(.out):not(.wd)'); const cw=getComputedStyle(wd).color, nb=getComputedStyle(n);
    return {over:document.documentElement.scrollWidth>innerWidth,wd:wd.getBoundingClientRect().width>0&&cw!=='rgba(0, 0, 0, 0)',out:+getComputedStyle(o).opacity}; });
  ok(!r2.over && r2.wd && r2.out<.5,tag+': Jahr mit Wochentagen + dezenten Randtagen, kein Querscrollen');
  // Auswahl per Finger im Jahr
  const cdp=await q.context().newCDPSession(q); const ny=new Date().getFullYear(); const sel=s=>q.locator('.plyear i[data-s="'+s+'"]:not(.out)');
  await q.evaluate(s=>{ const c=document.querySelector('.plyear i[data-s="'+s+'"]:not(.out)'); window.scrollBy(0,c.getBoundingClientRect().top-140); },ny+'-03-30'); await q.waitForTimeout(100); const A=await sel(ny+'-03-30').boundingBox(), B=await sel(ny+'-04-02').boundingBox(); const P=x=>({x:x.x+x.width/2,y:x.y+x.height/2});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[P(A)]}); await q.waitForTimeout(600); for(let k=1;k<=8;k++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:P(A).x+(P(B).x-P(A).x)*k/8,y:P(A).y+(P(B).y-P(A).y)*k/8}]}); await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await q.waitForTimeout(300);
  ok(await q.evaluate(()=>!!document.querySelector('.plyear')&&!!document.querySelector('#v-urlaub .plconf')),tag+': Auswahl über Monatsgrenze im Jahr');
  await q.evaluate(()=>scrollTo(0,0)); await q.screenshot({path:SHOT+'/jahr-'+tag+'.png'}); await q.context().close(); }
ok(!errs.length,'Keine Konsolenfehler'+(errs.length?': '+errs.join(' | '):''));
await b.close();
