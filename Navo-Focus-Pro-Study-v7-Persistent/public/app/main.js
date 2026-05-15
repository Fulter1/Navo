const API = "";
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

let mode = "login";
let token = localStorage.getItem("navo_token") || "";
let me = null;
let tasks = [];
let page = "home";

let timer = null;
let focusLeft = Number(localStorage.getItem("navo_focus_minutes") || 25) * 60;
let focusTotal = Number(localStorage.getItem("navo_focus_minutes") || 25) * 60;
let focusRunning = false;
let focusModeType = "focus";
let focusBreakMinutes = Number(localStorage.getItem("navo_break_minutes") || 5);
let focusSessionsTarget = Number(localStorage.getItem("navo_focus_sessions") || 4);
let focusSessionDone = Number(localStorage.getItem("navo_focus_done") || 0);
let focusStudyFullscreen = false;
let focusSettingsOpen = localStorage.getItem("navo_focus_settings_open") !== "false";
let navoAudioCtx = null;
let focusTickFlip = false;
const focusPersistentKey = "navo_focus_timer_state";
let focusEndAt = Number(localStorage.getItem("navo_focus_end_at") || 0);
let focusPausedLeft = Number(localStorage.getItem("navo_focus_paused_left") || 0);

let cleanFocusFullscreen = false;

const localSpacesKey = "navo_local_spaces";
const defaultSpaces = [
  {id:"study", name:"الدراسة", color:"#5BE7FF"},
  {id:"code", name:"البرمجة", color:"#1FA2FF"},
  {id:"life", name:"الشخصي", color:"#7C5CFF"},
];

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


function cleanNotify(title, message, tone="info"){
  const el = $("#navoAlert");
  if(!el) return toast(message);
  el.innerHTML = `<b>${esc(title)}</b><span>${esc(message)}</span>`;
  el.classList.add("show");
  cleanTone(tone);
  clearTimeout(cleanNotify.t);
  cleanNotify.t = setTimeout(() => el.classList.remove("show"), 3600);
}

function cleanTone(tone="info"){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const map = {
      info:[520,650],
      success:[620,880],
      warning:[260,220],
      focus:[180,260]
    };
    const [a,b] = map[tone] || map.info;
    osc.type = "sine";
    osc.frequency.setValueAtTime(a, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(b, ctx.currentTime + .12);
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.045, ctx.currentTime + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + .26);
  }catch{}
}

