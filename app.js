const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
let user='', state=null, timer=null, seconds=1500, mode='focus', audioCtx=null, ambience=null;
const defaultState=(name='Mohammed')=>({profile:{name,bio:'Personal Operating System',xp:0,streak:1,lastActive:today(),focusMinutes:25,breakMinutes:5,theme:'dark'},spaces:[{id:'uni',name:'University',color:'#35d7ff'},{id:'dev',name:'Coding',color:'#7c3aed'},{id:'life',name:'Personal',color:'#ffc078'},{id:'fivem',name:'FiveM',color:'#39d98a'}],tasks:[{id:uid(),title:'حدد أهم شيء اليوم',space:'Personal',priority:'High',date:today(),done:false,pinned:true},{id:uid(),title:'جلسة تركيز 25 دقيقة',space:'Coding',priority:'Medium',date:today(),done:false}],notes:{[today()]:''},activity:{},sessions:0});
function key(){return 'navox_'+user.toLowerCase()} function save(){localStorage.setItem(key(),JSON.stringify(state));render()} function load(name){user=name;state=JSON.parse(localStorage.getItem(key())||'null')||defaultState(name); state.profile={...defaultState(name).profile,...state.profile}; state.spaces ||= defaultState(name).spaces; state.tasks ||= []; state.notes ||= {}; state.activity ||= {}; state.sessions ||=0; seconds=(state.profile.focusMinutes||25)*60; updateStreak(); applyTheme(false)}
function updateStreak(){const l=state.profile.lastActive;if(l!==today()){const y=new Date();y.setDate(y.getDate()-1);const ys=y.toISOString().slice(0,10);state.profile.streak=l===ys?(state.profile.streak||1)+1:1;state.profile.lastActive=today();}}
function toast(msg){const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>t.classList.remove('show'),1900)}

function runSplash(){
  const texts=['تجهيز تجربة هادئة...','ترتيب الواجهة...','تحميل المساحات...','تفعيل المزامنة...'];
  const steps=[...document.querySelectorAll('.splash-steps span')];
  const bar=document.querySelector('#loaderBar')||document.querySelector('.loader-line i');
  const label=document.querySelector('#loaderText');
  let i=0;
  const tick=()=>{
    if(document.querySelector('#loader')?.classList.contains('hide')) return;
    if(label) label.textContent=texts[i%texts.length];
    steps.forEach((s,idx)=>s.classList.toggle('active',idx<=i%steps.length));
    if(bar) bar.style.width=(30+((i%steps.length)+1)*17)+'%';
    i++;
  };
  tick(); clearInterval(runSplash.t); runSplash.t=setInterval(tick,520);
}

