const API = "";
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

let mode = "login";
let token = localStorage.getItem("navo_token") || "";
let me = null;
let tasks = [];
let page = "home";

let timer = null;
let focusLeft = 25 * 60;
let focusTotal = 25 * 60;
let focusRunning = false;
let focusFullscreen = false;
let activeSound = "soft";
let notificationTimer = null;

const localSpacesKey = "navo_local_spaces";
const settingsKey = "navo_user_settings";
const defaultSpaces = [
  {id:"study", name:"الدراسة", color:"#5BE7FF", icon:"📚"},
  {id:"code", name:"البرمجة", color:"#1FA2FF", icon:"💻"},
  {id:"life", name:"الشخصي", color:"#7C5CFF", icon:"🌙"},
];

const defaultSettings = {
  theme: "dark",
  sounds: true,
  reminders: true,
  lively: true
};

function getSettings(){
  try { return {...defaultSettings, ...(JSON.parse(localStorage.getItem(settingsKey)) || {})}; }
  catch { return {...defaultSettings}; }
}

function setSettings(next){
  localStorage.setItem(settingsKey, JSON.stringify({...getSettings(), ...next}));
  applySettings();
}

function spaces(){
  try { return JSON.parse(localStorage.getItem(localSpacesKey)) || defaultSpaces; }
  catch { return defaultSpaces; }
}

function saveSpaces(list){
  localStorage.setItem(localSpacesKey, JSON.stringify(list));
}

function toast(t){
  const el = $("#toast");
  el.textContent = t;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2400);
}