function cleanCelebrate(){
  const wrap = $("#cleanConfetti");
  if(!wrap) return;
  wrap.classList.remove("hidden");
  wrap.innerHTML = "";
  const colors = ["#5BE7FF","#1FA2FF","#7C5CFF","#FFD166","#3EE58E"];
  for(let i=0;i<26;i++){
    const p = document.createElement("i");
    p.style.left = Math.random()*100 + "vw";
    p.style.background = colors[i % colors.length];
    p.style.animationDelay = Math.random()*0.28 + "s";
    wrap.appendChild(p);
  }
  setTimeout(() => {
    wrap.classList.add("hidden");
    wrap.innerHTML = "";
  }, 1700);
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

async function loadMe(){
  try{
    const data = await request("/api/me");
    me = data.user;
    tasks = data.tasks || [];
    $("#auth").classList.add("hidden");
    $("#app").classList.remove("hidden");
    updateToday();
    renderAll();
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
  $("#adminBtn").classList.toggle("hidden", me.role !== "admin");

  renderHome();
  renderTasks();
  renderFocus();
  renderSpaces();
  renderProfile();
  renderSettings();
  renderSupport();
}

function renderHome(){
  $("#home").innerHTML = `
    <div class="grid">
      <section class="hero glass">
        <div>
          <span class="chip">NAVO PROGRESS</span>
          <h2>حيّاك يا ${esc(me.displayName)}</h2>
          <p>تابع مهامك، ابدأ جلسات تركيز، وارفع XP والLevel حقك.</p>
          <div class="hero-actions"><button class="btn primary" data-action="task">+ مهمة جديدة</button>
          <button class="btn ghost" data-action="focusPage">ابدأ تركيز</button>
          <button class="btn ghost" data-action="openSupport">اقتراح / مشكلة</button></div>
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
        ${metric("Tasks", tasks.length, "عدد المهام")}
      </section>

      <section class="two grid">
        <div class="panel glass">
          <div class="section-head">
            <h2>آخر المهام</h2>
            <button class="btn primary small" data-action="task">إضافة</button>
          </div>
          ${taskList(tasks.slice(0,5))}
        </div>

        <div class="panel glass">
          <div class="section-head">
            <h2>المساحات</h2>
            <button class="btn ghost small" data-action="space">إضافة مساحة</button>
          </div>
          <div class="space-grid">
            ${spaces().slice(0,3).map(spaceCard).join("")}
          </div>
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
          <h2>المهام</h2>
          <p class="muted">كل مهمة تخلصها تزيدك XP.</p>
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
  const totalSeconds = focusModeType === "focus" ? focusTotal : focusBreakMinutes * 60;
  const passed = Math.max(0, totalSeconds - focusLeft);
  const progress = totalSeconds > 0 ? Math.min(100, Math.round((passed / totalSeconds) * 100)) : 0;
  const isBreak = focusModeType === "break";
  const isLastMinute = focusLeft <= 60 && focusRunning;
  const stageTitle = isBreak ? "بريك بدون مشتتات" : "جلسة مذاكرة عميقة";
  const stageSub = isBreak
    ? "خذ راحة خفيفة، اشرب موية، وارجع تلقائيًا للجلسة التالية."
    : "ركز على مادة وحدة فقط. المؤقت يكمل حتى لو طلعت من الصفحة.";
  const stateText = isBreak ? "BREAK" : "STUDY";
  const focusMinutesValue = Math.round(focusTotal / 60);
  const motivation = isBreak
    ? "لا تحول البريك لتشتت. خذ نفس، تمدد، وارجع."
    : "كل ثانية تركيز الآن تختصر عليك تعب كثير بعدين.";
  const dots = Array.from({length: focusSessionsTarget}, (_, i) => `<i class="${i < focusSessionDone ? "active" : ""}"></i>`).join("");

  $("#focusPage").innerHTML = `
    <div class="focus-pro ${focusSettingsOpen ? "" : "settings-closed"}">
      <section id="focusStage" class="focus-stage glass ${focusRunning ? "running" : "paused"} ${isBreak ? "break-mode" : ""} ${focusStudyFullscreen ? "focus-fullscreen" : ""} ${isLastMinute ? "last-minute" : ""}">
        ${focusStudyFullscreen ? `<button class="btn ghost focus-exit-full" data-action="fullStudyFocus">تصغير</button>` : ""}
        <div class="focus-center">
          <span id="focusStateChip" class="chip focus-state-chip">${stateText} MODE</span>
          <h2 class="focus-title">${stageTitle}</h2>
          <p class="focus-sub">${stageSub}</p>

          <div id="focusRing" class="focus-ring-pro" style="--progress:${progress}">
            <div class="focus-time">
              <b id="timerText">${format(focusLeft)}</b>
              <span id="focusProgressLabel">${isBreak ? "استراحة" : "مذاكرة"} · ${progress}%</span>
              <div id="focusProgressText" class="focus-progress-text">${format(passed)} / ${format(totalSeconds)}</div>
            </div>
          </div>

          <div id="focusMiniBar" class="focus-mini-bar" style="--progress-width:${progress}%"><i></i></div>
          <div class="focus-status-dots">${dots}</div>
          <div class="focus-running-badge">${focusRunning ? "المؤقت يعمل حتى لو خرجت من الموقع" : "المؤقت متوقف"}</div>
          <div class="focus-motivation">${motivation}</div>
          <div class="focus-muted-line">${focusStudyFullscreen ? "وضع الشاشة الكاملة — Esc للخروج" : "اضغط تكبير الشاشة لتجربة مذاكرة أبسط"}</div>

          <div class="focus-buttons">
            <button class="btn primary" data-action="toggleFocus">${focusRunning ? "إيقاف مؤقت" : "ابدأ"}</button>
            <button class="btn ghost" data-action="resetFocus">إعادة</button>
            <button class="btn ghost" data-action="skipFocus">${isBreak ? "تخطي البريك" : "إنهاء الجلسة"}</button>
            <button class="btn ghost" data-action="fullStudyFocus">${focusStudyFullscreen ? "تصغير" : "تكبير الشاشة"}</button>
          </div>
        </div>
      </section>

      <aside class="focus-side-pro glass">
        <span class="chip">CUSTOM STUDY TIMER</span>
        <h2>إعداد التركيز</h2>
        <p class="muted">اكتب وقت المذاكرة والبريك بنفسك. الافتراضي 25 دقيقة مذاكرة و5 دقائق بريك.</p>

        <button class="btn ghost full focus-setup-toggle" data-action="toggleFocusSettings">
          ${focusSettingsOpen ? "إخفاء الإعدادات" : "فتح الإعدادات"}
        </button>

        <div class="focus-settings-panel ${focusSettingsOpen ? "" : "closed"}">
          <div class="focus-input-row">
            <div class="focus-control-card">
              <label>وقت المذاكرة</label>
              <div class="focus-number">
                <input id="focusMinutesInput" type="number" min="1" max="240" value="${focusMinutesValue}">
                <span>دقيقة</span>
              </div>
            </div>

            <div class="focus-control-card">
              <label>وقت البريك</label>
              <div class="focus-number">
                <input id="breakMinutesInput" type="number" min="1" max="120" value="${focusBreakMinutes}">
                <span>دقيقة</span>
              </div>
            </div>
          </div>

          <div class="focus-presets">
            <button type="button" data-action="presetFocus" data-focus="25" data-break="5">25 / 5</button>
            <button type="button" data-action="presetFocus" data-focus="45" data-break="10">45 / 10</button>
            <button type="button" data-action="presetFocus" data-focus="60" data-break="15">60 / 15</button>
            <button type="button" data-action="presetFocus" data-focus="90" data-break="20">90 / 20</button>
          </div>

          <div class="focus-controls-grid" style="margin-top:12px">
            <div class="focus-control-card">
              <label>عدد الجلسات
                <select id="sessionTarget">
                  <option value="2">جلستين</option>
                  <option value="3">3 جلسات</option>
                  <option value="4">4 جلسات</option>
                  <option value="6">6 جلسات</option>
                </select>
              </label>
            </div>

            <div class="focus-control-card">
              <label>الوضع
                <select id="focusModeSelect">
                  <option value="focus">مذاكرة</option>
                  <option value="break">بريك</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div class="focus-auto-badge">✓ نغمة + بريك تلقائي + مؤقت مستمر</div>

        <div class="focus-stat-row">
          <div class="focus-stat-mini">
            <b>${focusSessionDone}/${focusSessionsTarget}</b>
            <span class="muted">جلسات اليوم</span>
          </div>
          <div class="focus-stat-mini">
            <b>${me.focusMinutes}m</b>
            <span class="muted">إجمالي التركيز</span>
          </div>
        </div>

        <div class="focus-tips">
          <b>نصيحة للمذاكرة:</b><br>
          خلك على مؤقت واحد. لا تفتح قوائم ثانية لين يخلص.
        </div>
      </aside>
    </div>
  `;

  const sessionTarget = $("#sessionTarget");
  const focusModeSelect = $("#focusModeSelect");
  const focusMinutesInput = $("#focusMinutesInput");
  const breakMinutesInput = $("#breakMinutesInput");

  if(sessionTarget) sessionTarget.value = String(focusSessionsTarget);
  if(focusModeSelect) focusModeSelect.value = focusModeType;

  if(focusMinutesInput) focusMinutesInput.onchange = () => updateCustomFocusTimes(false);
  if(breakMinutesInput) breakMinutesInput.onchange = () => updateCustomFocusTimes(false);

  if(sessionTarget) sessionTarget.onchange = () => {
    focusSessionsTarget = Number(sessionTarget.value);
    localStorage.setItem("navo_focus_sessions", String(focusSessionsTarget));
    saveFocusRuntime();
    renderFocus();
  };

  if(focusModeSelect) focusModeSelect.onchange = () => {
    updateCustomFocusTimes(true);
    focusModeType = focusModeSelect.value;
    focusLeft = focusModeType === "focus" ? focusTotal : focusBreakMinutes * 60;
    focusRunning = false;
    clearInterval(timer);
    timer = null;
    saveFocusRuntime();
    renderFocus();
  };

  document.body.classList.toggle("full-focus-active", focusStudyFullscreen);
  bindActions($("#focusPage"));
  updateFocusVisuals();
}

function renderSpaces(){
  $("#spacesPage").innerHTML = `
    <div class="panel glass">
      <div class="section-head">
        <div>
          <h2>المساحات</h2>
          <p class="muted">تنظيم بصري لمجالاتك.</p>
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
  return `
    <div class="space glass" style="--c:${s.color}">
      <span class="chip">SPACE</span>
      <h2>${esc(s.name)}</h2>
      <p class="muted">مساحة منظمة لمجالك.</p>
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
  $("#settingsPage").innerHTML = `
    <div class="settings-grid grid">
      <section class="panel glass">
        <h2>الثيم</h2>
        <p class="muted">بدّل بين الليلي والنهاري.</p>
        <button class="btn primary full" data-action="theme">تبديل الثيم</button>
      </section>

      <section class="panel glass">
        <h2>الألوان</h2>
        <p class="muted">تغيير سريع للهوية.</p>
        <div class="color-row">
          <button data-action="color" data-c1="#5BE7FF" data-c2="#1FA2FF" style="--c1:#5BE7FF;--c2:#1FA2FF"></button>
          <button data-action="color" data-c1="#FF9F43" data-c2="#FF5F7A" style="--c1:#FF9F43;--c2:#FF5F7A"></button>
          <button data-action="color" data-c1="#7C5CFF" data-c2="#5BE7FF" style="--c1:#7C5CFF;--c2:#5BE7FF"></button>
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
        <p class="muted">تظهر فقط إذا حسابك Admin.</p>
        <button class="btn primary full ${me.role !== "admin" ? "hidden" : ""}" data-action="admin">فتح لوحة الأدمن</button>
      </section>
    </div>
  `;
  bindActions($("#settingsPage"));
}

function bindActions(root=document){
  $$("[data-action]", root).forEach(el => {
    el.onclick = async () => {
      const action = el.dataset.action;

      if(action === "task") openTask();
      if(action === "space") addSpace();
      if(action === "focusPage") setPage("focus");
      if(action === "theme") toggleTheme();
      if(action === "admin") location.href = "/admin";
      if(action === "openSupport") openSupport();
      if(action === "fullStudyFocus") toggleStudyFullscreen();
      if(action === "skipFocus") skipFocusStep();
      if(action === "presetFocus") applyFocusPreset(el.dataset.focus, el.dataset.break);
      if(action === "toggleFocusSettings") toggleFocusSettings();
      if(action === "fullFocus") cleanToggleFullFocus();
      if(action === "color") setColor(el.dataset.c1, el.dataset.c2);
      if(action === "saveProfile") saveProfile();
      if(action === "toggleTask") toggleTask(el.dataset.id, el.dataset.done === "true");
      if(action === "deleteTask") deleteTask(el.dataset.id);
      if(action === "toggleFocus") toggleFocus();
      if(action === "resetFocus") resetFocus();
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
    cleanNotify("تمت إضافة المهمة", "ابدأ فيها وخذ XP عند إنجازها.", "info");
  }catch{
    toast("صار خطأ في إضافة المهمة");
  }
}

async function toggleTask(id, done){
  try{
    await request("/api/tasks/" + id, {
      method:"PATCH",
      body: JSON.stringify({ done })
    });
    await loadMe();
    if(done){ cleanNotify("إنجاز ممتاز", "تم إنجاز المهمة +25XP", "success"); cleanCelebrate(); } else { cleanNotify("تم التعديل", "تم إرجاع المهمة", "info"); }
  }catch{
    toast("صار خطأ");
  }
}

async function deleteTask(id){
  try{
    await request("/api/tasks/" + id, { method:"DELETE" });
    await loadMe();
    toast("تم حذف المهمة");
  }catch{
    toast("صار خطأ");
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
    toast("تم حفظ الاسم");
  }catch{
    toast("تعذر حفظ الاسم");
  }
}

function addSpace(){
  const name = prompt("اسم المساحة:");
  if(!name) return;
  const list = spaces();
  list.push({
    id: "space_" + Date.now(),
    name,
    color: "#5BE7FF"
  });
  saveSpaces(list);
  renderAll();
  cleanNotify("مساحة جديدة", "تمت إضافة المساحة بنجاح.", "success");
}

function toggleTheme(){
  document.body.classList.toggle("light");
  $("#themeBtn").textContent = document.body.classList.contains("light") ? "☀️" : "🌙";
}

function setColor(c1,c2){
  document.documentElement.style.setProperty("--accent", c1);
  document.documentElement.style.setProperty("--accent2", c2);
  toast("تم تغيير اللون");
}

function toggleFocus(){
  ensureFocusAudio();

  if(focusRunning){
    focusLeft = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
    clearInterval(timer);
    timer = null;
    focusRunning = false;
    focusEndAt = 0;
    saveFocusRuntime();
    if(typeof cleanNotify === "function") cleanNotify("إيقاف مؤقت", "المؤقت توقف، وتقدر تكمل لاحقًا.", "info");
    else toast("تم الإيقاف المؤقت");
    renderFocus();
    return;
  }

  focusRunning = true;
  focusEndAt = Date.now() + (focusLeft * 1000);
  saveFocusRuntime();

  if(typeof cleanNotify === "function") cleanNotify(focusModeType === "break" ? "بدأ البريك" : "بدأت المذاكرة", focusModeType === "break" ? "خذ نفس بدون مشتتات." : "المؤقت يكمل حتى لو خرجت من الصفحة.", "focus");

  renderFocus();
  restartPersistentInterval();
}

function resetFocus(){
  clearInterval(timer);
  timer = null;
  focusRunning = false;
  focusEndAt = 0;
  focusLeft = focusModeType === "focus" ? focusTotal : focusBreakMinutes * 60;
  saveFocusRuntime();
  renderFocus();
  if(typeof cleanNotify === "function") cleanNotify("تمت الإعادة", "رجع المؤقت للبداية.", "info");
  else toast("تمت إعادة الجلسة");
}

async function completeFocus(){
  clearInterval(timer);
  timer = null;
  focusRunning = false;
  focusEndAt = 0;

  try{
    const data = await request("/api/focus/complete", {
      method:"POST",
      body: JSON.stringify({ minutes: focusTotal / 60 })
    });

    me = data.user;
    focusSessionDone += 1;
    localStorage.setItem("navo_focus_done", String(focusSessionDone));

    playFocusChime("done");

    const stage = $("#focusStage");
    if(stage){
      stage.classList.add("finished-flash");
      setTimeout(() => stage.classList.remove("finished-flash"), 1500);
    }

    if(typeof cleanCelebrate === "function") cleanCelebrate();
    if(typeof cleanNotify === "function") cleanNotify("انتهت المذاكرة", "ممتاز! بدأ البريك تلقائيًا.", "success");
    else toast("انتهت المذاكرة، بدأ البريك");

    if(focusSessionDone >= focusSessionsTarget){
      focusModeType = "focus";
      focusLeft = focusTotal;
      focusStudyFullscreen = false;
      document.body.classList.remove("full-focus-active");
      clearFocusRuntime();
      if(document.fullscreenElement){
        try{ await document.exitFullscreen(); }catch{}
      }
      if(typeof cleanNotify === "function") cleanNotify("أنهيت هدف اليوم", "خلصت عدد الجلسات المحدد. فخورين فيك!", "success");
      renderAll();
      setPage("focus");
      return;
    }

    focusModeType = "break";
    focusLeft = focusBreakMinutes * 60;
    focusRunning = true;
    focusEndAt = Date.now() + (focusLeft * 1000);
    saveFocusRuntime();

    renderAll();
    setPage("focus");
    restartPersistentInterval();
  }catch{
    if(typeof cleanNotify === "function") cleanNotify("خطأ", "صار خطأ في حفظ الجلسة.", "warning");
    else toast("صار خطأ في حفظ التركيز");
  }
}





function saveFocusRuntime(){
  const data = {
    mode: focusModeType,
    running: focusRunning,
    left: focusLeft,
    endAt: focusEndAt,
    focusMinutes: focusTotal / 60,
    breakMinutes: focusBreakMinutes,
    sessionsTarget: focusSessionsTarget,
    sessionsDone: focusSessionDone,
    fullscreen: focusStudyFullscreen,
    savedAt: Date.now()
  };
  localStorage.setItem(focusPersistentKey, JSON.stringify(data));
  localStorage.setItem("navo_focus_end_at", String(focusEndAt || 0));
  localStorage.setItem("navo_focus_paused_left", String(focusRunning ? 0 : focusLeft));
}

function loadFocusRuntime(){
  try{
    const data = JSON.parse(localStorage.getItem(focusPersistentKey) || "{}");
    if(!data || !data.mode) return;

    focusModeType = data.mode || "focus";
    focusTotal = Number(data.focusMinutes || 25) * 60;
    focusBreakMinutes = Number(data.breakMinutes || 5);
    focusSessionsTarget = Number(data.sessionsTarget || focusSessionsTarget);
    focusSessionDone = Number(data.sessionsDone || focusSessionDone);
    focusEndAt = Number(data.endAt || 0);

    if(data.running && focusEndAt > Date.now()){
      focusRunning = true;
      focusLeft = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
      restartPersistentInterval();
    }else if(data.running && focusEndAt <= Date.now()){
      focusRunning = false;
      focusLeft = 0;
      setTimeout(() => {
        if(focusModeType === "focus") completeFocus();
        else completeBreak();
      }, 500);
    }else{
      focusRunning = false;
      focusLeft = Number(data.left || (focusModeType === "focus" ? focusTotal : focusBreakMinutes * 60));
    }
  }catch{}
}

function restartPersistentInterval(){
  clearInterval(timer);
  timer = setInterval(async () => {
    if(!focusRunning || !focusEndAt) return;
    focusLeft = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
    updateFocusVisuals();
    saveFocusRuntime();

    if(focusLeft <= 0){
      if(focusModeType === "focus") await completeFocus();
      else completeBreak();
    }
  }, 1000);
}

function clearFocusRuntime(){
  focusEndAt = 0;
  localStorage.removeItem("navo_focus_end_at");
  localStorage.removeItem("navo_focus_paused_left");
  localStorage.removeItem(focusPersistentKey);
}

function getFocusTotalSeconds(){
  return focusModeType === "focus" ? focusTotal : focusBreakMinutes * 60;
}

function updateFocusVisuals(){
  const totalSeconds = getFocusTotalSeconds();
  const passed = Math.max(0, totalSeconds - focusLeft);
  const progress = totalSeconds > 0 ? Math.min(100, Math.round((passed / totalSeconds) * 100)) : 0;
  const isBreak = focusModeType === "break";

  const timerText = $("#timerText");
  if(timerText) timerText.textContent = format(focusLeft);

  const ring = $("#focusRing");
  if(ring) ring.style.setProperty("--progress", progress);

  const bar = $("#focusMiniBar");
  if(bar) bar.style.setProperty("--progress-width", progress + "%");

  const label = $("#focusProgressLabel");
  if(label) label.textContent = `${isBreak ? "استراحة" : "مذاكرة"} · ${progress}%`;

  const progressText = $("#focusProgressText");
  if(progressText) progressText.textContent = `${format(passed)} / ${format(totalSeconds)}`;

  const stage = $("#focusStage");
  if(stage){
    stage.classList.toggle("last-minute", focusLeft <= 60 && focusRunning);
    focusTickFlip = !focusTickFlip;
    stage.classList.toggle("tick", focusTickFlip);
    window.setTimeout(() => stage.classList.remove("tick"), 130);
  }
}

function ensureFocusAudio(){
  try{
    if(!navoAudioCtx) navoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(navoAudioCtx.state === "suspended") navoAudioCtx.resume();
  }catch{}
}

function playFocusChime(type="done"){
  try{
    ensureFocusAudio();
    if(!navoAudioCtx) return;

    const now = navoAudioCtx.currentTime;
    const notes = type === "break"
      ? [523.25, 659.25, 783.99]
      : [659.25, 880, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = navoAudioCtx.createOscillator();
      const gain = navoAudioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.13);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.13 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.13 + 0.32);
      osc.connect(gain);
      gain.connect(navoAudioCtx.destination);
      osc.start(now + idx * 0.13);
      osc.stop(now + idx * 0.13 + 0.35);
    });

    if(navigator.vibrate) navigator.vibrate(type === "break" ? [120, 60, 120] : [180, 80, 180]);
  }catch{}
}

function updateCustomFocusTimes(quiet=false){
  const focusInput = $("#focusMinutesInput");
  const breakInput = $("#breakMinutesInput");
  const focusMinutes = Math.max(1, Math.min(240, Number(focusInput?.value || 25)));
  const breakMinutes = Math.max(1, Math.min(120, Number(breakInput?.value || 5)));

  focusTotal = focusMinutes * 60;
  focusBreakMinutes = breakMinutes;

  localStorage.setItem("navo_focus_minutes", String(focusMinutes));
  localStorage.setItem("navo_break_minutes", String(breakMinutes));

  if(!focusRunning){
    focusLeft = focusModeType === "focus" ? focusTotal : focusBreakMinutes * 60;
  }else{
    focusEndAt = Date.now() + (focusLeft * 1000);
  }

  saveFocusRuntime();

  if(!quiet){
    if(typeof cleanNotify === "function") cleanNotify("تم تحديث الوقت", `${focusMinutes} دقيقة مذاكرة و ${breakMinutes} دقائق بريك.`, "info");
    else toast("تم تحديث الوقت");
    renderFocus();
  }
}

function applyFocusPreset(focusMinutes, breakMinutes){
  focusTotal = Number(focusMinutes) * 60;
  focusBreakMinutes = Number(breakMinutes);
  localStorage.setItem("navo_focus_minutes", String(focusMinutes));
  localStorage.setItem("navo_break_minutes", String(breakMinutes));
  focusRunning = false;
  focusEndAt = 0;
  clearInterval(timer);
  timer = null;
  focusLeft = focusModeType === "focus" ? focusTotal : focusBreakMinutes * 60;
  saveFocusRuntime();
  if(typeof cleanNotify === "function") cleanNotify("تم اختيار النمط", `${focusMinutes} دقيقة مذاكرة و ${breakMinutes} دقائق بريك.`, "info");
  else toast("تم اختيار النمط");
  renderFocus();
}

function completeBreak(){
  clearInterval(timer);
  timer = null;
  focusRunning = false;
  focusEndAt = 0;
  focusModeType = "focus";
  focusLeft = focusTotal;
  saveFocusRuntime();

  playFocusChime("break");

  if(typeof cleanNotify === "function") cleanNotify("انتهى البريك", "ارجع لجلسة المذاكرة التالية.", "focus");
  else toast("انتهى البريك");

  renderFocus();
}

function skipFocusStep(){
  if(focusModeType === "focus"){
    completeFocus();
  }else{
    completeBreak();
  }
}

async function toggleStudyFullscreen(){
  focusStudyFullscreen = !focusStudyFullscreen;
  document.body.classList.toggle("full-focus-active", focusStudyFullscreen);

  try{
    if(focusStudyFullscreen && !document.fullscreenElement){
      const target = document.documentElement;
      if(target.requestFullscreen) await target.requestFullscreen();
      else if(target.webkitRequestFullscreen) await target.webkitRequestFullscreen();
    }else if(!focusStudyFullscreen && document.fullscreenElement){
      if(document.exitFullscreen) await document.exitFullscreen();
      else if(document.webkitExitFullscreen) await document.webkitExitFullscreen();
    }
  }catch{}

  renderFocus();

  if(typeof cleanNotify === "function") cleanNotify(
    focusStudyFullscreen ? "تركيز كامل" : "رجوع للواجهة",
    focusStudyFullscreen ? "الشاشة الآن للمذاكرة فقط." : "تم تصغير وضع التركيز.",
    "focus"
  );
  else toast(focusStudyFullscreen ? "تركيز كامل" : "رجوع للواجهة");
}

function openMenu(){
  $("#sidebar").classList.add("open");
  $("#overlay").classList.add("show");
}

function closeMenu(){
  $("#sidebar").classList.remove("open");
  $("#overlay").classList.remove("show");
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


function cleanToggleFullFocus(){
  cleanFocusFullscreen = !cleanFocusFullscreen;
  document.body.classList.toggle("full-focus-active", cleanFocusFullscreen);
  renderFocus();
  cleanNotify(cleanFocusFullscreen ? "وضع التركيز الكامل" : "تم التصغير", cleanFocusFullscreen ? "الشاشة الآن للتركيز فقط." : "رجعت للواجهة الطبيعية.", "focus");
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
    cleanNotify("تم إرسال التذكرة", "رقم التذكرة #" + data.ticketId, "success");
  }catch{
    toast("تعذر إرسال التذكرة");
  }
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
    }catch(err){
      $("#msg").textContent =
        err.error === "USERNAME_EXISTS" ? "اسم المستخدم موجود" :
        err.error === "BANNED" ? "الحساب محظور" :
        "بيانات الدخول غير صحيحة";
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





function toggleFocusSettings(){
  focusSettingsOpen = !focusSettingsOpen;
  localStorage.setItem("navo_focus_settings_open", String(focusSettingsOpen));
  renderFocus();
}

document.addEventListener("fullscreenchange", () => {
  if(!document.fullscreenElement && focusStudyFullscreen){
    focusStudyFullscreen = false;
    document.body.classList.remove("full-focus-active");
    if(page === "focus") renderFocus();
  }
});


document.addEventListener("webkitfullscreenchange", () => {
  if(!document.webkitFullscreenElement && focusStudyFullscreen){
    focusStudyFullscreen = false;
    document.body.classList.remove("full-focus-active");
    if(page === "focus") renderFocus();
  }
});


document.addEventListener("visibilitychange", () => {
  if(!document.hidden && focusRunning && focusEndAt){
    focusLeft = Math.max(0, Math.ceil((focusEndAt - Date.now()) / 1000));
    if(page === "focus") updateFocusVisuals();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  bindStatic();
  updateToday();
  if(token) loadMe();
});