function rank(){const x=state.profile.xp; return x>=2500?'Master':x>=1200?'Deep Worker':x>=500?'Builder':x>=120?'Starter':'Rookie'}
function level(){return Math.floor((state.profile.xp||0)/200)+1}
function doneToday(){return state.tasks.filter(t=>t.done && (t.doneAt||'').slice(0,10)===today()).length}
function tasksToday(){return state.tasks.filter(t=>(t.date||today())===today())}
function bestTask(){return state.tasks.find(t=>!t.done&&t.pinned)||state.tasks.find(t=>!t.done&&t.priority==='High')||state.tasks.find(t=>!t.done)||null}
function completion(){return Math.round((state.tasks.filter(t=>t.done).length/Math.max(1,state.tasks.length))*100)}
function showApp(){ $('#auth').classList.add('hidden'); $('#app').classList.remove('hidden'); render(); setTimeout(()=>$('#loader')?.classList.add('hide'),450)}
window.addEventListener('load',()=>{runSplash();setTimeout(()=>$('#loader')?.classList.add('hide'),900); if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{}); const last=localStorage.getItem('navox_current'); if(last){load(last);showApp();}});
$('#authForm').onsubmit=e=>{e.preventDefault(); const n=$('#userName').value.trim(); const p=$('#userPass').value.trim(); if(!n||!p)return; if(p.length<6)return toast('كلمة المرور لازم تكون 6 أحرف على الأقل'); localStorage.setItem('navox_current',n); load(n); showApp(); toast('تم دخول مساحة Navo')};
$('#demoBtn').onclick=()=>{localStorage.setItem('navox_current','Mohammed');load('Mohammed');showApp()};
$('#logout').onclick=()=>{localStorage.removeItem('navox_current');location.reload()};
function applyTheme(toggle=true){ if(toggle){state.profile.theme=state.profile.theme==='light'?'dark':'light'; localStorage.setItem(key(),JSON.stringify(state));} document.body.classList.toggle('light',state.profile.theme==='light'); $('#themeBtn') && ($('#themeBtn').textContent=state.profile.theme==='light'?'☀ الوضع النهاري':'🌙 الوضع الليلي')}
$('#themeBtn').onclick=()=>applyTheme(true); document.addEventListener('click',e=>{if(e.target.closest('#themeMirrorBtn')) applyTheme(true);});
function page(id){$$('.page').forEach(p=>p.classList.toggle('active',p.id===id));$$('.nav,.mnav').forEach(b=>b.classList.toggle('active',b.dataset.page===id)); const titles={center:'Command Center',today:'Today',focus:'Focus Room',spaces:'Spaces',dump:'Brain Dump',insights:'Insights',profile:'Profile',settings:'Settings'}; $('#pageTitle').textContent=titles[id]||'Navo'; if(id==='focus') updateTimer()}
$$('[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page)); document.addEventListener('click',e=>{const b=e.target.closest('[data-jump]'); if(b) page(b.dataset.jump)});
function taskHTML(t){return `<div class="task ${t.done?'done':''}" data-id="${t.id}"><div class="task-main"><button class="check doneBtn" data-id="${t.id}">${t.done?'✓':''}</button><div><h4>${t.pinned?'📌 ':''}${esc(t.title)}</h4><div class="meta"><span class="tag">${esc(t.space||'Personal')}</span><span class="tag">${esc(t.priority)}</span><span class="tag">${(t.date||today())===today()?'اليوم':esc(t.date||'')}</span></div></div></div><div class="task-actions"><button class="mini pinBtn" data-id="${t.id}">📌</button><button class="mini delBtn" data-id="${t.id}">×</button></div></div>`}
function esc(x){return String(x).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[m]))}
function filtered(){const q=($('#taskSearch')?.value||'').toLowerCase(); const f=$('#taskFilter')?.value||'all'; let arr=tasksToday().filter(t=>t.title.toLowerCase().includes(q)); if(f==='open')arr=arr.filter(t=>!t.done); if(f==='done')arr=arr.filter(t=>t.done); if(f==='high')arr=arr.filter(t=>t.priority==='High'); return arr}
function render(){ if(!state)return; const date=new Date().toLocaleDateString('ar-SA',{weekday:'long',month:'long',day:'numeric'}); $('#dateText').textContent=date; const name=state.profile.name; const best=bestTask(); const pct=Math.round(doneToday()/Math.max(1,state.profile.dailyGoal||3)*100); $('#mainGreeting').textContent=`هلا ${name}، خلك على أهم شيء.`; $('#aiInsight').textContent=smartInsight(); $('#todayPct').textContent=Math.min(100,pct)+'%'; $('#ringFill').style.width=Math.min(100,pct)+'%'; $('#oneThing').textContent=best?best.title:'كل شيء منجز'; $('#oneThingMeta').textContent=best?`${best.space} • ${best.priority}`:'خذ راحة أو أضف هدف جديد'; $('#streak').textContent=state.profile.streak; $('#xp').textContent=state.profile.xp; $('#rank').textContent=rank(); $('#sessions').textContent=state.sessions; $('#nextTasks').innerHTML=state.tasks.filter(t=>!t.done).slice(0,4).map(taskHTML).join('')||empty('كل المهام منجزة'); $('#taskList').innerHTML=filtered().map(taskHTML).join('')||empty('ما فيه مهام اليوم'); $('#dailyNote').value=state.notes[today()]||''; $('#focusTask').textContent=best?best.title:'جلسة تركيز هادئة'; $('#taskSpace').innerHTML=state.spaces.map(s=>`<option>${esc(s.name)}</option>`).join(''); renderSpaces(); renderInsights(); renderProfile(); bindTasks(); updateTimer(false); }
function empty(t){return `<div class="task"><div><h4>${t}</h4><div class="meta"><span class="tag">Navo</span></div></div></div>`}
function smartInsight(){const open=state.tasks.filter(t=>!t.done).length, high=state.tasks.filter(t=>!t.done&&t.priority==='High').length; if(high>1)return `عندك ${high} مهام عالية. ابدأ بواحدة فقط وخلي الباقي بعدين.`; if(open===0)return 'اليوم نظيف. تقدر تضيف هدف خفيف أو تأخذ راحة.'; if(state.sessions===0)return 'جلسة 25 دقيقة الآن بتعطيك بداية قوية.'; return 'أداؤك يتحسن مع الجلسات القصيرة. كمل بنفس الهدوء.'}
function bindTasks(){ $$('.doneBtn').forEach(b=>b.onclick=()=>toggleTask(b.dataset.id)); $$('.delBtn').forEach(b=>b.onclick=()=>delTask(b.dataset.id)); $$('.pinBtn').forEach(b=>b.onclick=()=>pinTask(b.dataset.id)); }
function toggleTask(id){const t=state.tasks.find(x=>x.id===id); if(!t)return; t.done=!t.done; if(t.done){t.doneAt=new Date().toISOString(); state.profile.xp += t.priority==='High'?70:t.priority==='Medium'?45:25; markActivity(2); toast('إنجاز جديد +XP')}else{t.doneAt=''; toast('رجعت المهمة للمعلقة')} save()}
function delTask(id){state.tasks=state.tasks.filter(t=>t.id!==id); toast('تم حذف المهمة'); save()}
function pinTask(id){state.tasks.forEach(t=>t.pinned=false); const t=state.tasks.find(t=>t.id===id); if(t)t.pinned=true; toast('تم تثبيت المهمة'); save()}
function addTask(title,space='Personal',priority='Medium',date=today()){state.tasks.unshift({id:uid(),title,space,priority,date,done:false,pinned:false}); markActivity(1); save()}
$('#quickAdd').onclick=$('#addTaskToday').onclick=()=>{$('#taskDate').value=today(); $('#taskDialog').showModal()}; $('#closeTask').onclick=()=>$('#taskDialog').close();
$('#taskForm').onsubmit=e=>{e.preventDefault(); addTask($('#taskTitle').value.trim(),$('#taskSpace').value,$('#taskPriority').value,$('#taskDate').value||today()); $('#taskTitle').value=''; $('#taskDialog').close(); toast('تمت إضافة المهمة')};
$('#taskSearch').oninput=render; $('#taskFilter').onchange=render; $('#sortTasks').onclick=()=>{const order={High:0,Medium:1,Low:2};state.tasks.sort((a,b)=>(a.done-b.done)||(b.pinned-a.pinned)||(order[a.priority]-order[b.priority])||String(a.date).localeCompare(String(b.date)));save();toast('ترتيب ذكي جاهز')};
$('#dailyNote').oninput=e=>{state.notes[today()]=e.target.value; localStorage.setItem(key(),JSON.stringify(state))};
function renderSpaces(){const counts={}; state.tasks.forEach(t=>counts[t.space]=(counts[t.space]||0)+1); $('#spacesGrid').innerHTML=state.spaces.map(s=>`<article class="glass space" style="--space:${s.color}"><span class="eyebrow">SPACE</span><h3>${esc(s.name)}</h3><p>${counts[s.name]||0} مهام • مساحة خاصة للتركيز</p><div class="space-actions"><button class="ghost addInSpace" data-space="${esc(s.name)}">＋ مهمة</button><button class="ghost openSpace" data-space="${esc(s.name)}">عرض</button></div></article>`).join(''); $$('.addInSpace').forEach(b=>b.onclick=()=>{$('#taskDate').value=today(); $('#taskSpace').value=b.dataset.space; $('#taskDialog').showModal()}); $$('.openSpace').forEach(b=>b.onclick=()=>{page('today'); $('#taskSearch').value=b.dataset.space; render()})}
$('#addSpace').onclick=()=>{const name=prompt('اسم المساحة الجديدة؟'); if(!name)return; const colors=['#35d7ff','#7c3aed','#ffc078','#39d98a','#ff5f7a']; state.spaces.push({id:uid(),name,color:colors[state.spaces.length%colors.length]}); save(); toast('تمت إضافة Space')};
$('#parseDump').onclick=()=>{const text=$('#dumpInput').value.trim(); if(!text)return toast('اكتب أفكارك أول'); const parts=text.split(/\n|،|,| و | - /).map(x=>x.trim()).filter(x=>x.length>2).slice(0,8); $('#dumpResult').innerHTML=parts.map((p,i)=>`<div class="task"><div><h4>${esc(p)}</h4><div class="meta"><span class="tag">${i===0?'High':'Medium'}</span><span class="tag">Brain Dump</span></div></div><button class="primary addParsed" data-title="${esc(p)}" data-priority="${i===0?'High':'Medium'}">إضافة</button></div>`).join('')||empty('ما قدرت أستخرج مهام واضحة'); $$('.addParsed').forEach(b=>b.onclick=()=>{addTask(b.dataset.title,'Personal',b.dataset.priority,today()); b.textContent='تم'; b.disabled=true});};
function markActivity(n=1){const d=today(); state.activity[d]=(state.activity[d]||0)+n}
function renderInsights(){const rate=completion(); $('#completionRate').textContent=rate+'%'; const counts={}; state.tasks.forEach(t=>counts[t.space]=(counts[t.space]||0)+1); $('#bestSpace').textContent=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'; $('#weeklyText').textContent=rate>60?'أداؤك ممتاز. حافظ على نفس الرتم.':'ابدأ بجلسات قصيرة ومهام قليلة عشان تبني رتم ثابت.'; let html=''; for(let i=27;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i); const k=d.toISOString().slice(0,10); const v=state.activity[k]||0; html+=`<i class="heat ${v>4?'l3':v>2?'l2':v>0?'l1':''}" title="${k}: ${v}"></i>`} $('#heatmap').innerHTML=html}
function renderProfile(){const init=(state.profile.name||'M')[0].toUpperCase(); $('#avatar').textContent=init; $('#profileName').textContent=state.profile.name; $('#profileBio').textContent=state.profile.bio; $('#displayName').value=state.profile.name; $('#bioInput').value=state.profile.bio; $('#focusMinutes').value=state.profile.focusMinutes; $('#breakMinutes').value=state.profile.breakMinutes; $('#levelLabel').textContent=`Level ${level()} • ${rank()}`; $('#levelFill').style.width=((state.profile.xp%200)/200*100)+'%'; $('#profileXpMini') && ($('#profileXpMini').textContent=state.profile.xp); $('#profileFocusMini') && ($('#profileFocusMini').textContent=state.sessions); $('#profileSpacesMini') && ($('#profileSpacesMini').textContent=state.spaces.length); $('#profileTasksMini') && ($('#profileTasksMini').textContent=state.tasks.length)}
$('#saveProfile').onclick=()=>{state.profile.name=$('#displayName').value.trim()||state.profile.name; state.profile.bio=$('#bioInput').value.trim(); state.profile.focusMinutes=Number($('#focusMinutes').value)||25; state.profile.breakMinutes=Number($('#breakMinutes').value)||5; seconds=state.profile.focusMinutes*60; save(); toast('تم حفظ البروفايل')};
function updateTimer(){const total=(mode==='focus'?state.profile.focusMinutes:state.profile.breakMinutes)*60; const m=String(Math.floor(seconds/60)).padStart(2,'0'),s=String(seconds%60).padStart(2,'0'); $('#timer').textContent=`${m}:${s}`; const circumference=704; $('#timerCircle').style.strokeDashoffset=String(circumference-(circumference*((total-seconds)/Math.max(1,total)))); $('#timerLabel') && ($('#timerLabel').textContent=mode==='focus'?'جلسة تركيز':'استراحة'); $('#focusModeChip') && ($('#focusModeChip').textContent=mode==='focus'?'Focus Session':'Break Time'); $('#focusLengthLabel') && ($('#focusLengthLabel').textContent=(state.profile.focusMinutes||25)+'m'); $('#breakLengthLabel') && ($('#breakLengthLabel').textContent=(state.profile.breakMinutes||5)+'m'); $('#focusSessionLabel') && ($('#focusSessionLabel').textContent=state.sessions||0);}
$('#startFocusHero').onclick=()=>{page('focus'); startTimer()}; $('#startTimer').onclick=startTimer; $('#pauseTimer').onclick=()=>{clearInterval(timer);timer=null;toast('تم الإيقاف')}; $('#resetTimer').onclick=()=>{clearInterval(timer);timer=null;mode='focus';seconds=state.profile.focusMinutes*60;updateTimer();toast('تمت الإعادة')};
function startTimer(){if(timer)return; toast('بدأت جلسة التركيز'); timer=setInterval(()=>{seconds--; if(seconds<=0){clearInterval(timer);timer=null; if(mode==='focus'){state.sessions++; state.profile.xp+=90; markActivity(3); mode='break'; seconds=state.profile.breakMinutes*60; toast('خلصت الجلسة +90 XP')}else{mode='focus';seconds=state.profile.focusMinutes*60;toast('انتهت الراحة')} save()} updateTimer()},1000)}
$('#fullBtn').onclick=()=>{const el=$('#focusRoom'); if(!document.fullscreenElement)el.requestFullscreen?.(); else document.exitFullscreen?.()};
function ctx(){audioCtx ||= new(window.AudioContext||window.webkitAudioContext)(); return audioCtx}
$$('.sound').forEach(b=>b.onclick=()=>{ $$('.sound').forEach(x=>x.classList.remove('active')); b.classList.add('active'); stopAmbience(); if(b.dataset.sound!=='none')startAmbience(b.dataset.sound)});
function startAmbience(type){try{const c=ctx(); const o=c.createOscillator(), g=c.createGain(); o.type=type==='rain'?'sine':type==='cafe'?'triangle':'sawtooth'; o.frequency.value=type==='space'?70:type==='cafe'?180:260; g.gain.value=.018; o.connect(g);g.connect(c.destination);o.start(); ambience={o,g};}catch{}}
function stopAmbience(){try{ambience?.o.stop();}catch{} ambience=null}
$('#openCmd').onclick=()=>openCmd(); $('#cmd').onclick=e=>{if(e.target.id==='cmd')$('#cmd').classList.add('hidden')}; $('#cmdInput').oninput=e=>cmdResults(e.target.value); document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCmd()} if(e.key==='Escape')$('#cmd').classList.add('hidden')});
function openCmd(){ $('#cmd').classList.remove('hidden'); $('#cmdInput').value=''; cmdResults(''); setTimeout(()=>$('#cmdInput').focus(),50)}
function cmdResults(q){const items=[['focus','افتح Focus Room',()=>page('focus')],['task','أضف مهمة جديدة',()=>$('#taskDialog').showModal()],['brain','افتح Brain Dump',()=>page('dump')],['today','افتح Today',()=>page('today')],['insights','افتح Insights',()=>page('insights')],['settings','افتح الإعدادات',()=>page('settings')]]; $('#cmdList').innerHTML=items.filter(i=>i[0].includes(q.toLowerCase())||i[1].includes(q)).map((i,idx)=>`<div class="cmd-item" data-idx="${idx}">${i[1]}</div>`).join(''); $$('.cmd-item').forEach(el=>el.onclick=()=>{const action=items.filter(i=>i[0].includes(q.toLowerCase())||i[1].includes(q))[el.dataset.idx][2]; $('#cmd').classList.add('hidden'); action();})}


