function renderSheetsPage({data:DATA,mount,esc,fmt,sheetKey,stages}){
 const $=id=>document.getElementById(id);
 let stopPreviews;
 const scopeOptions=Object.entries(stages).filter(([,stage])=>stage.sheets)
  .map(([id,stage])=>`<option value="${id}">${esc(stage.title)}</option>`).join('');
 const normalize=value=>value.toLocaleLowerCase('ru').replace(/[‐‑‒–—−]/g,'-');
 const count=Object.keys(DATA.revisions).length;
 mount.innerHTML=`<div class="page-heading"><div><h2>Листы проекта</h2><div class="print-set"><a class="sheet-pdf" href="${DATA.print_album.file}" download>Скачать комплект А3 · ${DATA.print_album.pages} стр. · ${fmt(DATA.print_album.bytes/1e6,1)} МБ</a><a class="sheet-pdf" href="${esc(DATA.coordination_appendix.file)}" download>Скачать приложение · решения по узлам</a><small>Печать на А3, альбомная ориентация, масштаб 100 %.</small></div></div></div><div class="sheet-filters"><input type="search" id="sheet-search" placeholder="Найти лист, например КЖ-2" aria-label="Поиск листов"><label>Этап <select id="sheet-stage"><option value="">Весь дом</option>${scopeOptions}</select></label><label><input type="checkbox" id="revised-only"> Только с редакцией (${count})</label><output id="sheet-hits" aria-live="polite"></output></div><div class="sheets-grid" id="sheets-grid"></div>`;
 const render=()=>{
  stopPreviews?.();
  const term=normalize($('sheet-search').value.trim());
  const stage=stages[$('sheet-stage').value];
  const keys=stage&&new Set(stage.sheets.map(([s,p])=>sheetKey(s,p)));
  const hits=DATA.sheets.filter(s=>(!keys||keys.has(sheetKey(s.source_id,s.pdf_page)))&&(!$('revised-only').checked||DATA.revisions[sheetKey(s.source_id,s.pdf_page)])&&normalize([s.sheet,s.title,s.filename].join(' ')).includes(term));
  $('sheet-hits').textContent='Листов: '+hits.length;
  $('sheets-grid').innerHTML=hits.map(s=>{
   const key=sheetKey(s.source_id,s.pdf_page),rev=DATA.revisions[key];
   const thumb=DATA.thumbs?.[key];
   const preview=thumb?`data-preview="${thumb.small}" data-src="${thumb.large}"`:`loading="lazy" src="${rev?.image||DATA.images[key]}"`;
   return `<article class="sheet-group"><button class="sheet-card" data-sheet="${key}"><img ${preview} decoding="async" alt="Оцифрованный лист · ${esc(s.sheet||s.title)}"><span class="sheet-body"><span class="eyebrow">${esc(s.sheet||'Приложение')} / PDF ${s.pdf_page}</span><b>${esc(s.title)}</b><small>${DATA.print_sheets[key].typeset?'Чертёж с наборным текстом':'Контурная копия'} · стр. ${DATA.print_sheets[key].folio} комплекта</small></span></button>${rev?`<button class="revision-card" data-sheet="${key}" data-edition="scan"><strong>${s.scan_reissue?'Скан проектировщика':'Исходный скан'} ↗</strong><small>${s.scan_reissue?'Исправленный АР-10 · 26.11.2026':'До изменений проекта'}</small></button>`:''}</article>`;
  }).join('')||'<p class="no-results">Лист не найден.</p>';
  stopPreviews=observePreviews(mount);
 };
 $('sheet-stage').onchange=render;$('sheet-search').oninput=render;$('revised-only').onchange=render;render();
}
// Decode the sharper image off-DOM so the small preview stays visible
// until its replacement is ready.
function observePreviews(mount){
 const images=mount.querySelectorAll('img[data-preview]');
 if(!images.length)return;
 const observer=new IntersectionObserver(entries=>{
  for(const {target,isIntersecting} of entries){
   if(!isIntersecting)continue;
   observer.unobserve(target);
   target.src=target.dataset.preview;
   const sharp=new Image();
   sharp.decoding='async';
   sharp.fetchPriority='low';
   target.decode().catch(()=>{}).then(()=>new Promise(requestAnimationFrame)).then(()=>{
    if(!target.isConnected||!mount.classList.contains('active')){
     if(target.isConnected)observer.observe(target);
     return;
    }
    sharp.src=target.dataset.src;
    return sharp.decode().then(()=>{if(target.isConnected)target.src=sharp.src;});
   }).catch(()=>{});
  }
 });
 for(const image of images)observer.observe(image);
 return ()=>observer.disconnect();
}

export { renderSheetsPage };
