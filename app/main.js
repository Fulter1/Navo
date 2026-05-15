const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

const defaultState = {
  profile:{name:'Mohammed',bio:'Focus without noise.'},
  settings:{theme:'ocean',dark:true,graphics:'auto',focus:25,break:5},
  tasks:[
    {id:uid(),title:'راجع خطة اليوم',priority:'High',space:'Study',done:false},
    {id:uid(),title:'جلسة تركيز قصيرة',priority:'Medium',space:'Life',done:false}
  ],
  spaces:[
    {id:uid(),name:'Study',desc:'جامعة ومذاكرة',color:'#39d8ff'},
    {id:uid(),name:'Code',desc:'برمجة ومشاريع',color:'#5b7cff'},
    {id:uid(),name:'Life',desc:'أشياء شخصية',color:'#47dc93'},
    {id:uid(),name:'Vision',desc:'أهداف بعيدة',color:'#fb923c'}
  ],
  focusSessions:0,
  xp:120
};
let state = load();
let timerInt = null;
let seconds = state.settings.focus * 60;
let running = false;

function uid(){return Math.random().toString(36).slice(2,10)}
function load(){try{return {...defaultState,...JSON.parse(localStorage.getItem('navo-reborn')||'{}')}}catch{return defaultState}}
function save(){localStorage.setItem('navo-reborn', JSON.stringify(state))}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}

function setPage(page){
  $$('.page').forEach(p=>p.classList.toggle('active', p.id===page));
  $$('[data-page]').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const titles={dashboard:'Command Center',tasks:'المهام',focus:'الوقت والتركيز',spaces:'المساحات',profile:'البروفايل',settings:'الإعدادات'};
  $('#pageTitle').textContent=titles[page]||'Navo';
  $('#sidebar').classList.remove('open');
  render();
}

function applySettings(){
  document.body.classList.toggle('light', !state.settings.dark);
  document.body.dataset.theme = state.settings.theme;
  const low = state.settings.graphics==='low' || (state.settings.graphics==='auto' && ((navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)));
  document.body.classList.toggle('performance-low', !!low);
  $('#themeToggle').textContent = state.settings.dark ? '🌙' : '☀️';
  const g=$('#graphics'); if(g) g.value=state.settings.graphics;
  $$('.themes button').forEach(b=>b.classList.toggle('active', b.dataset.theme===state.settings.theme));
}

function renderClock(){
  const now=new Date();
  $('#liveClock').textContent=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false});
  $('#dateLine').textContent=now.toLocaleDateString('ar-SA',{weekday:'long',month:'long',day:'numeric'});
  const h=now.getHours();
  $('#clockMode').textContent = h>=5&&h<12?'Morning Flow':h<18?'Deep Work':h<22?'Evening Reset':'Night Calm';
}

function progress(){
  const total=state.tasks.length||1, done=state.tasks.filter(t=>t.done).length;
  return Math.round(done/total*100);
}

function renderDashboard(){
  const open=state.tasks.filter(t=>!t.done);
  const high=open.find(t=>t.priority==='High')||open[0];
  $('#taskCount').textContent=open.length;
  $('#donePct').textContent=progress()+'%';
  $('#sideProgress').textContent=progress()+'%';
  $('#focusCount').textContent=state.focusSessions;
  $('#oneTask').textContent=high?`${high.title} — ${high.space}`:'مساحتك نظيفة. أضف مهمة جديدة.';
  $('#smartHint').textContent=buildInsight();
  $('#greeting').textContent=`${getGreeting()} يا ${state.profile.name}`;
  renderInsights();
}
function getGreeting(){const h=new Date().getHours();return h<12?'صباح الهدوء':h<18?'يوم منتج':h<23?'مساء التركيز':'هدوء الليل'}
function buildInsight(){
  const high=state.tasks.filter(t=>!t.done&&t.priority==='High').length;
  if(!state.tasks.length) return 'ابدأ بإضافة أول مهمة وخلي Navo يرتبها لك.';
  if(high) return `عندك ${high} مهمة عالية. ابدأ بواحدة فقط ولا تشتت نفسك.`;
  if(progress()>=70) return 'أداؤك ممتاز اليوم. خذ جلسة قصيرة وخلّص آخر شيء.';
  return 'رتّب مهمة واحدة الآن، وبعدها ادخل جلسة تركيز 25 دقيقة.';
}
function renderInsights(){
  const items=[
    ['خطوة هادئة', buildInsight()],
    ['اقتراح وقت', 'أفضل بداية الآن: 25 دقيقة تركيز + 5 دقائق راحة.'],
    ['نظافة اليوم', state.tasks.length?'قلل المهام المفتوحة وخلي الأولوية واضحة.':'أضف 3 مهام فقط كبداية.']
  ];
  $('#insightList').innerHTML=items.map(([b,p])=>`<div class="insight"><b>${b}</b>${p}</div>`).join('');
}