/* === Navo Polish Phase — safe additive upgrades === */
(function(){
  const $=window.$ || (s=>document.querySelector(s));
  const $$=window.$$ || (s=>[...document.querySelectorAll(s)]);
  const safe=(fn)=>{try{return fn()}catch(e){console.warn('[Navo polish]',e)}};
  function addBackgroundEngine(){
    if(document.querySelector('.dynamic-aurora')) return;
    const aur=document.createElement('div'); aur.className='dynamic-aurora'; document.body.prepend(aur);
    const field=document.createElement('div'); field.className='star-field';
    for(let i=0;i<34;i++){const s=document.createElement('i');s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.setProperty('--d',(9+Math.random()*12)+'s');field.appendChild(s)}
    document.body.prepend(field);
    window.addEventListener('pointermove',e=>{const x=(e.clientX/window.innerWidth*100).toFixed(1)+'%';const y=(e.clientY/window.innerHeight*100).toFixed(1)+'%';document.documentElement.style.setProperty('--mx',x);document.documentElement.style.setProperty('--my',y);}, {passive:true});
  }
  function addSaveIndicator(){
    if(document.querySelector('.saving-dot'))return;
    const dot=document.createElement('div');dot.className='saving-dot';dot.textContent='Saved';document.body.appendChild(dot);
    const raw=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){raw.apply(this,arguments); if(String(k).startsWith('navox_')){dot.classList.add('show');clearTimeout(dot.t);dot.t=setTimeout(()=>dot.classList.remove('show'),900)}};
  }
  function clickSound(){
    document.addEventListener('click',e=>{ if(!e.target.closest('button,.cmd-item,.task,.space'))return; safe(()=>{window.audioCtx ||= new (window.AudioContext||window.webkitAudioContext)(); const c=window.audioCtx; if(c.state==='suspended')c.resume(); const o=c.createOscillator(),g=c.createGain(); o.type='sine'; o.frequency.value=520; g.gain.value=.014; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+.045);}); }, true);
  }
  function addAIStrip(){
    const hero=document.querySelector('.hero-card');
    if(!hero || hero.querySelector('.ai-strip')) return;
    const strip=document.createElement('div');strip.className='ai-strip';strip.innerHTML=`<div class="ai-pill cyan"><b>Smart Cue</b><span id="smartCue">ابدأ بخطوة واحدة.</span></div><div class="ai-pill good"><b>Energy</b><span id="energyCue">Calm</span></div><div class="ai-pill warn"><b>Next Move</b><span id="nextCue">Focus 25m</span></div>`;
    hero.appendChild(strip);
  }
  function addFocusVisuals(){
    const room=document.querySelector('#focusRoom');
    if(!room)return;
    if(!room.querySelector('.focus-visualizer')){
      const v=document.createElement('div');v.className='focus-visualizer';v.innerHTML='<i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
      document.querySelector('.focus-controls')?.before(v);
    }
    room.addEventListener('pointermove',e=>{const r=room.getBoundingClientRect();room.style.setProperty('--fx',((e.clientX-r.left)/r.width*100).toFixed(1)+'%');room.style.setProperty('--fy',((e.clientY-r.top)/r.height*100).toFixed(1)+'%')},{passive:true});
  }
  function showComplete(){
    const old=document.querySelector('.focus-complete'); if(old)old.remove();
    const layer=document.createElement('div'); layer.className='focus-complete'; layer.innerHTML=`<div class="focus-complete-card"><div class="focus-complete-icon">✓</div><h2>جلسة ممتازة</h2><p>أخذت +90 XP. خذ نفس، ثم كمل بهدوء.</p><button class="primary full" type="button">تمام</button></div>`;
    document.body.appendChild(layer); layer.querySelector('button').onclick=()=>layer.remove(); setTimeout(()=>layer.remove(),4200);
  }
  function enhanceCommandPalette(){
    const box=document.querySelector('.cmd-box'); if(!box || box.querySelector('.cmd-hint')) return;
    const hint=document.createElement('div');hint.className='cmd-hint';hint.innerHTML='<span>Ctrl/⌘ + K</span><span>Enter للتنفيذ • Esc للخروج</span>';box.appendChild(hint);
  }
  function patchRuntime(){
    // Patch page transitions without touching original code
    if(typeof window.page==='function' && !window.page.__polished){
      const old=window.page; window.page=function(id){document.body.dataset.page=id; const p=document.getElementById(id); if(p){p.classList.remove('active'); void p.offsetWidth;} old(id);}; window.page.__polished=true;
    }
    // Patch render to update AI pills
    if(typeof window.render==='function' && !window.render.__polished){
      const old=window.render; window.render=function(){old(); safe(()=>{const open=state.tasks.filter(t=>!t.done).length; const done=state.tasks.filter(t=>t.done).length; const high=state.tasks.filter(t=>!t.done&&t.priority==='High').length; $('#smartCue') && ($('#smartCue').textContent= high?`عندك ${high} أولوية عالية.`:open?'ابدأ بأقرب مهمة.':'اليوم نظيف.'); $('#energyCue') && ($('#energyCue').textContent=(new Date().getHours()>=20?'Night Focus':'Balanced')); $('#nextCue') && ($('#nextCue').textContent=open?'جلسة قصيرة الآن':'راحة ذكية');});}; window.render.__polished=true;
    }
    // Patch start/pause/reset visual state
    const start=$('#startTimer'), pause=$('#pauseTimer'), reset=$('#resetTimer'), room=$('#focusRoom');
    if(start && !start.dataset.polished){start.dataset.polished='1';start.addEventListener('click',()=>room?.classList.add('running'),true)}
    if(pause && !pause.dataset.polished){pause.dataset.polished='1';pause.addEventListener('click',()=>room?.classList.remove('running'),true)}
    if(reset && !reset.dataset.polished){reset.dataset.polished='1';reset.addEventListener('click',()=>room?.classList.remove('running'),true)}
    // Observe toast for focus completion to show cinematic overlay
    const toast=$('#toast'); if(toast && !toast.dataset.observed){toast.dataset.observed='1'; new MutationObserver(()=>{if((toast.textContent||'').includes('خلصت الجلسة')){room?.classList.remove('running'); showComplete();}}).observe(toast,{childList:true,characterData:true,subtree:true});}
    enhanceCommandPalette();
  }
  function mobilePolish(){
    if(document.querySelector('.mobile-safe-pad'))return; const d=document.createElement('div');d.className='mobile-safe-pad';document.body.appendChild(d);
    window.addEventListener('resize',()=>document.documentElement.style.setProperty('--vh',(innerHeight*.01)+'px'),{passive:true}); document.documentElement.style.setProperty('--vh',(innerHeight*.01)+'px');
  }
  function bootPolish(){safe(addBackgroundEngine);safe(addSaveIndicator);safe(clickSound);safe(addAIStrip);safe(addFocusVisuals);safe(enhanceCommandPalette);safe(mobilePolish);safe(patchRuntime); setTimeout(()=>safe(()=>{if(typeof render==='function' && window.state)render()}),80)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootPolish);else bootPolish();
})();