function notify(title, message, tone="info"){
  const el = $("#navoNotify");
  if(!el) return toast(message);
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(message)}</span>`;
  el.classList.add("show");
  if(getSettings().sounds) playTone(tone);
  clearTimeout(notify.t);
  notify.t = setTimeout(() => el.classList.remove("show"), 4200);
}

function playTone(type="info"){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const tones = {
      info: [520, 660],
      success: [620, 880],
      warning: [300, 240],
      focus: [180, 260],
      complete: [740, 980]
    };
    const [a,b] = tones[type] || tones.info;

    osc.type = "sine";
    osc.frequency.setValueAtTime(a, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(b, ctx.currentTime + .14);
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.055, ctx.currentTime + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + .30);
  }catch{}
}

function celebrate(){
  const wrap = $("#celebrate");
  if(!wrap) return;
  wrap.classList.remove("hidden");
  wrap.innerHTML = "";
  for(let i=0;i<34;i++){
    const c = document.createElement("i");
    c.className = "confetti";
    c.style.left = Math.random()*100 + "vw";
    c.style.background = ["#5BE7FF","#1FA2FF","#7C5CFF","#FFD166","#3EE58E"][i%5];
    c.style.animationDelay = Math.random()*0.35 + "s";
    c.style.transform = `rotate(${Math.random()*180}deg)`;
    wrap.appendChild(c);
  }
  setTimeout(() => {
    wrap.classList.add("hidden");
    wrap.innerHTML = "";
  }, 1900);
}

async function request(path, opts={}){
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(opts.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw data;
  return data;
}

function setMode(m){
  mode = m;
  $("#loginTab").classList.toggle("active", m === "login");
  $("#registerTab").classList.toggle("active", m === "register");
  $("#authTitle").textContent = m === "login" ? "تسجيل الدخول" : "إنشاء حساب";
  $("#authChip").textContent = m === "login" ? "WELCOME BACK" : "CREATE ACCOUNT";
  $("#submitBtn").textContent = m === "login" ? "دخول" : "إنشاء حساب";
  $("#msg").textContent = "";
}

function priority(p){
  return p === "high" ? "عالية" : p === "low" ? "خفيفة" : "متوسطة";
}

function esc(v){
  return String(v ?? "").replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

function progressPercent(){
  if(!tasks.length) return 0;
  return Math.round((tasks.filter(t => t.done).length / tasks.length) * 100);
}

function format(sec){
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function updateToday(){
  const el = $("#todayText");
  if(el){
    el.textContent = new Intl.DateTimeFormat("ar-SA", {weekday:"long", day:"numeric", month:"long"}).format(new Date());
  }
}

function quote(){
  const list = [
    "مهمة وحدة تكفي عشان اليوم يتحسن.",
    "ابدأ بخطوة صغيرة، وكمل بهدوء.",
    "التركيز مو ضغط، التركيز مساحة.",
    "رتب القليل اليوم، ترتاح بكرة.",
    "لا تنتظر المزاج، اصنع بداية بسيطة."
  ];
  return list[new Date().getDate() % list.length];
}

async function loadMe(){
  try{
    const data = await request("/api/me");
    me = data.user;
    tasks = data.tasks || [];
    $("#auth").classList.add("hidden");
    $("#app").classList.remove("hidden");
    updateToday();
    applySettings();
    renderAll();
    scheduleSmartNotifications();
  }catch{
    localStorage.removeItem("navo_token");
    token = "";
  }
}

function renderAll(){
  if(!me) return;

  $("#sideName").textContent = me.displayName;
  $("#sideRole").textContent = me.role;
  $("#avatar").textContent = me.displayName.slice(0,1).toUpperCase();
  $("#adminBtn").classList.toggle("hidden", !["owner","admin"].includes(me.role));

  renderHome();
  renderTasks();
  renderFocus();
  renderSpaces();
  renderProfile();
  renderSettings();
  renderSupport();
}

function renderHome(){
  const done = tasks.filter(t => t.done).length;
  const open = tasks.length - done;
  $("#home").innerHTML = `
    <div class="grid">
      <section class="hero glass">
        <div>
          <span class="chip">NAVO ALIVE</span>
          <h2>حيّاك يا ${esc(me.displayName)}</h2>
          <p>${esc(quote())}</p>
          <div class="hero-actions">
            <button class="btn primary" data-action="task">+ مهمة جديدة</button>
            <button class="btn ghost" data-action="focusPage">ابدأ تركيز</button>
            <button class="btn ghost" data-action="openSupport">أرسل اقتراح</button>
          </div>
        </div>
        <div class="orb" style="--p:${progressPercent()}">
          <div>
            <b>${me.level}</b><br>
            <span>Level</span>
          </div>
        </div>
      </section>

      <section class="stats grid">
        ${metric("XP", me.xp, "نقاطك")}
        ${metric("Level", me.level, "مستواك")}
        ${metric("Focus", me.focusMinutes + "m", "دقائق تركيز")}
        ${metric("Progress", progressPercent() + "%", "إنجاز المهام")}
      </section>

      <section class="mood-strip">
        <div class="mood-card glass" data-action="task"><b>⚡</b><span>ابدأ مهمة</span></div>
        <div class="mood-card glass" data-action="focusPage"><b>🎧</b><span>جلسة تركيز</span></div>
        <div class="mood-card glass" data-action="spacesPage"><b>🧩</b><span>رتّب مساحاتك</span></div>
        <div class="mood-card glass" data-action="openSupport"><b>💡</b><span>اقترح علينا</span></div>
      </section>

      <section class="two grid">
        <div class="panel glass">
          <div class="section-head">
            <h2>تحدي اليوم</h2>
            <button class="btn primary small" data-action="task">ابدأ</button>
          </div>
          <div class="challenge-card">
            <strong>${open > 0 ? "خلص مهمتين اليوم" : "أضف هدفك التالي"}</strong>
            <p class="muted">${open > 0 ? "كل مهمة تنجزها ترفع XP وتعطيك شعور إنجاز." : "ما عندك مهام مفتوحة، وقت ممتاز تضيف هدف جديد."}</p>
            <div class="progress-bar" style="--w:${Math.min(100,done*50)}%"><i></i></div>
          </div>
        </div>

        <div class="panel glass">
          <div class="section-head">
            <h2>آخر المهام</h2>
            <button class="btn primary small" data-action="task">إضافة</button>
          </div>
          ${taskList(tasks.slice(0,5))}
        </div>
      </section>

      <section class="panel glass">
        <div class="section-head">
          <h2>مساحاتك</h2>
          <button class="btn ghost small" data-action="space">إضافة مساحة</button>
        </div>
        <div class="space-grid">
          ${spaces().slice(0,4).map(spaceCard).join("")}
        </div>
      </section>
    </div>
  `;
  bindActions($("#home"));
}

function metric(title, value, sub){
  return `<div class="stat glass"><span class="muted">${title}</span><strong>${value}</strong><small class="muted">${sub}</small></div>`;
}

function renderTasks(){
  $("#tasksPage").innerHTML = `
    <div class="panel glass">
      <div class="section-head">
        <div>
          <span class="chip">TASK FLOW</span>
          <h2>المهام</h2>
          <p class="muted">كل مهمة تخلصها تزيدك XP وتطلع لك تنبيه إنجاز.</p>
        </div>
        <button class="btn primary" data-action="task">+ مهمة</button>
      </div>
      ${taskList(tasks)}
    </div>
  `;
  bindActions($("#tasksPage"));
}

function taskList(list){
  if(!list.length) return `<div class="empty">ما فيه مهام للحين. أضف أول مهمة.</div>`;
  return list.map(t => `
    <div class="task ${t.done ? "done" : ""}">
      <div>
        <h3>${esc(t.title)}</h3>
        <div class="tags">
          <span class="tag ${t.priority}">${priority(t.priority)}</span>
          <span class="tag">${t.done ? "منجزة" : "قيد التنفيذ"}</span>
        </div>
      </div>
      <div class="task-actions">
        <button title="إنجاز" data-action="toggleTask" data-id="${t.id}" data-done="${t.done ? "false" : "true"}">${t.done ? "↺" : "✓"}</button>
        <button title="حذف" data-action="deleteTask" data-id="${t.id}">×</button>
      </div>
    </div>
  `).join("");
}

function renderFocus(){
  $("#focusPage").innerHTML = `
    <div class="focus-shell">
      <section id="focusRoom" class="focus-room glass ${focusRunning ? "running" : ""} ${focusFullscreen ? "focus-fullscreen" : ""}">
        <div>
          <span class="chip">DEEP FOCUS</span>
          <h2>جلسة تركيز هادئة</h2>
          <p class="muted">كل جلسة مكتملة تضيف +75 XP. كبر الشاشة لو تبغى تركيز كامل.</p>
          <div class="timer"><b id="timerText">${format(focusLeft)}</b></div>
          <div class="focus-controls">
            <button class="btn primary" data-action="toggleFocus">${focusRunning ? "إيقاف مؤقت" : "ابدأ"}</button>
            <button class="btn ghost" data-action="resetFocus">إعادة</button>
            <button class="btn ghost" data-action="fullFocus">${focusFullscreen ? "تصغير" : "تكبير الشاشة"}</button>
          </div>
        </div>
      </section>

      <aside class="panel glass">
        <span class="chip">FOCUS TOOLS</span>
        <h2>إعداد الجلسة</h2>
        <p class="muted">اختر المدة والصوت المناسب لك.</p>
        <label>مدة التركيز
          <select id="focusMinutes">
            <option value="15">15 دقيقة</option>
            <option value="25">25 دقيقة</option>
            <option value="45">45 دقيقة</option>
            <option value="60">60 دقيقة</option>
          </select>
        </label>

        <div class="focus-tools">
          <b>أصوات هادئة</b>
          <div class="sound-pills">
            <button data-action="sound" data-sound="soft" class="${activeSound==="soft"?"active":""}">Soft</button>
            <button data-action="sound" data-sound="rain" class="${activeSound==="rain"?"active":""}">Rain</button>
            <button data-action="sound" data-sound="deep" class="${activeSound==="deep"?"active":""}">Deep</button>
            <button data-action="sound" data-sound="off" class="${activeSound==="off"?"active":""}">Off</button>
          </div>
        </div>

        <div class="data-box" style="margin-top:14px">
          <b>إحصائياتك</b><br>
          الجلسات: ${me.focusSessions}<br>
          الدقائق: ${me.focusMinutes}m<br>
          XP: ${me.xp}
        </div>
      </aside>
    </div>
  `;
  $("#focusMinutes").value = String(focusTotal / 60);
  $("#focusMinutes").onchange = () => {
    focusTotal = Number($("#focusMinutes").value) * 60;
    focusLeft = focusTotal;
    focusRunning = false;
    clearInterval(timer);
    timer = null;
    renderFocus();
  };
  document.body.classList.toggle("full-focus-active", focusFullscreen);
  bindActions($("#focusPage"));
}

function renderSpaces(){
  $("#spacesPage").innerHTML = `
    <div class="panel glass">
      <div class="section-head">
        <div>
          <span class="chip">SPACES</span>
          <h2>المساحات</h2>
          <p class="muted">خل كل مجال في حياتك له مساحة واضحة وحيوية.</p>
        </div>
        <button class="btn primary" data-action="space">+ مساحة</button>
      </div>
      <div class="space-grid">
        ${spaces().map(spaceCard).join("")}
      </div>
    </div>
  `;
  bindActions($("#spacesPage"));
}

function spaceCard(s){
  const related = tasks.filter(t => {
    const title = t.title.toLowerCase();
    return title.includes(s.name.toLowerCase()) || title.includes((s.icon||"").toLowerCase());
  }).length;
  return `
    <div class="space glass" style="--c:${s.color}">
      <span class="chip">${esc(s.icon || "✨")} SPACE</span>
      <h2>${esc(s.name)}</h2>
      <p class="muted">مساحة منظمة لمجالك.</p>
      <div class="space-stats">
        <span>${related} مهام مرتبطة</span>
        <span>${s.color}</span>
      </div>
    </div>
  `;
}

function renderProfile(){
  $("#profilePage").innerHTML = `
    <div class="two grid">
      <section class="panel glass">
        <div class="avatar" style="width:96px;height:96px;font-size:42px">${esc(me.displayName.slice(0,1).toUpperCase())}</div>
        <h2>${esc(me.displayName)}</h2>
        <p class="muted">@${esc(me.username)}</p>
        <div class="stats grid">
          ${metric("XP", me.xp, "نقاط")}
          ${metric("Level", me.level, "مستوى")}
        </div>
      </section>

      <section class="panel glass">
        <h2>تعديل البروفايل</h2>
        <label>اسم العرض
          <input id="displayNameInput" value="${esc(me.displayName)}">
        </label>
        <button class="btn primary full" data-action="saveProfile">حفظ الاسم</button>
      </section>
    </div>
  `;
  bindActions($("#profilePage"));
}

function renderSettings(){
  const s = getSettings();
  $("#settingsPage").innerHTML = `
    <div class="settings-grid grid">
      <section class="panel glass settings-card">
        <span class="chip">EXPERIENCE</span>
        <h2>الإعدادات</h2>
        <div class="setting-row">
          <div><b>الوضع النهاري / الليلي</b><br><small class="muted">بدّل شكل الموقع</small></div>
          <button class="btn ghost small" data-action="theme">تبديل</button>
        </div>
        <div class="setting-row">
          <div><b>الأصوات</b><br><small class="muted">أصوات التنبيهات والإنجاز</small></div>
          <button class="switch ${s.sounds ? "on":""}" data-action="toggleSetting" data-key="sounds"></button>
        </div>
        <div class="setting-row">
          <div><b>التنبيهات الذكية</b><br><small class="muted">رسائل تحفيزية أثناء الاستخدام</small></div>
          <button class="switch ${s.reminders ? "on":""}" data-action="toggleSetting" data-key="reminders"></button>
        </div>
        <div class="setting-row">
          <div><b>الحيوية والمؤثرات</b><br><small class="muted">حركات وخلفيات خفيفة</small></div>
          <button class="switch ${s.lively ? "on":""}" data-action="toggleSetting" data-key="lively"></button>
        </div>
      </section>

      <section class="panel glass">
        <h2>الألوان</h2>
        <p class="muted">تغيير سريع للهوية.</p>
        <div class="color-row">
          <button data-action="color" data-c1="#5BE7FF" data-c2="#1FA2FF" style="--c1:#5BE7FF;--c2:#1FA2FF"></button>
          <button data-action="color" data-c1="#FF9F43" data-c2="#FF5F7A" style="--c1:#FF9F43;--c2:#FF5F7A"></button>
          <button data-action="color" data-c1="#7C5CFF" data-c2="#5BE7FF" style="--c1:#7C5CFF;--c2:#5BE7FF"></button>
          <button data-action="color" data-c1="#3EE58E" data-c2="#5BE7FF" style="--c1:#3EE58E;--c2:#5BE7FF"></button>
        </div>
      </section>

      <section class="panel glass">
        <h2>حسابك</h2>
        <div class="data-box">
          المستخدم: ${esc(me.username)}<br>
          الدور: ${esc(me.role)}<br>
          الحالة: ${esc(me.status)}<br>
          تاريخ التسجيل: ${esc(me.createdAt || "")}
        </div>
      </section>

      <section class="panel glass">
        <h2>لوحة الأدمن</h2>
        <p class="muted">تظهر فقط إذا حسابك Admin أو Owner.</p>
        <button class="btn primary full ${!["owner","admin"].includes(me.role) ? "hidden" : ""}" data-action="admin">فتح لوحة الأدمن</button>
      </section>
    </div>
  `;
  bindActions($("#settingsPage"));
}

function renderSupport(){
  const el = $("#supportPage");
  if(!el) return;
  el.innerHTML = `
    <div class="two grid">
      <section class="panel glass">
        <span class="chip">SUPPORT CENTER</span>
        <h2>الدعم والاقتراحات</h2>
        <p class="muted">ارسل مشكلة أو اقتراح، وبتظهر مباشرة في لوحة الأدمن.</p>
        <button class="btn primary full" data-action="openSupport">+ تذكرة جديدة</button>
      </section>
      <section class="panel glass">
        <h2>وش تقدر ترسل؟</h2>
        <div class="data-box">
          مشكلة في الموقع<br>
          اقتراح تطوير<br>
          شكوى<br>
          طلب ميزة جديدة
        </div>
      </section>
    </div>
  `;
  bindActions(el);
}

function bindActions(root=document){
  $$("[data-action]", root).forEach(el => {
    el.onclick = async () => {
      const action = el.dataset.action;

      if(action === "task") openTask();
      if(action === "space") addSpace();
      if(action === "focusPage") setPage("focus");
      if(action === "spacesPage") setPage("spaces");
      if(action === "theme") toggleTheme();
      if(action === "admin") location.href = "/admin";
      if(action === "color") setColor(el.dataset.c1, el.dataset.c2);
      if(action === "saveProfile") saveProfile();
      if(action === "toggleTask") toggleTask(el.dataset.id, el.dataset.done === "true");
      if(action === "deleteTask") deleteTask(el.dataset.id);
      if(action === "toggleFocus") toggleFocus();
      if(action === "resetFocus") resetFocus();
      if(action === "fullFocus") toggleFullFocus();
      if(action === "sound") setFocusSound(el.dataset.sound);
      if(action === "toggleSetting") toggleSetting(el.dataset.key);
      if(action === "openSupport") openSupport();
    };
  });
}

function setPage(next){
  page = next;
  closeMenu();

  const map = {
    home: "home",
    tasks: "tasksPage",
    focus: "focusPage",
    spaces: "spacesPage",
    profile: "profilePage",
    settings: "settingsPage",
    support: "supportPage"
  };

  $$(".page").forEach(p => p.classList.toggle("active", p.id === map[next]));
  $$(".nav,.mnav").forEach(b => b.classList.toggle("active", b.dataset.page === next));

  const titles = {
    home:"الرئيسية",
    tasks:"المهام",
    focus:"التركيز",
    spaces:"المساحات",
    profile:"البروفايل",
    settings:"الإعدادات",
    support:"الدعم"
  };
  $("#pageTitle").textContent = titles[next] || "Navo";
  renderAll();
}

function openTask(){
  $("#taskId").value = "";
  $("#taskTitle").value = "";
  $("#taskPriority").value = "medium";
  $("#taskDialogTitle").textContent = "مهمة جديدة";
  $("#taskDialog").showModal();
}

async function createTask(e){
  e.preventDefault();
  try{
    await request("/api/tasks", {
      method:"POST",
      body: JSON.stringify({
        title: $("#taskTitle").value,
        priority: $("#taskPriority").value
      })
    });
    $("#taskDialog").close();
    await loadMe();
    notify("تمت إضافة المهمة", "ابدأ فيها الآن وخذ XP عند إنجازها.", "info");
  }catch{
    notify("خطأ", "صار خطأ في إضافة المهمة", "warning");
  }
}

async function toggleTask(id, done){
  try{
    await request("/api/tasks/" + id, {
      method:"PATCH",
      body: JSON.stringify({ done })
    });
    await loadMe();
    if(done){
      notify("إنجاز ممتاز", "تم إنجاز المهمة +25XP", "success");
      celebrate();
    }else{
      notify("تم التعديل", "تم إرجاع المهمة لقيد التنفيذ", "info");
    }
  }catch{
    notify("خطأ", "صار خطأ", "warning");
  }
}

async function deleteTask(id){
  try{
    await request("/api/tasks/" + id, { method:"DELETE" });
    await loadMe();
    notify("تم الحذف", "تم حذف المهمة بنجاح.", "info");
  }catch{
    notify("خطأ", "صار خطأ", "warning");
  }
}

async function saveProfile(){
  try{
    const name = $("#displayNameInput").value.trim();
    const data = await request("/api/me", {
      method:"PATCH",
      body: JSON.stringify({ displayName: name })
    });
    me = data.user;
    renderAll();
    notify("تم الحفظ", "تم تحديث اسم العرض.", "success");
  }catch{
    notify("تعذر الحفظ", "تعذر حفظ الاسم.", "warning");
  }
}

function addSpace(){
  const name = prompt("اسم المساحة:");
  if(!name) return;
  const list = spaces();
  const icons = ["✨","📚","💻","🎯","🌙","🧠","⚡","🧩"];
  list.push({
    id: "space_" + Date.now(),
    name,
    color: ["#5BE7FF","#1FA2FF","#7C5CFF","#3EE58E","#FFD166"][list.length % 5],
    icon: icons[list.length % icons.length]
  });
  saveSpaces(list);
  renderAll();
  notify("مساحة جديدة", "تمت إضافة مساحة " + name, "success");
}

function toggleTheme(){
  const s = getSettings();
  const next = s.theme === "light" ? "dark" : "light";
  setSettings({theme: next});
  notify("تم تغيير الثيم", next === "light" ? "الوضع النهاري مفعل." : "الوضع الليلي مفعل.", "info");
}

function setColor(c1,c2){
  document.documentElement.style.setProperty("--accent", c1);
  document.documentElement.style.setProperty("--accent2", c2);
  localStorage.setItem("navo_colors", JSON.stringify({c1,c2}));
  notify("تم تغيير اللون", "تم تحديث ألوان الواجهة.", "success");
}

function toggleSetting(key){
  const s = getSettings();
  setSettings({[key]: !s[key]});
  renderSettings();
  notify("تم تحديث الإعدادات", "تم حفظ التفضيل الجديد.", "info");
}

function applySettings(){
  const s = getSettings();
  document.body.classList.toggle("light", s.theme === "light");
  document.body.classList.toggle("low-graphics", !s.lively);
  if($("#themeBtn")) $("#themeBtn").textContent = s.theme === "light" ? "☀️" : "🌙";
  try{
    const colors = JSON.parse(localStorage.getItem("navo_colors"));
    if(colors){
      document.documentElement.style.setProperty("--accent", colors.c1);
      document.documentElement.style.setProperty("--accent2", colors.c2);
    }
  }catch{}
}

function setFocusSound(sound){
  activeSound = sound;
  if(sound !== "off") playTone("focus");
  renderFocus();
}

function toggleFocus(){
  if(focusRunning){
    clearInterval(timer);
    timer = null;
    focusRunning = false;
    notify("تم إيقاف التركيز", "تقدر تكمل متى ما تبغى.", "info");
    renderFocus();
    return;
  }

  focusRunning = true;
  notify("بدأ التركيز", "خل الجوال بعيد وركز على مهمة وحدة.", "focus");
  timer = setInterval(async () => {
    focusLeft--;
    const text = $("#timerText");
    if(text) text.textContent = format(focusLeft);

    if(focusLeft > 0 && focusLeft % 300 === 0 && activeSound !== "off"){
      playTone("focus");
    }

    if(focusLeft <= 0){
      await completeFocus();
    }
  }, 1000);

  renderFocus();
}

function resetFocus(){
  clearInterval(timer);
  timer = null;
  focusRunning = false;
  focusLeft = focusTotal;
  renderFocus();
  notify("تمت إعادة الجلسة", "ابدأ من جديد بهدوء.", "info");
}

function toggleFullFocus(){
  focusFullscreen = !focusFullscreen;
  document.body.classList.toggle("full-focus-active", focusFullscreen);
  renderFocus();
  notify(focusFullscreen ? "وضع التركيز الكامل" : "تم تصغير التركيز", focusFullscreen ? "الشاشة الآن مخصصة للتركيز." : "رجعت للواجهة الطبيعية.", "info");
}

async function completeFocus(){
  clearInterval(timer);
  timer = null;
  focusRunning = false;

  try{
    const data = await request("/api/focus/complete", {
      method:"POST",
      body: JSON.stringify({ minutes: focusTotal / 60 })
    });
    me = data.user;
    focusLeft = focusTotal;
    focusFullscreen = false;
    document.body.classList.remove("full-focus-active");
    await loadMe();
    notify("جلسة مكتملة", "ممتاز! حصلت على +75XP.", "complete");
    celebrate();
  }catch{
    notify("خطأ", "صار خطأ في حفظ التركيز", "warning");
  }
}

function openSupport(){
  $("#ticketType").value = "problem";
  $("#ticketTitle").value = "";
  $("#ticketMessage").value = "";
  $("#supportDialog").showModal();
}

async function submitSupport(e){
  e.preventDefault();
  try{
    const data = await request("/api/support/tickets", {
      method:"POST",
      body: JSON.stringify({
        type: $("#ticketType").value,
        title: $("#ticketTitle").value,
        message: $("#ticketMessage").value
      })
    });
    $("#supportDialog").close();
    notify("تم إرسال التذكرة", "رقم التذكرة #" + data.ticketId, "success");
  }catch{
    notify("تعذر الإرسال", "تعذر إرسال التذكرة.", "warning");
  }
}

function scheduleSmartNotifications(){
  clearInterval(notificationTimer);
  if(!getSettings().reminders) return;

  notificationTimer = setInterval(() => {
    if(!me || document.hidden) return;
    const open = tasks.filter(t => !t.done).length;
    if(page === "home" && open > 0){
      notify("تذكير لطيف", `عندك ${open} مهام مفتوحة. خلص وحدة بس.`, "info");
    }else if(page === "focus" && !focusRunning){
      notify("جاهز للتركيز؟", "ابدأ جلسة 15 دقيقة فقط.", "focus");
    }
  }, 1000 * 60 * 4);
}

function openMenu(){
  $("#sidebar").classList.add("open");
  $("#overlay").classList.add("show");
}

function closeMenu(){
  $("#sidebar").classList.remove("open");
  $("#overlay").classList.remove("show");
}

function bindStatic(){
  $("#loginTab").onclick = () => setMode("login");
  $("#registerTab").onclick = () => setMode("register");

  $("#authForm").onsubmit = async(e) => {
    e.preventDefault();
    $("#msg").textContent = "";
    try{
      const body = JSON.stringify({
        username: $("#username").value.trim(),
        password: $("#password").value
      });
      const data = await request(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method:"POST",
        body
      });
      token = data.token;
      localStorage.setItem("navo_token", token);
      await loadMe();
      notify("تم تسجيل الدخول", "حيّاك في Navo.", "success");
    }catch(err){
      $("#msg").textContent =
        err.error === "USERNAME_EXISTS" ? "اسم المستخدم موجود" :
        err.error === "BANNED" ? "الحساب محظور" :
        "بيانات الدخول غير صحيحة";
      playTone("warning");
    }
  };

  $("#logout").onclick = () => {
    localStorage.removeItem("navo_token");
    location.reload();
  };

  $("#adminBtn").onclick = () => location.href = "/admin";
  $("#menuBtn").onclick = openMenu;
  $("#overlay").onclick = closeMenu;
  $("#quickTask").onclick = openTask;
  $("#themeBtn").onclick = toggleTheme;
  $("#closeTask").onclick = () => $("#taskDialog").close();
  $("#taskForm").onsubmit = createTask;
  $("#closeSupport").onclick = () => $("#supportDialog").close();
  $("#supportForm").onsubmit = submitSupport;

  $$(".nav,.mnav").forEach(b => b.onclick = () => setPage(b.dataset.page));
}

document.addEventListener("DOMContentLoaded", () => {
  bindStatic();
  updateToday();
  applySettings();
  if(token) loadMe();
});
