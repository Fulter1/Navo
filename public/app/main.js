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
          <button class="btn primary" data-action="task">+ مهمة جديدة</button>
          <button class="btn ghost" data-action="focusPage">ابدأ تركيز</button>
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
  $("#focusPage").innerHTML = `
    <div class="focus-shell">
      <section class="focus-room glass">
        <div>
          <span class="chip">FOCUS MODE</span>
          <h2>جلسة تركيز هادئة</h2>
          <p class="muted">كل جلسة مكتملة تضيف +75 XP.</p>
          <div class="timer"><b id="timerText">${format(focusLeft)}</b></div>
          <div class="focus-controls">
            <button class="btn primary" data-action="toggleFocus">${focusRunning ? "إيقاف مؤقت" : "ابدأ"}</button>
            <button class="btn ghost" data-action="resetFocus">إعادة</button>
          </div>
        </div>
      </section>

      <aside class="panel glass">
        <h2>إعداد الجلسة</h2>
        <p class="muted">اختر مدة التركيز ثم اضغط ابدأ.</p>
        <label>مدة التركيز
          <select id="focusMinutes">
            <option value="15">15 دقيقة</option>
            <option value="25">25 دقيقة</option>
            <option value="45">45 دقيقة</option>
            <option value="60">60 دقيقة</option>
          </select>
        </label>

        <div class="data-box">
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
  bindActions($("#focusPage"));
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
    toast("تمت إضافة المهمة");
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
    toast(done ? "تم إنجاز المهمة +25XP" : "تم إرجاع المهمة");
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
  toast("تمت إضافة المساحة");
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
  if(focusRunning){
    clearInterval(timer);
    timer = null;
    focusRunning = false;
    renderFocus();
    return;
  }

  focusRunning = true;
  timer = setInterval(async () => {
    focusLeft--;
    const text = $("#timerText");
    if(text) text.textContent = format(focusLeft);

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
    await loadMe();
    toast("جلسة تركيز مكتملة +75XP");
  }catch{
    toast("صار خطأ في حفظ التركيز");
  }
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
    toast("تم إرسال التذكرة رقم #" + data.ticketId);
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

document.addEventListener("DOMContentLoaded", () => {
  bindStatic();
  updateToday();
  if(token) loadMe();
});
