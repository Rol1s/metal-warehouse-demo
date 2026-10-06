'use strict';
const Demo=(()=>{
 const key='metal-pages-demo-v1';let cached,dbPromise;
 const id=p=>p+'-'+crypto.randomUUID().slice(0,10),at=()=>new Date().toISOString();
 const number=(v,label,min=0,max=1e9,int=false)=>{const x=Number(String(v).replace(',','.'));if(v===null||v===undefined||v===''||!Number.isFinite(x)||x<min||x>max||(int&&!Number.isInteger(x)))throw Error(label+': проверьте значение');return x;};
 const cash=(v,label,min=0)=>{const x=number(v,label,min);if(Math.abs(x*100-Math.round(x*100))>1e-5)throw Error(label+': не более двух знаков после запятой');return Math.round(x*100)/100;};
 const round=v=>Math.round((v+Number.EPSILON)*100)/100;
 const text=v=>{const t=String(v||'').trim();if(!t||t.length>250)throw Error('Заполните название до 250 символов');return t;};
 const tons=(d,w,l)=>Math.PI*w*(d-w)*7850*l/1e9;
 const sum=(a,k)=>a.reduce((t,x)=>t+(x[k]||0),0);
 const find=(s,k,v)=>{const x=s[k].find(x=>x.id===v);if(!x)throw Error('Запись не найдена');return x;};
 const event=(s,kind,title,details={})=>s.events.unshift({id:id('op'),kind,title,details,at:at()});
 function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open(key,1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Хранилище браузера недоступно'));});}
 async function stored(){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('data'),r=t.objectStore('data').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Не удалось прочитать данные'));});}
 async function save(s){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('data','readwrite');t.objectStore('data').put(s,'state');t.oncomplete=()=>{cached=s;resolve();};t.onerror=()=>reject(Error('Не удалось сохранить. Проверьте свободное место в браузере'));t.onabort=()=>reject(Error('Сохранение прервано; операция не проведена'));});}
 async function seed(){const r=await fetch('./seed.json');if(!r.ok)throw Error('Не удалось загрузить демонстрацию');const s=await r.json();s.uploads={};return s;}
 async function read(){let s=await stored();if(!s){s=await seed();await save(s);}cached=s;return structuredClone(s);}
 function rows(a){if(!Array.isArray(a)||!a.length||a.length>500)throw Error('Добавьте от 1 до 500 строк');const r=a.map((v,i)=>{const diameter=number(v.diameter,'Диаметр',1,5000),wall=number(v.wall,'Стенка',.1,100);if(wall*2>=diameter)throw Error('Стенка должна быть меньше половины диаметра');return {diameter,wall,length:number(v.length,'Длина',.01,100),qty:number(v.qty,'Количество',1,2000,true),seams:number(v.seams,'Поперечные швы',0,20,true)};});if(sum(r,'qty')>2000)throw Error('Не более 2000 труб в приёмке');return r;}
 function parse(raw){let d=null,a=[],unmatched=[];for(const line0 of raw.replace(/[×хХ]/g,'x').split('\n')){const line=line0.replace(/^\s*\d+[).]\s*/,'').trim();if(!line)continue;const h=line.match(/^(?:труба\s*)?(\d{3,4})(?:\s*мм)?$/i);if(h){d=Number(h[1]);continue;}let f=line.match(/^(\d{3,4})\s*x\s*(\d+(?:[.,]\d+)?)\s+(?:длина\s*)?(\d+(?:[.,]\d+)?)/i),c=line.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i),diameter,wall,length,tail;const cv=v=>Number(v.replace(',','.'));if(f){diameter=cv(f[1]);wall=cv(f[2]);length=cv(f[3]);tail=line.slice(f[0].length);}else if(c&&d){diameter=d;length=cv(c[1]);wall=cv(c[2]);tail=line.slice(c[0].length);}else{unmatched.push(line0);continue;}const q=tail.match(/(?:шт\.?\s*(\d+)|(\d+)\s*шт)/i),p=tail.match(/[ПпPp]\s*(\d+)|шв(?:ы|ов)?\s*(\d+)/);a.push({diameter,wall,length,qty:q?Number(q[1]||q[2]):1,seams:p?Number(p[1]||p[2]):null});}return {rows:a,unmatched};}
 async function act(action,p){const s=await read();let result={ok:true};
 if(action==='message'){
  const l=find(s,'lots',p.lot_id),raw=String(p.text||'').slice(0,30000),photo=p.photo;
  if(!raw.trim()&&!photo)throw Error('Добавьте сообщение или фото');
  if(photo&&(!/^data:image\/(png|jpeg|webp);base64,/.test(photo)||photo.length>14e6))throw Error('Загрузите фото до 10 МБ');
  const signature=photo||raw.trim().replace(/\s+/g,' ').toLowerCase();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature+l.id)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const old=s.messages.find(m=>m.hash===hash);if(old)return {id:old.id,duplicate:true};
  const parsed=parse(raw),photoName=photo?'photo-'+hash:null;if(photo)s.uploads[photoName]=photo;
  const m={id:id('msg'),title:String(p.title||'Новая ведомость').slice(0,250),text:raw,...parsed,lot_id:l.id,warehouse:l.warehouse,sector:'А-2',status:'draft',photo:photoName,sender:'Ручная загрузка',at:at(),hash,source:'Данные в вашем браузере',reviewed_at:null,posted_at:null};s.messages.unshift(m);event(s,'message','Сохранено сообщение: '+m.title,{message_id:m.id});result={id:m.id};
 }else if(action==='confirm'){
  const m=find(s,'messages',p.id);if(m.status!=='draft')throw Error('Документ уже подтверждён');const l=find(s,'lots',p.lot_id);Object.assign(m,{rows:rows(p.rows),lot_id:l.id,warehouse:l.warehouse,sector:text(p.sector),status:'confirmed',reviewed_at:at(),unmatched:[]});event(s,'confirm','Проверена ведомость: '+m.title,{message_id:m.id});result={id:m.id};
 }else if(action==='post'){
  const m=find(s,'messages',p.id);if(m.status==='posted')return {duplicate:true,id:m.id};if(m.status!=='confirmed')throw Error('Сначала подтвердите ведомость');const l=find(s,'lots',m.lot_id),ids=[];
  for(const r of rows(m.rows))for(let k=0;k<r.qty;k++){const t=tons(r.diameter,r.wall,r.length),rid=id('pipe');ids.push(rid);s.stock.push({...r,qty:1,id:rid,lot_id:l.id,warehouse:m.warehouse,sector:m.sector,status:'available',reserve:'',tons:t,cost:round(t*(l.rate+l.landing)),origin:m.id,parent:null,kind:'pipe',at:at(),work:'До обработки'});}
  Object.assign(m,{status:'posted',posted_at:at()});event(s,'receipt','Приход: '+m.title,{message_id:m.id,ids});result={id:m.id,count:ids.length};
 }else if(action==='lot'){
  const l={id:id('lot'),name:text(p.name),supplier:text(p.supplier),warehouse:text(p.warehouse),rate:cash(p.rate,'Закупка'),landing:cash(p.landing||0,'Доставка'),note:String(p.note||''),at:at()};s.lots.push(l);event(s,'lot','Создан лот: '+l.name,{lot_id:l.id});result={id:l.id};
 }else if(action==='payment'){
  const sale=find(s,'sales',p.id),paid=sum(s.payments.filter(x=>x.sale_id===sale.id),'amount'),amount=cash(p.amount,'Оплата',.01);if(amount>round(sale.revenue-paid))throw Error('Оплата больше долга');const payment={id:id('pay'),sale_id:sale.id,amount,at:at()};s.payments.push(payment);event(s,'payment','Оплата от '+sale.customer,payment);
 }else if(action==='stock'){
  if(!Array.isArray(p.ids)||!p.ids.length||new Set(p.ids).size!==p.ids.length)throw Error('Выберите записи без повторов');const a=p.ids.map(v=>find(s,'stock',v));if(a.some(x=>!['available','reserved'].includes(x.status)))throw Error('Металл уже выбыл со склада');const ids=p.ids,t=sum(a,'tons'),op=p.operation;
  if(op==='reserve'){if(a.some(x=>x.status!=='available'))throw Error('Труба уже в резерве');const customer=text(p.customer);a.forEach(x=>Object.assign(x,{status:'reserved',reserve:customer}));event(s,'reserve','Резерв: '+customer,{ids,tons:t});}
  else if(op==='release'){if(a.some(x=>x.status!=='reserved'))throw Error('Выберите только резерв');a.forEach(x=>Object.assign(x,{status:'available',reserve:''}));event(s,'release','Снят резерв',{ids});}
  else if(op==='move'){const warehouse=text(p.warehouse),sector=text(p.sector);a.forEach(x=>Object.assign(x,{warehouse,sector}));event(s,'move','Перемещение: '+warehouse+' / '+sector,{ids});}
  else if(op==='work'){const title=text(p.title),cost=cash(p.cost,'Стоимость');let remaining=cost;a.forEach((x,i)=>{const part=i===a.length-1?remaining:round(cost*x.tons/t);remaining=round(remaining-part);x.cost=round(x.cost+part);x.work=title;});const j={id:id('job'),title,ids,cost,tons:t,at:at()};s.jobs.unshift(j);event(s,'work','Выполнено: '+title,j);}
  else if(op==='cut'){
   if(a.length!==1||a[0].status!=='available')throw Error('Для резки выберите одну свободную трубу');const x=a[0];if(!Array.isArray(p.lengths)||p.lengths.length<2||p.lengths.length>20||p.seams.length!==p.lengths.length)throw Error('Укажите длины и швы всех отрезков');const lengths=p.lengths.map(v=>number(v,'Длина отрезка',.01,100)),seams=p.seams.map(v=>number(v,'Швы',0,20,true)),loss=number(p.loss,'Потеря',0,10),cost=cash(p.cost,'Резка');const meters=lengths.reduce((a,b)=>a+b,0);if(Math.abs(meters+loss-x.length)>.00001)throw Error('Отрезки и потеря должны равняться исходной длине');const loss_cost=round(x.cost*loss/x.length),value=round(x.cost-loss_cost+cost),children=[];let remaining=value;
   lengths.forEach((length,i)=>{const share=i===lengths.length-1?remaining:round(value*length/meters);remaining=round(remaining-share);const child={...x,id:id('pipe'),length,seams:seams[i],tons:tons(x.diameter,x.wall,length),cost:share,parent:x.id,at:at(),work:'Резка выполнена'};children.push(child.id);s.stock.push(child);});x.status='transformed';const j={id:id('job'),title:'Резка',ids,children,cost,loss,loss_tons:tons(x.diameter,x.wall,loss),loss_cost,at:at()};s.jobs.unshift(j);event(s,'cut','Резка с сохранением происхождения',j);
  }else if(op==='ship'){
   const customer=text(p.customer),direction=p.direction;if(!['Деловой 1','Деловой 2','Лом'].includes(direction))throw Error('Выберите направление');if(a.some(x=>x.status==='reserved'&&x.reserve!==customer))throw Error('Металл в резерве другого покупателя');const rate=cash(p.rate,'Цена',.01),paid=cash(p.paid||0,'Оплата'),revenue=round(t*rate),cost=round(sum(a,'cost'));if(paid>revenue)throw Error('Оплата больше суммы продажи');const sale={id:id('sale'),ids,customer,direction,tons:t,rate,revenue,cost,margin:round(revenue-cost),at:at()};a.forEach(x=>Object.assign(x,{status:'shipped',sale_id:sale.id}));s.sales.unshift(sale);if(paid)s.payments.push({id:id('pay'),sale_id:sale.id,amount:paid,at:at()});event(s,'ship','Отгрузка: '+customer,sale);
  }else if(op==='writeoff'){
   if(a.some(x=>x.status==='reserved'))throw Error('Сначала снимите резерв');const reason=text(p.reason);if(!['loss','scrap'].includes(p.method))throw Error('Выберите результат');const children=[];a.forEach(x=>{x.status='writtenoff';if(p.method==='scrap'){const c={...x,id:id('scrap'),kind:'scrap',status:'available',parent:x.id,reserve:'',work:'Лом',at:at()};children.push(c.id);s.stock.push(c);}});event(s,'writeoff','Списание: '+reason,{ids,method:p.method,children,tons:t,loss_cost:p.method==='loss'?round(sum(a,'cost')):0});
  }else throw Error('Неизвестная операция');
 }else throw Error('Неизвестное действие');
 await save(s);return result;
 }
 function photo(name){return name==='sample.svg'?'./sample.svg':cached?.uploads?.[name]||'';}
 function download(body,name,mime){const u=URL.createObjectURL(new Blob([body],{type:mime})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 async function excel(){const s=await read(),wb=XLSX.utils.book_new();const append=(name,headers,rows)=>{const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);ws['!cols']=headers.map(()=>({wch:22}));XLSX.utils.book_append_sheet(wb,ws,name);return ws;};
 const detail=[];for(const m of s.messages.filter(m=>m.status!=='draft'))for(const r of m.rows)detail.push([m.id,m.at,find(s,'lots',m.lot_id).name,m.warehouse,r.diameter,r.wall,r.length,r.qty,r.seams,tons(r.diameter,r.wall,r.length)*r.qty,m.status]);
 const ws=append('Проверенные ведомости',['Документ','Дата','Лот','Склад','Диаметр','Стенка','Длина','Труб','Швы','Вес, т','Статус'],detail);detail.forEach((r,i)=>{const j=i+2;ws['J'+j]={t:'n',v:r[9],f:`PI()*F${j}*(E${j}-F${j})*7850*G${j}*H${j}/1000000000`,z:'0.000'};});
 append('Остатки',['ID','Диаметр','Стенка','Длина','Швы','Вид','Лот','Склад','Статус','Вес, т','Стоимость'],s.stock.filter(x=>['available','reserved'].includes(x.status)).map(x=>[x.id,x.diameter,x.wall,x.length,x.seams,x.kind,find(s,'lots',x.lot_id).name,x.warehouse,x.status,x.tons,x.cost]));
 append('Продажи',['Покупатель','Направление','Вес','Выручка','Себестоимость','Маржа','Оплачено','Долг'],s.sales.map(x=>{const p=sum(s.payments.filter(v=>v.sale_id===x.id),'amount');return [x.customer,x.direction,x.tons,x.revenue,x.cost,x.margin,p,round(x.revenue-p)]}));
 append('Оплаты',['Дата','Продажа','Сумма'],s.payments.map(x=>[x.at,x.sale_id,x.amount]));append('Лоты',['Лот','Поставщик','Склад','Цена','Доставка'],s.lots.map(x=>[x.name,x.supplier,x.warehouse,x.rate,x.landing]));append('Операции',['Дата','Описание'],s.events.map(x=>[x.at,x.title]));
 append('О демо',['Правило','Значение'],[['Данные','Вымышленная демонстрация; изменения только в браузере'],['Вес','Расчётный, 7850 кг/м³'],['Финансы','Управленческая модель без налогов и общих расходов']]);
 XLSX.writeFile(wb,'metal-demo.xlsx',{compression:true});
 }
 document.addEventListener('click',async e=>{const a=e.target.closest('a');if(a&&a.getAttribute('href')?.startsWith('./api/')){e.preventDefault();const path=a.getAttribute('href').slice(6);try{if(path==='export.xlsx')return await excel();const s=await read();if(path==='backup')return download(JSON.stringify(s,null,2),'metal-demo.json','application/json');const [type,mId]=path.split('/'),m=find(s,'messages',mId);if(type==='structured')download(JSON.stringify(m,null,2),'document.json','application/json');else download(m.status==='draft'?m.text:m.rows.map((r,i)=>`${i+1}) ${r.diameter} × ${r.wall} мм; ${r.length} м; ${r.qty} труб; ${r.seams} швов`).join('\n'),'transcript.txt','text/plain;charset=utf-8');}catch(err){alert(err.message);}}const reset=e.target.closest('[data-action="reset-demo"]');if(reset&&confirm('Начать показ заново? Изменения этой демонстрации в вашем браузере будут сброшены.')){try{await save(await seed());location.reload();}catch(err){alert(err.message);}}},true);
 return {read,act,photo,excel};
})();