function renderTasks(){
  const filter=$('#taskFilter')?.value||'all';
  let tasks=state.tasks;
  if(filter==='open')tasks=tasks.filter(t=>!t.done);
  if(filter==='done')tasks=tasks.filter(t=>t.done);
  if(['High','Medium','Low'].includes(filter))tasks=tasks.filter(t=>t.priority===filter);
  $('#tasksList').innerHTML = tasks.length?tasks.map(t=>`<div class="task ${t.done?'done':''}"><div><h4>${t.title}</h4><p>${t.priority} • ${t.space}</p></div><div class="actions"><button class="mini" data-done="${t.id}">${t.done?'↺':'✓'}</button><button class="mini" data-del="${t.id}">×</button></div></div>`).join(''):`<div class="one-task">مساحتك جاهزة لبداية هادئة.</div>`;
  const sel=$('#taskSpace'); if(sel) sel.innerHTML=state.spaces.map(s=>`<option>${s.name}</option>`).join('');
}

function renderSpaces(){
  $('#spacesGrid').innerHTML=state.spaces.map(s=>`<article class="space" style="--space:${s.color}"><span class="pill">SPACE</span><h3>${s.name}</h3><p>${s.desc}</p></article>`).join('');
}
function renderProfile(){
  $('#profileName').textContent=state.profile.name;
  $('#profileBio').textContent=state.profile.bio;
  $('#avatar').textContent=(state.profile.name||'M').trim()[0].toUpperCase();
  $('#profileTasks').textContent=state.tasks.length;
  $('#profileDone').textContent=state.tasks.filter(t=>t.done).length;
  $('#profileFocus').textContent=state.focusSessions;
  $('#profileSpaces').textContent=state.spaces.length;
  $('#levelFill').style.width=Math.min(100,state.xp%500/5)+'%';
  $('#displayName').value=state.profile.name;
  $('#bioInput').value=state.profile.bio;
}
function renderTimer(){
  const m=String(Math.floor(seconds/60)).padStart(2,'0'), s=String(seconds%60).padStart(2,'0');
  $('#timer').textContent=`${m}:${s}`;
}
function render(){applySettings();renderClock();renderDashboard();renderTasks();renderSpaces();renderProfile();renderTimer();save()}

function addTask(){
  const title=$('#taskTitle').value.trim();
  if(!title) return toast('اكتب عنوان المهمة أولاً');
  state.tasks.unshift({id:uid(),title,priority:$('#taskPriority').value,space:$('#taskSpace').value,done:false});
  $('#taskTitle').value=''; toast('تمت إضافة المهمة'); render();
}
function startTimer(){
  if(running) return;
  running=true; toast('بدأت جلسة التركيز');
  timerInt=setInterval(()=>{seconds--; renderTimer(); if(seconds<=0){clearInterval(timerInt);running=false;state.focusSessions++;state.xp+=50;seconds=state.settings.break*60;toast('انتهت الجلسة. خذ راحة قصيرة.');render()}},1000);
}
function pauseTimer(){running=false;clearInterval(timerInt);toast('تم إيقاف المؤقت')}
function resetTimer(){pauseTimer();seconds=Number($('#focusMinutes').value||25)*60;renderTimer()}

window.addEventListener('click',e=>{
  const page=e.target.closest('[data-page]')?.dataset.page; if(page) setPage(page);
  const done=e.target.closest('[data-done]')?.dataset.done; if(done){const t=state.tasks.find(x=>x.id===done);t.done=!t.done;state.xp+=t.done?20:-20;render()}
  const del=e.target.closest('[data-del]')?.dataset.del; if(del){state.tasks=state.tasks.filter(t=>t.id!==del);render()}
});
$('#quickTask').onclick=()=>setPage('tasks');
$('#addTask').onclick=addTask;
$('#taskFilter').onchange=renderTasks;
$('#refreshInsight').onclick=()=>{renderInsights();toast('تم تحديث اقتراح Navo')};
$('#themeToggle').onclick=()=>{state.settings.dark=!state.settings.dark;render()};
$('#menuToggle').onclick=()=>$('#sidebar').classList.toggle('open');
$('#startTimer').onclick=startTimer;$('#pauseTimer').onclick=pauseTimer;$('#resetTimer').onclick=resetTimer;
$('[data-action="start-focus"]').onclick=()=>{setPage('focus');startTimer()};
$('#focusMinutes').onchange=()=>{state.settings.focus=Number($('#focusMinutes').value||25);seconds=state.settings.focus*60;render()};
$('#breakMinutes').onchange=()=>{state.settings.break=Number($('#breakMinutes').value||5);render()};
$('#addSpace').onclick=()=>{const name=prompt('اسم المساحة؟');if(name){state.spaces.push({id:uid(),name,desc:'مساحة جديدة',color:'var(--accent)'});render()}};
$('#saveProfile').onclick=()=>{state.profile.name=$('#displayName').value.trim()||'Mohammed';state.profile.bio=$('#bioInput').value.trim()||'Focus without noise.';toast('تم حفظ البروفايل');render()};
$$('.themes button').forEach(b=>b.onclick=()=>{state.settings.theme=b.dataset.theme;render()});
$('#graphics').onchange=()=>{state.settings.graphics=$('#graphics').value;render()};
$('#exportData').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='navo-data.json';a.click()};
$('#resetData').onclick=()=>{if(confirm('تأكيد تصفير البيانات؟')){state=structuredClone(defaultState);save();render()}};
setInterval(renderClock,1000);
render();
