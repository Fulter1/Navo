(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const STORE_USERS = "navo.next.users";
  const STORE_SESSION = "navo.next.session";
  const today = () => new Date().toISOString().slice(0,10);
  const uid = () => "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);

  const defaultSpaces = () => [
    {id: uid(), name: "الدراسة", color: "#5BE7FF"},
    {id: uid(), name: "البرمجة", color: "#1FA2FF"},
    {id: uid(), name: "الشخصي", color: "#7C5CFF"},
  ];

  const defaultState = () => ({
    profile: { name: "Navo User" },
    settings: { theme: "dark", accent: "#5BE7FF", accent2: "#1FA2FF", focus: 25 },
    spaces: defaultSpaces(),
    tasks: [],
    stats: { xp: 0, sessions: 0, focusMinutes: 0, streak: 1 }
  });

  let mode = "login";
  let user = null;
  let state = defaultState();
  let page = "home";
  let timer = null;
  let left = 25 * 60;
  let total = 25 * 60;
  let running = false;

  document.addEventListener("DOMContentLoaded", boot);

  function boot(){
    bindAuth();
    bindShell();
    updateDate();
    setInterval(updateClock, 1000);

    const session = read(STORE_SESSION, null);
    if(session && session.username){
      const users = read(STORE_USERS, {});
      if(users[session.username]) login(session.username, false);
    }
  }

  function read(k, fallback){
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  }

  function write(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
  function key(name){ return "navo.next.data." + name; }
  function cleanUsername(v){ return String(v || "").trim().toLowerCase().replace(/[^a-z0-9_\-\u0600-\u06ff]/gi, ""); }

  function bindAuth(){
    $("#loginTab").addEventListener("click", () => setMode("login"));
    $("#registerTab").addEventListener("click", () => setMode("register"));

    $("#demoBtn").addEventListener("click", () => {
      const users = read(STORE_USERS, {});
      if(!users.demo) users.demo = { password: "123456", createdAt: Date.now() };
      write(STORE_USERS, users);
      if(!localStorage.getItem(key("demo"))){
        const s = defaultState();
        s.profile.name = "Demo User";
        s.tasks = [
          {id:uid(), title:"رتب الداشبورد", priority:"high", space:s.spaces[1].id, done:false},
          {id:uid(), title:"جلسة تركيز 25 دقيقة", priority:"medium", space:s.spaces[0].id, done:false},
          {id:uid(), title:"راجع الإعدادات", priority:"low", space:s.spaces[2].id, done:true},
        ];
        s.stats = {xp:240,sessions:3,focusMinutes:75,streak:2};
        write(key("demo"), s);
      }
      login("demo", true);
    });

    $("#authForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const username = cleanUsername($("#username").value);
      const password = $("#password").value;
      const users = read(STORE_USERS, {});

      if(username.length < 3) return authMsg("اسم المستخدم لازم يكون 3 أحرف أو أكثر.");
      if(password.length < 6) return authMsg("كلمة المرور لازم تكون 6 أحرف أو أكثر.");

      if(mode === "register"){
        if(users[username]) return authMsg("اسم المستخدم موجود، جرّب اسم ثاني.");
        users[username] = { password, createdAt: Date.now() };
        write(STORE_USERS, users);
        const fresh = defaultState();
        fresh.profile.name = username;
        write(key(username), fresh);
        return login(username, true);
      }

      if(!users[username] || users[username].password !== password){
        return authMsg("اسم المستخدم أو كلمة المرور غير صحيحة.");
      }

      login(username, true);
    });
  }

  function setMode(next){
    mode = next;
    $("#loginTab").classList.toggle("active", mode === "login");
    $("#registerTab").classList.toggle("active", mode === "register");
    $("#authTitle").textContent = mode === "login" ? "تسجيل الدخول" : "إنشاء حساب";
    $("#authChip").textContent = mode === "login" ? "WELCOME BACK" : "CREATE SPACE";
    $("#authSubmit").textContent = mode === "login" ? "دخول" : "إنشاء حساب";
    $("#authDesc").textContent = mode === "login" ? "ادخل باسم المستخدم وكلمة المرور." : "أنشئ حساب محلي سريع باسم مستخدم.";
    authMsg("");
  }

  function authMsg(t){ $("#authMsg").textContent = t; }

  function login(username, remember){
    user = username;
    state = read(key(user), defaultState());
    if(remember) write(STORE_SESSION, { username: user });
    $("#authView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    applyTheme();
    renderAll();
    toast("حيّاك يا " + displayName());
  }

  function logout(){
    localStorage.removeItem(STORE_SESSION);
    user = null;
    $("#appView").classList.add("hidden");
    $("#authView").classList.remove("hidden");
  }

  function save(){
    if(user) write(key(user), state);
  }

  function displayName(){
    return state.profile?.name || user || "Navo User";
  }

  function bindShell(){
    $$(".nav,.mnav").forEach(btn => btn.addEventListener("click", () => setPage(btn.dataset.page)));
    $("#menuBtn").addEventListener("click", openMenu);
    $("#overlay").addEventListener("click", closeMenu);
    $("#logoutBtn").addEventListener("click", logout);
    $("#themeBtn").addEventListener("click", toggleTheme);
    $("#newTaskTop").addEventListener("click", openTask);
    $("#closeTask").addEventListener("click", () => $("#taskDialog").close());
    $("#closeSpace").addEventListener("click", () => $("#spaceDialog").close());

    $("#taskForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const id = $("#taskId").value;
      const task = {
        id: id || uid(),
        title: $("#taskTitle").value.trim(),
        priority: $("#taskPriority").value,
        space: $("#taskSpace").value,
        done: false
      };
      if(!task.title) return;
      if(id){
        const old = state.tasks.find(t => t.id === id);
        Object.assign(old, task, {done: old.done});
      } else {
        state.tasks.unshift(task);
      }
      save();
      $("#taskDialog").close();
      renderAll();
      toast("تم حفظ المهمة");
    });

    $("#spaceForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#spaceName").value.trim();
      if(!name) return;
      state.spaces.push({id:uid(), name, color:$("#spaceColor").value});
      save();
      $("#spaceDialog").close();
      renderAll();
      toast("تم إضافة المساحة");
    });
  }

  function openMenu(){
    $("#sidebar").classList.add("open");
    $("#overlay").classList.add("show");
  }

  function closeMenu(){
    $("#sidebar").classList.remove("open");
    $("#overlay").classList.remove("show");
  }

  function setPage(next){
    page = next;
    closeMenu();
    $$(".page").forEach(p => p.classList.toggle("active", p.id === page));
    $$(".nav,.mnav").forEach(b => b.classList.toggle("active", b.dataset.page === page));
    const names = {home:"الرئيسية",tasks:"المهام",focus:"التركيز",spaces:"المساحات",settings:"الإعدادات"};
    $("#pageTitle").textContent = names[page] || "Navo";
    renderAll();
  }

  function renderAll(){
    $("#sideName").textContent = displayName();
    $("#avatar").textContent = displayName().slice(0,1).toUpperCase();
    renderHome();
    renderTasks();
    renderFocus();
    renderSpaces();
    renderSettings();
    fillTaskSpaces();
  }

  function completed(){
    return state.tasks.filter(t => t.done).length;
  }

  function progress(){
    return state.tasks.length ? Math.round((completed()/state.tasks.length)*100) : 0;
  }

  function renderHome(){
    $("#home").innerHTML = `
      <div class="grid">
        <section class="hero glass">
          <div>
            <span class="chip">NAVO NEXT</span>
            <h2>حيّاك يا ${escapeHtml(displayName())}</h2>
            <p>ابدأ بمهمة وحدة، أو جلسة تركيز قصيرة. المهم اليوم يكون أوضح من أمس.</p>
            <button class="btn primary" data-action="newTask">+ مهمة جديدة</button>
            <button class="btn ghost" data-action="focus">ابدأ تركيز</button>
          </div>
          <div class="orb" style="--p:${progress()}"><div><b>${progress()}%</b><br><span>إنجاز اليوم</span></div></div>
        </section>

        <section class="cards grid">
          ${metric("المهام", state.tasks.length, "إجمالي المهام")}
          ${metric("المنجز", completed(), "مهام مكتملة")}
          ${metric("التركيز", state.stats.focusMinutes + "m", "دقائق تركيز")}
          ${metric("XP", state.stats.xp, "نقاط إنتاجية")}
        </section>

        <section class="two grid">
          <div class="panel glass">
            <div class="section-head"><h2>آخر المهام</h2><button class="btn small primary" data-action="newTask">إضافة</button></div>
            <div>${taskList(state.tasks.slice(0,4))}</div>
          </div>
          <div class="panel glass">
            <div class="section-head"><h2>المساحات</h2><button class="btn small ghost" data-action="newSpace">إضافة</button></div>
            <div class="space-grid">${state.spaces.slice(0,3).map(spaceCard).join("")}</div>
          </div>
        </section>
      </div>
    `;
    bindDynamicActions($("#home"));
  }

  function metric(title, value, sub){
    return `<div class="card glass"><span>${title}</span><strong>${value}</strong><small>${sub}</small></div>`;
  }

  function renderTasks(){
    $("#tasks").innerHTML = `
      <div class="panel glass">
        <div class="section-head"><h2>المهام</h2><button class="btn primary" data-action="newTask">+ مهمة</button></div>
        <div class="task-list">${taskList(state.tasks)}</div>
      </div>
    `;
    bindDynamicActions($("#tasks"));
  }

  function taskList(tasks){
    if(!tasks.length) return `<div class="empty">ما فيه مهام للحين. ابدأ بمهمة بسيطة.</div>`;
    return tasks.map(t => {
      const space = state.spaces.find(s => s.id === t.space);
      return `<div class="task glass ${t.done ? "done":""}">
        <div>
          <h3>${escapeHtml(t.title)}</h3>
          <div class="tags">
            <span class="tag ${t.priority}">${priorityName(t.priority)}</span>
            <span class="tag">${escapeHtml(space?.name || "عام")}</span>
          </div>
        </div>
        <div class="task-actions">
          <button data-action="toggleTask" data-id="${t.id}">${t.done ? "↺":"✓"}</button>
          <button data-action="editTask" data-id="${t.id}">✎</button>
          <button data-action="deleteTask" data-id="${t.id}">×</button>
        </div>
      </div>`;
    }).join("");
  }

  function priorityName(p){
    return p === "high" ? "عالية" : p === "low" ? "خفيفة" : "متوسطة";
  }

  function renderFocus(){
    $("#focus").innerHTML = `
      <div class="focus-shell">
        <section class="focus-room glass">
          <div>
            <span class="chip">FOCUS MODE</span>
            <div class="timer"><b id="timerText">${format(left)}</b></div>
            <div class="focus-controls">
              <button class="btn primary" data-action="toggleFocus">${running ? "إيقاف مؤقت":"ابدأ"}</button>
              <button class="btn ghost" data-action="resetFocus">إعادة</button>
            </div>
          </div>
        </section>
        <aside class="panel glass">
          <h2>جلسة هادئة</h2>
          <p class="muted">كل جلسة مكتملة تضيف XP وتزيد دقائق التركيز.</p>
          <label>مدة التركيز
            <select id="focusMinutes">
              <option value="15">15 دقيقة</option>
              <option value="25">25 دقيقة</option>
              <option value="45">45 دقيقة</option>
              <option value="60">60 دقيقة</option>
            </select>
          </label>
        </aside>
      </div>
    `;
    $("#focusMinutes").value = String(state.settings.focus || 25);
    $("#focusMinutes").addEventListener("change", () => {
      state.settings.focus = Number($("#focusMinutes").value);
      save();
      resetFocus();
      renderFocus();
    });
    bindDynamicActions($("#focus"));
  }

  function renderSpaces(){
    $("#spaces").innerHTML = `
      <div class="panel glass">
        <div class="section-head"><h2>المساحات</h2><button class="btn primary" data-action="newSpace">+ مساحة</button></div>
        <div class="space-grid">${state.spaces.map(spaceCard).join("")}</div>
      </div>
    `;
    bindDynamicActions($("#spaces"));
  }

  function spaceCard(s){
    const count = state.tasks.filter(t => t.space === s.id).length;
    return `<div class="space glass" style="--c:${s.color}">
      <span class="chip">${count} مهام</span>
      <h2>${escapeHtml(s.name)}</h2>
      <p class="muted">مساحة منظمة لمهامك.</p>
    </div>`;
  }

  function renderSettings(){
    $("#settings").innerHTML = `
      <div class="settings-grid grid">
        <div class="panel glass">
          <h2>البروفايل</h2>
          <label>اسم العرض<input id="displayNameInput" value="${escapeHtml(displayName())}"></label>
          <button id="saveProfile" class="btn primary full">حفظ الاسم</button>
        </div>
        <div class="panel glass">
          <h2>الثيم</h2>
          <p class="muted">بدّل بين الوضع الليلي والنهاري.</p>
          <button class="btn ghost full" data-action="theme">تبديل الثيم</button>
        </div>
        <div class="panel glass">
          <h2>الألوان</h2>
          <div class="color-row">
            <button data-action="color" style="--c1:#5BE7FF;--c2:#1FA2FF" data-c1="#5BE7FF" data-c2="#1FA2FF"></button>
            <button data-action="color" style="--c1:#FF9F43;--c2:#FF5F7A" data-c1="#FF9F43" data-c2="#FF5F7A"></button>
            <button data-action="color" style="--c1:#7C5CFF;--c2:#5BE7FF" data-c1="#7C5CFF" data-c2="#5BE7FF"></button>
          </div>
        </div>
        <div class="panel glass">
          <h2>البيانات</h2>
          <button class="btn ghost full" data-action="export">تصدير البيانات</button>
          <button class="btn ghost full" data-action="clearDone">حذف المنجز</button>
        </div>
      </div>
    `;
    $("#saveProfile").addEventListener("click", () => {
      state.profile.name = $("#displayNameInput").value.trim() || user;
      save();
      renderAll();
      toast("تم حفظ الاسم");
    });
    bindDynamicActions($("#settings"));
  }

  function bindDynamicActions(root){
    $$("[data-action]", root).forEach(el => {
      el.addEventListener("click", () => {
        const a = el.dataset.action;
        const id = el.dataset.id;
        if(a === "newTask") openTask();
        if(a === "newSpace") openSpace();
        if(a === "focus") setPage("focus");
        if(a === "toggleTask") toggleTask(id);
        if(a === "editTask") editTask(id);
        if(a === "deleteTask") deleteTask(id);
        if(a === "toggleFocus") toggleFocus();
        if(a === "resetFocus") resetFocus();
        if(a === "theme") toggleTheme();
        if(a === "color") setColor(el.dataset.c1, el.dataset.c2);
        if(a === "export") exportData();
        if(a === "clearDone") clearDone();
      });
    });
  }

  function openTask(task = null){
    fillTaskSpaces();
    $("#taskId").value = task?.id || "";
    $("#taskTitle").value = task?.title || "";
    $("#taskPriority").value = task?.priority || "medium";
    $("#taskSpace").value = task?.space || state.spaces[0]?.id || "";
    $("#taskModalTitle").textContent = task ? "تعديل المهمة" : "مهمة جديدة";
    $("#taskDialog").showModal();
  }

  function fillTaskSpaces(){
    const select = $("#taskSpace");
    if(!select) return;
    select.innerHTML = state.spaces.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  }

  function openSpace(){
    $("#spaceName").value = "";
    $("#spaceColor").value = "#5BE7FF";
    $("#spaceDialog").showModal();
  }

  function toggleTask(id){
    const t = state.tasks.find(x => x.id === id);
    if(!t) return;
    t.done = !t.done;
    if(t.done){ state.stats.xp += 25; }
    save(); renderAll();
  }

  function editTask(id){
    const t = state.tasks.find(x => x.id === id);
    if(t) openTask(t);
  }

  function deleteTask(id){
    state.tasks = state.tasks.filter(t => t.id !== id);
    save(); renderAll();
  }

  function toggleFocus(){
    if(running){
      clearInterval(timer); timer = null; running = false; renderFocus(); return;
    }
    running = true;
    timer = setInterval(() => {
      left -= 1;
      const text = $("#timerText");
      if(text) text.textContent = format(left);
      if(left <= 0) completeFocus();
    }, 1000);
    renderFocus();
  }

  function resetFocus(){
    clearInterval(timer); timer = null; running = false;
    total = (state.settings.focus || 25) * 60;
    left = total;
  }

  function completeFocus(){
    clearInterval(timer); timer = null; running = false;
    state.stats.sessions += 1;
    state.stats.focusMinutes += state.settings.focus || 25;
    state.stats.xp += 75;
    save();
    resetFocus();
    renderAll();
    toast("أنهيت جلسة تركيز ممتازة +75 XP");
  }

  function format(sec){
    sec = Math.max(0, sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  function toggleTheme(){
    state.settings.theme = state.settings.theme === "light" ? "dark" : "light";
    save(); applyTheme();
  }

  function applyTheme(){
    document.body.classList.toggle("light", state.settings.theme === "light");
    $("#themeBtn").textContent = state.settings.theme === "light" ? "☀️" : "🌙";
    document.documentElement.style.setProperty("--accent", state.settings.accent || "#5BE7FF");
    document.documentElement.style.setProperty("--accent2", state.settings.accent2 || "#1FA2FF");
  }

  function setColor(c1, c2){
    state.settings.accent = c1;
    state.settings.accent2 = c2;
    save(); applyTheme();
    toast("تم تغيير الألوان");
  }

  function exportData(){
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "navo-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function clearDone(){
    state.tasks = state.tasks.filter(t => !t.done);
    save(); renderAll();
    toast("تم حذف المهام المنجزة");
  }

  function updateDate(){
    const el = $("#todayText");
    if(el) el.textContent = new Intl.DateTimeFormat("ar-SA", {weekday:"long", day:"numeric", month:"long"}).format(new Date());
  }

  function updateClock(){}

  function toast(text){
    const el = $("#toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function escapeHtml(v){
    return String(v ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }
})();
