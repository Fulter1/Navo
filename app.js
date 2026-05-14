'use strict';
const $ = (s, r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const today = new Date().toISOString().slice(0,10);
const defaults={user:null,profile:{name:'Mohammed',bio:'Personal Operating System'},tasks:[{id:crypto.randomUUID(),title:'رتّب أول مهمة في Navo',space:'Personal',priority:'High',date:today,done:false}],spaces:[{id:crypto.randomUUID(),name:'Personal',icon:'✨',color:'blue'}],xp:0,streak:1,sessions:0,notes:{},settings:{focus:25,break:5,theme:'dark',motion:'full'},heat:{}};
let state=load();let timer=null,timerLeft=(state.settings.focus||25)*60,timerTotal=timerLeft,isBreak=false;
function load(){try{return {...structuredClone(defaults),...(JSON.parse(localStorage.getItem('navo_state_v3')||'{}'))}}catch{return structuredClone(defaults)}}
function save(){localStorage.setItem('navo_state_v3',JSON.stringify(state))}
async function hash(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function users(){try{return JSON.parse(localStorage.getItem('navo_users_v3')||'{}')}catch{return {}}}
function saveUsers(u){localStorage.setItem('navo_users_v3',JSON.stringify(u))}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
function pageName(p){return {center:'Command Center',today:'خطة اليوم',focus:'Focus Room',spaces:'المساحات',dump:'Brain Dump',insights:'التحليل',profile:'الملف الشخصي',settings:'الإعدادات'}[p]||'Navo'}
function goto(page){$$('.page').forEach(x=>x.classList.toggle('active',x.id===page));$$('.nav,.mnav').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('#pageTitle').textContent=pageName(page); if(page==='focus') updateFocusTask(); window.scrollTo({top:0,behavior:'smooth'})}
function applyTheme(){document.documentElement.dataset.theme=state.settings.theme||'dark';document.body.classList.toggle('light',state.settings.theme==='frost');document.body.classList.remove('motion-off','motion-soft');document.body.classList.add('motion-'+(state.settings.motion||'full'));$('#themeSelect')&&($('#themeSelect').value=state.settings.theme);$('#motionSelect')&&($('#motionSelect').value=state.settings.motion)}
function bootLoader(){const msgs=['تنظيم مساحتك...','تجهيز جلسة التركيز...','ضبط بيئة العمل...','تجهيز تجربة Navo...'];let i=0,p=0;const bar=$('#loaderBar'),txt=$('#loaderText');const int=setInterval(()=>{p+=25;bar.style.width=p+'%';txt.textContent=msgs[i++%msgs.length];if(p>=100){clearInterval(int);setTimeout(()=>$('#loader').classList.add('hide'),300)}},260)}
function renderAuth(){const logged=localStorage.getItem('navo_session_v3');if(logged){state.user=logged;$('#auth').classList.add('hidden');$('#app').classList.remove('hidden')}else{$('#auth').classList.remove('hidden');$('#app').classList.add('hidden')}}
function initAuth(){const form=$('#authForm'), msg=$('#authInlineMsg'), pass=$('#userPass'), name=$('#userName');function mode(m){form.dataset.mode=m;$('#loginModeBtn').classList.toggle('active',m==='login');$('#registerModeBtn').classList.toggle('active',m==='register');$('#authTitle').textContent=m==='login'?'تسجيل الدخول':'إنشاء حساب';$('#authSubmitBtn').textContent=m==='login'?'دخول':'إنشاء الحساب';$('#authEyebrow').textContent=m==='login'?'WELCOME BACK':'CREATE SPACE';msg.textContent=''}$('#loginModeBtn').onclick=()=>mode('login');$('#registerModeBtn').onclick=()=>mode('register');pass.oninput=()=>{const v=pass.value.length;const w=Math.min(100,v*13);$('#strength i').style.width=w+'%';$('#strength i').style.background=w>70?'var(--ok)':w>40?'var(--accent)':'var(--danger)'};name.oninput=()=>{const u=users();if(form.dataset.mode==='register'&&u[name.value.trim().toLowerCase()]) msg.textContent='اسم المستخدم موجود بالفعل'};form.onsubmit=async e=>{e.preventDefault();const username=name.value.trim().toLowerCase();const password=pass.value;if(username.length<3||password.length<6){msg.textContent='تأكد من اسم المستخدم وكلمة المرور';return}const u=users();const h=await hash(password);if(form.dataset.mode==='register'){if(u[username]){msg.textContent='اسم المستخدم موجود بالفعل';return}u[username]={hash:h,created:Date.now()};saveUsers(u);toast('تم إنشاء الحساب');}else if(!u[username]||u[username].hash!==h){msg.textContent='بيانات الدخول غير صحيحة';return}localStorage.setItem('navo_session_v3',username);state.user=username;state.profile.name=username;save();renderAuth();renderAll();toast('أهلًا بك في Navo')};$('#demoBtn').onclick=()=>{localStorage.setItem('navo_session_v3','demo');state.user='demo';save();renderAuth();renderAll()};}
function logout(){localStorage.removeItem('navo_session_v3');renderAuth();toast('تم تسجيل الخروج')}
function renderTasks(){const q=($('#taskSearch')?.value||'').toLowerCase(),f=$('#taskFilter')?.value||'all';const list=$('#taskList'),next=$('#nextTasks');if(!list)return;const tasks=state.tasks.filter(t=>t.title.toLowerCase().includes(q)).filter(t=>f==='all'||(f==='open'&&!t.done)||(f==='done'&&t.done)||(f==='high'&&t.priority==='High'));const html=tasks.map(t=>taskHtml(t)).join('')||empty('ما فيه مهام الآن');list.innerHTML=html;next.innerHTML=state.tasks.filter(t=>!t.done).slice(0,4).map(t=>taskHtml(t)).join('')||empty('أضف مهمة جديدة');$$('[data-check]').forEach(b=>b.onclick=()=>toggleTask(b.dataset.check));$$('[data-del]').forEach(b=>b.onclick=()=>{state.tasks=state.tasks.filter(t=>t.id!==b.dataset.del);save();renderAll()});renderStats()}
function taskHtml(t){return `<div class="task-item ${t.done?'done':''}"><button class="check" data-check="${t.id}">${t.done?'✓':''}</button><div style="flex:1"><div class="task-title">${esc(t.title)}</div><div class="task-meta">${esc(t.space)} • ${t.date||'بدون تاريخ'}</div></div><span class="priority">${t.priority}</span><button class="ghost" data-del="${t.id}">حذف</button></div>`}
function empty(t){return `<div class="task-item"><span class="task-meta">${t}</span></div>`}function esc(s){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function toggleTask(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;if(t.done){state.xp+=25;state.heat[today]=(state.heat[today]||0)+1}save();renderAll();toast(t.done?'تم إنجاز المهمة +25 XP':'تم إرجاع المهمة')}
function openTask(){fillSpaces();$('#taskTitle').value='';$('#taskDate').value=today;$('#taskDialog').showModal()}function fillSpaces(){const s=$('#taskSpace');s.innerHTML=state.spaces.map(x=>`<option>${esc(x.name)}</option>`).join('')}
function initTasks(){$('#quickAdd').onclick=openTask;$('#addTaskToday').onclick=openTask;$('#closeTask').onclick=()=>$('#taskDialog').close();$('#taskForm').onsubmit=e=>{e.preventDefault();const title=$('#taskTitle').value.trim();if(!title)return;state.tasks.unshift({id:crypto.randomUUID(),title,space:$('#taskSpace').value,priority:$('#taskPriority').value,date:$('#taskDate').value||today,done:false});save();$('#taskDialog').close();renderAll();toast('تمت إضافة المهمة')};$('#taskSearch').oninput=renderTasks;$('#taskFilter').onchange=renderTasks;$('#sortTasks').onclick=()=>{const order={High:0,Medium:1,Low:2};state.tasks.sort((a,b)=>order[a.priority]-order[b.priority]||a.done-b.done);save();renderTasks()};$('#dailyNote').oninput=e=>{state.notes[today]=e.target.value;save()}}
function renderStats(){const total=state.tasks.length,done=state.tasks.filter(t=>t.done).length,pct=total?Math.round(done/total*100):0;$('#todayPct').textContent=pct+'%';$('#ringFill').style.width=pct+'%';$('#xp').textContent=state.xp;$('#profileXpMini').textContent=state.xp;$('#streak').textContent=state.streak;$('#sessions').textContent=state.sessions;$('#focusSessionLabel').textContent=state.sessions;$('#completionRate').textContent=pct+'%';const level=Math.max(1,Math.floor(state.xp/100)+1);$('#levelLabel').textContent='Level '+level;$('#levelFill').style.width=(state.xp%100)+'%';$('#rank').textContent=level>5?'Pro':'Rookie';$('#profileTasksMini').textContent=total;$('#profileSpacesMini').textContent=state.spaces.length;$('#profileFocusMini').textContent=state.sessions;const first=state.tasks.find(t=>!t.done);$('#oneThing').textContent=first?first.title:'أضف أهم مهمة اليوم';$('#oneThingMeta').textContent=first?`${first.space} • ${first.priority}`:'مهمة واحدة فقط تظهر هنا.';$('#focusTask').textContent=first?first.title:'مهمة واحدة فقط';const by={};state.tasks.forEach(t=>by[t.space]=(by[t.space]||0)+1);$('#bestSpace').textContent=Object.entries(by).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'}
function renderSpaces(){const g=$('#spacesGrid');g.innerHTML=state.spaces.map(s=>`<article class="space-card"><strong>${s.icon} ${esc(s.name)}</strong><span class="task-meta">${state.tasks.filter(t=>t.space===s.name).length} مهام</span><button class="ghost" data-rmspace="${s.id}">حذف</button></article>`).join('');$$('[data-rmspace]').forEach(b=>b.onclick=()=>{if(state.spaces.length===1)return toast('لازم تبقي مساحة واحدة');const sp=state.spaces.find(x=>x.id===b.dataset.rmspace);state.spaces=state.spaces.filter(x=>x.id!==b.dataset.rmspace);state.tasks.forEach(t=>{if(t.space===sp.name)t.space=state.spaces[0].name});save();renderAll()});$('#profileSpacesMini').textContent=state.spaces.length}
function initSpaces(){$('#addSpace').onclick=()=>{const name=prompt('اسم المساحة؟');if(!name)return;state.spaces.push({id:crypto.randomUUID(),name:name.trim(),icon:'▦',color:'blue'});save();renderAll()}}
function renderProfile(){$('#profileName').textContent=state.profile.name||state.user||'Navo';$('#profileBio').textContent=state.profile.bio||'Personal Operating System';$('#avatar').textContent=($('#profileName').textContent[0]||'N').toUpperCase();$('#displayName').value=state.profile.name||'';$('#bioInput').value=state.profile.bio||'';$('#railUser').textContent=state.user||'Workspace';$('#cloudEmail').textContent=state.user?`@${state.user}`:'غير متصل بالسحابة'}
function initSettings(){$('#saveProfile').onclick=()=>{state.profile.name=$('#displayName').value.trim()||state.profile.name;state.profile.bio=$('#bioInput').value.trim();save();renderProfile();toast('تم حفظ الملف')};$('#focusMinutes').oninput=e=>{state.settings.focus=clamp(+e.target.value,5,90);resetTimer();save()};$('#breakMinutes').oninput=e=>{state.settings.break=clamp(+e.target.value,1,30);save();renderFocusLabels()};$('#motionSelect').onchange=e=>{state.settings.motion=e.target.value;save();applyTheme()};$('#themeSelect').onchange=e=>{state.settings.theme=e.target.value;save();applyTheme()};$('#themeBtn').onclick=$('#themeMirrorBtn').onclick=()=>{state.settings.theme=state.settings.theme==='frost'?'dark':'frost';save();applyTheme()};$('#cloudSyncNow').onclick=()=>{save();toast('تم حفظ نسخة محلية')};$('#cloudDisconnect').onclick=logout;$('#logout').onclick=logout;$('#logoutSettings').onclick=logout}
function clamp(n,a,b){return Math.max(a,Math.min(b,n||a))}
function renderFocusLabels(){$('#focusMinutes').value=state.settings.focus;$('#breakMinutes').value=state.settings.break;$('#focusLengthLabel').textContent=state.settings.focus+'m';$('#breakLengthLabel').textContent=state.settings.break+'m'}
function resetTimer(){clearInterval(timer);timer=null;isBreak=false;timerTotal=(state.settings.focus||25)*60;timerLeft=timerTotal;updateTimer()}function updateTimer(){const m=String(Math.floor(timerLeft/60)).padStart(2,'0'),s=String(timerLeft%60).padStart(2,'0');$('#timer').textContent=`${m}:${s}`;$('#timerCircle').style.strokeDashoffset=704-(timerLeft/timerTotal*704)}function startTimer(){if(timer)return;timer=setInterval(()=>{timerLeft--;updateTimer();if(timerLeft<=0){clearInterval(timer);timer=null;state.sessions++;state.xp+=50;state.heat[today]=(state.heat[today]||0)+2;save();renderAll();toast('انتهت جلسة التركيز +50 XP');isBreak=!isBreak;timerTotal=(isBreak?state.settings.break:state.settings.focus)*60;timerLeft=timerTotal;updateTimer()}},1000)}function updateFocusTask(){const t=state.tasks.find(x=>!x.done);$('#focusTask').textContent=t?t.title:'مهمة واحدة فقط'}
function initFocus(){$('#startTimer').onclick=startTimer;$('#pauseTimer').onclick=()=>{clearInterval(timer);timer=null};$('#resetTimer').onclick=resetTimer;$('#startFocusHero').onclick=()=>goto('focus');$('#fullBtn').onclick=()=>$('#focusRoom').requestFullscreen?.();$$('.sound').forEach(b=>b.onclick=()=>{$$('.sound').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#focusSubline').textContent=b.dataset.sound==='none'?'خل الشاشة بسيطة والمهمة واضحة.':`وضع ${b.textContent} جاهز كخلفية تركيز هادئة.`})}
function initDump(){$('#parseDump').onclick=()=>{const lines=$('#dumpInput').value.split(/[\n،,.]+/).map(x=>x.trim()).filter(Boolean);$('#dumpResult').innerHTML=lines.map(x=>`<div class="dump-item"><span>${esc(x)}</span><button class="primary" data-adddump="${esc(x)}">إضافة</button></div>`).join('')||empty('اكتب أفكارك أولاً');$$('[data-adddump]').forEach(b=>b.onclick=()=>{state.tasks.unshift({id:crypto.randomUUID(),title:b.dataset.adddump,space:state.spaces[0].name,priority:'Medium',date:today,done:false});save();renderAll();toast('تحولت الفكرة لمهمة')})}}
function renderHeat(){const h=$('#heatmap');h.innerHTML='';for(let i=0;i<42;i++){const d=new Date();d.setDate(d.getDate()-41+i);const k=d.toISOString().slice(0,10);const cell=document.createElement('i');if(state.heat[k])cell.classList.add('hot');cell.title=k;h.appendChild(cell)}$('#weeklyText').textContent=state.sessions||state.xp?`عندك ${state.sessions} جلسات تركيز و ${state.xp} XP. استمر بنفس الهدوء.`:'ابدأ بإنجاز مهام وجلسات تركيز عشان تظهر التحليلات.'}
function initNav(){$$('[data-page]').forEach(b=>b.onclick=()=>goto(b.dataset.page));$$('[data-jump]').forEach(b=>b.onclick=()=>goto(b.dataset.jump));$('#openCmd').onclick=openCmd;document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCmd()}if(e.key==='Escape')$('#cmd').classList.add('hidden')})}
function openCmd(){const cmd=$('#cmd'),list=$('#cmdList'),input=$('#cmdInput');cmd.classList.remove('hidden');input.value='';input.focus();const items=[['focus','افتح Focus Room'],['task','أضف مهمة'],['brain','افتح Brain Dump'],['settings','الإعدادات']];function draw(){const q=input.value.toLowerCase();list.innerHTML=items.filter(i=>i.join(' ').includes(q)).map(i=>`<div class="cmd-row" data-cmd="${i[0]}">${i[1]}</div>`).join('');$$('[data-cmd]').forEach(r=>r.onclick=()=>{cmd.classList.add('hidden');const c=r.dataset.cmd;if(c==='task')openTask();else goto(c==='brain'?'dump':c)})}input.oninput=draw;draw()}$('#cmd').onclick=e=>{if(e.target.id==='cmd')e.currentTarget.classList.add('hidden')}
function renderAll(){applyTheme();renderAuth();renderTasks();renderSpaces();renderProfile();renderStats();renderHeat();renderFocusLabels();$('#dateText').textContent=new Intl.DateTimeFormat('ar-SA',{weekday:'long',day:'numeric',month:'long'}).format(new Date());$('#dailyNote').value=state.notes[today]||'';updateTimer()}
function init(){bootLoader();initAuth();initNav();initTasks();initSpaces();initSettings();initFocus();initDump();renderAll()}document.addEventListener('DOMContentLoaded',init);
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}


/* =========================================================
   NAVO V2 PREMIUM LOGIC PATCH
   - personalized greeting
   - better theme toggle
   - fullscreen safe toggle
   - motivational notifications + custom sound
   ========================================================= */
(function(){
  const qs = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];
  const motivate = [
    'خطوة صغيرة اليوم تصنع فرق كبير بكرة.',
    'ابدأ بمهمة وحدة فقط، والباقي بيصير أسهل.',
    'تركيزك الآن أهم من الكمال.',
    'أنت ما تحتاج يوم مثالي، تحتاج بداية واضحة.',
    'استمر يا بطل، Navo شايف تقدمك.'
  ];
  function userNiceName(){
    try{
      const raw = localStorage.getItem('navo_state_v3');
      const s = raw ? JSON.parse(raw) : null;
      const session = localStorage.getItem('navo_session_v3');
      const n = (s && s.profile && s.profile.name) || (s && s.user) || session || 'ويجي';
      return String(n).trim() || 'ويجي';
    }catch(e){ return 'ويجي'; }
  }
  function sound(type='soft'){
    try{
      const saved = JSON.parse(localStorage.getItem('navo_state_v3')||'{}');
      const mode = saved?.settings?.notifySound || type;
      if(mode === 'mute') return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.055, ctx.currentTime + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .42);
      gain.connect(ctx.destination);
      const notes = mode === 'spark' ? [660,880,1174] : [523.25,659.25,783.99];
      notes.forEach((f,i)=>{
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, ctx.currentTime + i*.055);
        o.connect(gain);
        o.start(ctx.currentTime + i*.055);
        o.stop(ctx.currentTime + .34 + i*.035);
      });
      setTimeout(()=>ctx.close?.(), 650);
    }catch(e){}
  }
  window.toast = function(message, opts={}){
    const stack = qs('#nToastStack');
    const fallback = qs('#toast');
    const title = opts.title || 'Navo';
    const icon = opts.icon || '✨';
    const detail = message || motivate[Math.floor(Math.random()*motivate.length)];
    if(!stack && fallback){fallback.textContent=detail; fallback.classList.add('show'); clearTimeout(window.toast.t); window.toast.t=setTimeout(()=>fallback.classList.remove('show'),2400); return;}
    const card = document.createElement('div');
    card.className = 'n-toast';
    card.innerHTML = `<div class="ico">${icon}</div><div><strong>${title}</strong><p>${detail}</p></div><button type="button" aria-label="إغلاق">×</button>`;
    stack.appendChild(card);
    sound(opts.sound);
    const close = ()=>{card.style.opacity='0';card.style.transform='translateY(10px) scale(.96)';setTimeout(()=>card.remove(),220)};
    card.querySelector('button').onclick=close;
    setTimeout(close, opts.duration || 4200);
  };
  window.updatePremiumGreeting = function(){
    const name = userNiceName();
    const h = new Date().getHours();
    const part = h < 12 ? 'صباح النور' : h < 18 ? 'مساء النشاط' : 'مساء الهدوء';
    const g = qs('#mainGreeting');
    if(g) g.textContent = `${part} يا ${name}، جاهز نرتب يومك؟`;
    const ai = qs('#aiInsight');
    if(ai) ai.textContent = `خل تركيزك على أهم خطوة الآن. ${motivate[Math.floor(Math.random()*motivate.length)]}`;
    const profile = qs('#profileName'); if(profile && (!profile.textContent || profile.textContent==='Mohammed')) profile.textContent = name;
    const rail = qs('#railUser'); if(rail) rail.textContent = '@' + name;
  };
  const oldRenderStats = window.renderStats;
  window.renderStats = function(){
    if(typeof oldRenderStats === 'function') oldRenderStats();
    try{
      const total = state.tasks.length;
      const done = state.tasks.filter(t=>t.done).length;
      const open = total - done;
      const set=(id,v)=>{const el=qs(id); if(el) el.textContent=v;};
      set('#heroOpenTasks', open);
      set('#heroDoneTasks', done);
      set('#heroMood', open===0 && total>0 ? 'Victory' : state.sessions>0 ? 'Focused' : 'Calm');
      updatePremiumGreeting();
    }catch(e){}
  };
  const oldRenderProfile = window.renderProfile;
  window.renderProfile = function(){
    if(typeof oldRenderProfile === 'function') oldRenderProfile();
    updatePremiumGreeting();
  };
  const oldApplyTheme = window.applyTheme;
  window.applyTheme = function(){
    if(typeof oldApplyTheme === 'function') oldApplyTheme();
    try{
      document.body.dataset.theme = state.settings.theme || 'dark';
      document.body.classList.toggle('light', state.settings.theme === 'frost');
      const themeBtn = qs('#themeBtn');
      if(themeBtn) themeBtn.textContent = state.settings.theme === 'frost' ? '☀' : '☾';
      qsa('[data-theme-pick]').forEach(b=>b.classList.toggle('active', b.dataset.themePick === (state.settings.theme||'dark')));
      const ns = qs('#notifySound'); if(ns) ns.value = state.settings.notifySound || 'soft';
    }catch(e){}
  };
  const oldInitSettings = window.initSettings;
  window.initSettings = function(){
    if(typeof oldInitSettings === 'function') oldInitSettings();
    qsa('[data-theme-pick]').forEach(btn=>{
      btn.onclick=()=>{state.settings.theme=btn.dataset.themePick; save(); applyTheme(); toast('تم تغيير ألوان الواجهة بنجاح', {title:'الثيم جاهز', icon:'🎨'});};
    });
    const ns=qs('#notifySound');
    if(ns) ns.onchange=e=>{state.settings.notifySound=e.target.value; save(); toast('تم حفظ صوت التنبيه الجديد', {title:'الصوت', icon:'🔔', sound:e.target.value});};
    const test=qs('#testNotify');
    if(test) test.onclick=()=>toast(motivate[Math.floor(Math.random()*motivate.length)], {title:'تحفيز سريع', icon:'⚡'});
    const saveBtn=qs('#saveProfile');
    if(saveBtn){
      const old=saveBtn.onclick;
      saveBtn.onclick=()=>{ if(old) old(); updatePremiumGreeting(); toast('تم تحديث اسمك داخل الداشبورد', {title:'الملف الشخصي', icon:'👤'}); };
    }
  };
  const oldInitFocus = window.initFocus;
  window.initFocus = function(){
    if(typeof oldInitFocus === 'function') oldInitFocus();
    const btn=qs('#fullBtn'), room=qs('#focusRoom');
    if(btn && room){
      btn.onclick=async()=>{
        try{
          if(document.fullscreenElement){ await document.exitFullscreen(); }
          else { await room.requestFullscreen(); }
        }catch(e){ toast('المتصفح منع وضع الشاشة الكاملة، جرّب تضغط الزر مرة ثانية.', {title:'تنبيه', icon:'⚠️', sound:'mute'}); }
      };
      document.addEventListener('fullscreenchange',()=>{ btn.textContent = document.fullscreenElement ? '↙' : '⛶'; });
    }
    const st=qs('#startTimer');
    if(st){ const old=st.onclick; st.onclick=()=>{ if(old) old(); toast('جلسة تركيز بدأت. خلك على مهمة وحدة فقط.', {title:'Focus Mode', icon:'🎯'}); }; }
  };
  const oldToggleTask = window.toggleTask;
  window.toggleTask = function(id){
    const before = (window.state?.tasks||[]).find(t=>t.id===id)?.done;
    if(typeof oldToggleTask === 'function') oldToggleTask(id);
    const after = (window.state?.tasks||[]).find(t=>t.id===id)?.done;
    if(!before && after) toast(motivate[Math.floor(Math.random()*motivate.length)], {title:'إنجاز جديد +25 XP', icon:'🏆'});
  };
  const oldStartTimer = window.startTimer;
  window.startTimer = function(){
    if(typeof oldStartTimer === 'function') oldStartTimer();
  };
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{ updatePremiumGreeting(); applyTheme?.(); }, 80);
    setTimeout(()=>toast('نسخة Navo الجديدة جاهزة — رتّب يومك بهدوء.', {title:'أهلًا بك', icon:'✨'}), 900);
  });
})();