/* === Navo Cloud Edition — stable sync + product polish === */
(function(){
  const safe=(fn)=>{try{return fn()}catch(e){console.warn('[Navo Cloud]',e)}};
  const normalizeUrl=(u='')=>String(u).trim().replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
  const cfg=()=>{
    const c=window.NAVO_CLOUD||{};
    const legacy=window.NAVO_CONFIG||{};
    return {
      supabaseUrl: normalizeUrl(c.supabaseUrl||legacy.SUPABASE_URL||legacy.supabaseUrl||''),
      supabaseAnonKey: String(c.supabaseAnonKey||legacy.SUPABASE_ANON_KEY||legacy.supabaseAnonKey||'').trim()
    };
  };
  const configured=()=>!!(cfg().supabaseUrl&&cfg().supabaseAnonKey);
  const sessionKey='navo_cloud_session_v2';
  let cloudSession=null, syncing=false, syncTimer=null;

  function cleanBrand(){
    document.title='Navo';
    document.querySelectorAll('.brand-mark span,.brand-mini b').forEach(el=>{el.textContent='Navo'});
  }
  function getSession(){try{return JSON.parse(localStorage.getItem(sessionKey)||localStorage.getItem('navox_cloud_session')||'null')}catch{return null}}
  function setSession(s){cloudSession=s; if(s)localStorage.setItem(sessionKey,JSON.stringify(s)); else {localStorage.removeItem(sessionKey);localStorage.removeItem('navox_cloud_session')} updateCloudUI();}
  function badge(){let b=document.querySelector('.cloud-badge'); if(!b){b=document.createElement('div');b.className='cloud-badge calm';b.innerHTML='<i></i><span>Local ready</span>';document.body.appendChild(b)} return b}
  function setBadge(text,cls='calm'){const b=badge(); b.className='cloud-badge '+cls; b.querySelector('span').textContent=text; const st=document.querySelector('#cloudStatus'); if(st)st.textContent=text; const em=document.querySelector('#cloudEmail'); if(em)em.textContent=cloudSession?.username||state?.profile?.username||user||'غير متصل';}
  function authHeaders(token){return {'Content-Type':'application/json','apikey':cfg().supabaseAnonKey,'Authorization':'Bearer '+(token||cfg().supabaseAnonKey)}}
  function friendlyError(e){
    const m=String(e?.message||e||'');
    if(m.includes('rate')||m.includes('429'))return 'فيه حد مؤقت على إيميلات Supabase. طفي Confirm email أو انتظر دقيقة وجرب.';
    if(m.includes('User already registered'))return 'اسم المستخدم موجود. استخدم كلمة المرور الصحيحة.';
    if(m.includes('Invalid login'))return 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    if(m.includes('Email not confirmed'))return 'لازم تطفي Confirm email من Supabase أو تؤكد البريد.';
    if(m.includes('Failed to fetch'))return 'تعذر الاتصال بالسحابة. تأكد من رابط Supabase والإنترنت.';
    if(m.includes('JWT')||m.includes('apikey'))return 'مفتاح Supabase غير صحيح. استخدم publishable/anon key فقط.';
    return m || 'تعذر الاتصال بالمزامنة.';
  }
  async function request(path,opts={}){
    if(!configured())throw new Error('حط بيانات Supabase في navo-config.js أول');
    const res=await fetch(cfg().supabaseUrl+path,{...opts,headers:{...authHeaders(cloudSession?.access_token),...(opts.headers||{})}});
    const txt=await res.text(); let data=null; try{data=txt?JSON.parse(txt):null}catch{data=txt}
    if(!res.ok)throw new Error(data?.msg||data?.message||txt||('HTTP '+res.status));
    return data;
  }
  function hashHandle(str){let h=2166136261;str=String(str||'user').trim().toLowerCase();for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}
  function usernameToEmail(name){return 'u_'+hashHandle(name)+'@users.navo.app'}
  async function signInOrUp(email,password,name){
    setBadge('Signing in...','syncing');
    let data=null, loginError=null;
    try{data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});}
    catch(e){loginError=e;}
    if(!data){
      try{data=await request('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:{name}})});}
      catch(e){
        const msg=String(e?.message||e||'');
        if(msg.includes('already registered')) throw new Error('الحساب موجود. اكتب كلمة المرور الصحيحة للدخول.');
        throw new Error(friendlyError(e));
      }
    }
    if(!data?.access_token){
      if(loginError) throw new Error(friendlyError(loginError));
      throw new Error('تم إنشاء الحساب، لكن Supabase يطلب تأكيد البريد. طفي Confirm email ثم جرب تسجل دخول.');
    }
    const sess={access_token:data.access_token,refresh_token:data.refresh_token,email:data.user?.email||email,username:name,user_id:data.user?.id,expires_at:Date.now()+((data.expires_in||3600)*1000)};
    setSession(sess); return sess;
  }
  async function refreshSession(){
    if(!configured()||!cloudSession?.refresh_token)return null;
    if(Date.now() < (cloudSession.expires_at||0)-60000)return cloudSession;
    const r=await fetch(cfg().supabaseUrl+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:authHeaders(),body:JSON.stringify({refresh_token:cloudSession.refresh_token})});
    const txt=await r.text(); const j=txt?JSON.parse(txt):null; if(!r.ok)throw new Error(j?.message||txt);
    const sess={...cloudSession,access_token:j.access_token,refresh_token:j.refresh_token||cloudSession.refresh_token,expires_at:Date.now()+((j.expires_in||3600)*1000)};
    setSession(sess); return sess;
  }
  function normalizeState(remote,name,email){
    const base=defaultState(name||email||'Navo User');
    const merged={...base,...remote};
    merged.profile={...base.profile,...(remote?.profile||{})};
    merged.profile.name=merged.profile.name||name||email;
    merged.profile.email=email||merged.profile.email;
    merged.spaces=Array.isArray(merged.spaces)&&merged.spaces.length?merged.spaces:base.spaces;
    merged.tasks=Array.isArray(merged.tasks)?merged.tasks:base.tasks;
    merged.notes=merged.notes||{}; merged.activity=merged.activity||{}; merged.sessions=merged.sessions||0;
    return merged;
  }
  async function pullState(){
    await refreshSession(); if(!cloudSession?.user_id)return null;
    setBadge('Syncing...','syncing');
    const rows=await request('/rest/v1/navo_states?user_id=eq.'+encodeURIComponent(cloudSession.user_id)+'&select=data,updated_at&limit=1',{method:'GET'});
    setBadge('Synced','synced'); return rows?.[0]?.data||null;
  }
  async function pushStateNow(){
    if(!configured()||!cloudSession||!state)return;
    if(syncing)return; syncing=true;
    try{
      setBadge(navigator.onLine?'Syncing...':'Offline','syncing');
      await refreshSession();
      await request('/rest/v1/navo_states',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({user_id:cloudSession.user_id,email:cloudSession.email,data:state,updated_at:new Date().toISOString()})});
      setBadge('Synced','synced');
    }catch(e){console.warn('[Navo sync]',e); setBadge(navigator.onLine?'Saved locally':'offline','calm');}
    finally{syncing=false;}
  }
  function queueSync(){if(!cloudSession)return; clearTimeout(syncTimer); syncTimer=setTimeout(pushStateNow,700);}
  function injectAuth(){
    const text=document.querySelector('#authSyncText');
    const dot=document.querySelector('#authSyncDot');
    if(text) text.textContent=configured()?'Cloud Sync جاهز — ادخل من أي جهاز':'Local Mode — أضف Supabase للتزامن';
    if(dot) dot.className='sync-dot '+(configured()?'on':'local');
  }
  function injectProfileChips(){
    const card=document.querySelector('.cloud-account-card'); if(!card||card.querySelector('.account-chip-row'))return;
    const row=document.createElement('div'); row.className='account-chip-row';
    row.innerHTML='<span class="account-chip good">Cloud Save</span><span class="account-chip cyan">Multi-device</span><span class="account-chip">Offline fallback</span><span class="account-chip">Clean UI</span>';
    card.insertBefore(row,card.children[2]||null);
  }
  function updateCloudUI(){safe(()=>{
    const status=cloudSession ? (configured()?'Cloud Connected':'Config missing') : (configured()?'Cloud ready':'Local ready');
    setBadge(status, cloudSession?'synced':'calm');
    const email=document.querySelector('#cloudEmail'); if(email)email.textContent=cloudSession?.username||state?.profile?.username||user||'غير متصل'; const am=document.querySelector('#accountModeMini'); if(am)am.textContent=cloudSession?'Cloud':'Local'; const ss=document.querySelector('#syncStateMini'); if(ss)ss.textContent=cloudSession?'Synced':'Ready';
    const sel=document.querySelector('#mouseEffectSelect'); if(sel&&state?.profile?.mouseEffect)sel.value=state.profile.mouseEffect;
  });}
  function applyMouseMode(){const m=state?.profile?.mouseEffect||localStorage.getItem('navo_mouse_effect')||'off'; document.body.classList.remove('mouse-off','mouse-soft','mouse-full'); document.body.classList.add('mouse-'+m); const sel=document.querySelector('#mouseEffectSelect'); if(sel)sel.value=m;}
  function bindCloudControls(){safe(()=>{
    const sel=document.querySelector('#mouseEffectSelect'); if(sel&&!sel.dataset.bound){sel.dataset.bound='1'; sel.onchange=()=>{state.profile.mouseEffect=sel.value; localStorage.setItem('navo_mouse_effect',sel.value); applyMouseMode(); save(); toast('تم ضبط تأثير الماوس');};}
    const sync=document.querySelector('#cloudSyncNow'); if(sync&&!sync.dataset.bound){sync.dataset.bound='1'; sync.onclick=()=>pushStateNow();}
    const dis=document.querySelector('#cloudDisconnect'); if(dis&&!dis.dataset.bound){dis.dataset.bound='1'; dis.onclick=()=>{setSession(null); setBadge(configured()?'Cloud ready':'Local ready','calm'); toast('تم فصل السحابة');};}
  });}
  function patchAuth(){
    const form=document.querySelector('#authForm'); if(!form||form.dataset.cloudPatched)return; form.dataset.cloudPatched='1';
    form.addEventListener('submit',async e=>{
      const name=(document.querySelector('#userName')?.value||'').trim();
      const pass=(document.querySelector('#userPass')?.value||'').trim();
      if(!name||!pass)return;
      if(pass.length<6)return;
      if(!configured())return; // fallback to local original handler
      e.preventDefault(); e.stopImmediatePropagation();
      const email=usernameToEmail(name);
      try{
        await signInOrUp(email,pass,name);
        const remote=await pullState();
        user=name;
        state=remote?normalizeState(remote,name,email):normalizeState(null,name,email);
        state.profile.username=name;
        localStorage.setItem('navox_current',name);
        localStorage.setItem(key(),JSON.stringify(state));
        if(!remote)await pushStateNow();
        showApp(); applyMouseMode(); setBadge('Synced','synced'); toast('تم الدخول والمزامنة');
      }catch(err){
        const msg=friendlyError(err).replace('البريد','اسم المستخدم');
        toast(msg); setBadge('Cloud ready','calm');
      }
    },true);
  }
  function patchSave(){safe(()=>{
    if(typeof save==='function'&&!save.__cloud){const old=save; save=function(){old(); queueSync(); applyMouseMode();}; save.__cloud=true;}
    if(typeof render==='function'&&!render.__cloud){const oldRender=render; render=function(){oldRender(); cleanBrand(); injectProfileChips(); bindCloudControls(); updateCloudUI(); applyMouseMode();}; render.__cloud=true;}
  });}
  function bootCloud(){cleanBrand(); injectAuth(); badge(); setSession(getSession()); patchAuth(); patchSave(); bindCloudControls(); applyMouseMode(); window.addEventListener('online',()=>{setBadge('Back online','syncing'); queueSync();}); window.addEventListener('offline',()=>setBadge('Offline','offline')); setTimeout(()=>safe(()=>{cleanBrand(); injectProfileChips(); bindCloudControls(); updateCloudUI(); applyMouseMode(); if(cloudSession&&configured()&&state)queueSync();}),250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootCloud); else bootCloud();
})();
