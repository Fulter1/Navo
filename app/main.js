(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STORAGE_USERS = 'navo.stable.users';
  const STORAGE_SESSION = 'navo.stable.session';

  const defaultSpaces = [
    { id: uid(), name: 'الدراسة', color: '#35d7ff' },
    { id: uid(), name: 'البرمجة', color: '#0b66e4' },
    { id: uid(), name: 'الشخصي', color: '#7c5cff' }
  ];

  const defaultState = () => ({
    profile: { displayName: 'Navo User', bio: 'Personal Calm Operating System', avatar: '' },
    settings: { theme: 'dark', accent: '#35d7ff', accent2: '#0b66e4', graphics: 'auto', focusMinutes: 25, breakMinutes: 5, sound: 'none' },
    spaces: structuredClone(defaultSpaces),
    tasks: [],
    stats: { xp: 0, sessions: 0, focusMinutes: 0, streak: 1, lastActive: todayISO() },
    notes: { today: '' }
  });

  let currentUser = null;
  let state = defaultState();
  let currentPage = 'home';
  let taskFilter = 'all';
  let taskSearch = '';
  let focusTimer = null;
  let focusLeft = 25 * 60;
  let focusTotal = 25 * 60;
  let focusRunning = false;
  let audioCtx = null;

  const authView = $('#authView');
  const appView = $('#appView');
  const toastEl = $('#toast');

  boot();

  function boot() {
    bindAuth();
    bindShell();
    applyPerformanceAuto();
    const session = readJson(STORAGE_SESSION, null);
    if (session?.username) {
      const users = getUsers();
      if (users[session.username]) loginAs(session.username, false);
    }
    updateTodayText();
    setInterval(updateClockOnly, 1000);
  }

  function uid() { return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function readJson(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } }
  function writeJson(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function getUsers() { return readJson(STORAGE_USERS, {}); }
  function saveUsers(users) { writeJson(STORAGE_USERS, users); }
  function dataKey(username = currentUser) { return `navo.stable.data.${username}`; }
  function userKey(username) { return String(username || '').trim().toLowerCase().replace(/[^a-z0-9_\-\u0600-\u06FF]/gi, ''); }

  function bindAuth() {
    const form = $('#authForm');
    const loginTab = $('#loginTab');
    const registerTab = $('#registerTab');
    const submit = $('#authSubmit');
    const msg = $('#authMsg');
    const pass = $('#password');
    let mode = 'login';

    loginTab.addEventListener('click', () => setMode('login'));
    registerTab.addEventListener('click', () => setMode('register'));
    $('#demoBtn').addEventListener('click', () => {
      const users = getUsers();
      const username = 'demo';
      if (!users[username]) users[username] = { password: '123456', createdAt: Date.now() };
      saveUsers(users);
      if (!localStorage.getItem(dataKey(username))) {
        const demo = defaultState();
        demo.profile.displayName = 'Demo User';
        demo.tasks = seedTasks(demo.spaces);
        demo.stats.xp = 240; demo.stats.sessions = 3; demo.stats.focusMinutes = 75;
        writeJson(dataKey(username), demo);
      }
      loginAs(username, true);
    });
    $('#forgotBtn').addEventListener('click', () => showMsg('هذه نسخة Local. تقدر تصدر بياناتك أو تحذف المستخدم من localStorage لو نسيت كلمة المرور.'));
    pass.addEventListener('input', () => {
      const wrap = $('#strengthWrap');
      const bar = $('#strengthWrap i');
      if (mode !== 'register') return wrap.classList.add('hidden');
      wrap.classList.remove('hidden');
      const v = pass.value;
      let score = Math.min(100, v.length * 12 + (/[A-Z]/.test(v) ? 15 : 0) + (/\d/.test(v) ? 15 : 0) + (/[^A-Za-z0-9]/.test(v) ? 15 : 0));
      bar.style.width = score + '%';
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      msg.textContent = '';
      const username = userKey($('#username').value);
      const password = pass.value;
      const remember = $('#rememberMe').checked;
      if (username.length < 3) return showAuthError('اسم المستخدم لازم يكون 3 أحرف أو أكثر.');
      if (password.length < 6) return showAuthError('كلمة المرور لازم تكون 6 أحرف أو أكثر.');
      const users = getUsers();
      if (mode === 'register') {
        if (users[username]) return showAuthError('اسم المستخدم موجود، جرّب اسم ثاني.');
        users[username] = { password, createdAt: Date.now() };
        saveUsers(users);
        const fresh = defaultState();
        fresh.profile.displayName = username;
        writeJson(dataKey(username), fresh);
        loginAs(username, remember);
        return;
      }
      if (!users[username] || users[username].password !== password) return showAuthError('اسم المستخدم أو كلمة المرور غير صحيحة.');
      loginAs(username, remember);
    });

    function setMode(next) {
      mode = next;
      form.dataset.mode = mode;
      loginTab.classList.toggle('active', mode === 'login');
      registerTab.classList.toggle('active', mode === 'register');
      $('#authTitle').textContent = mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب';
      $('#authChip').textContent = mode === 'login' ? 'WELCOME BACK' : 'CREATE SPACE';
      $('#authDesc').textContent = mode === 'login' ? 'ادخل باسم المستخدم وكلمة المرور. كل مستخدم له بياناته الخاصة.' : 'أنشئ حساب محلي باسم مستخدم، وNavo يحفظ بياناتك منفصلة.';
      submit.textContent = mode === 'login' ? 'دخول' : 'إنشاء حساب';
      $('#strengthWrap').classList.toggle('hidden', mode !== 'register');
      msg.textContent = '';
    }
    function showAuthError(text) {
      msg.textContent = text;
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    }
  }

  function loginAs(username, remember) {
    currentUser = username;
    state = readJson(dataKey(username), null) || defaultState();
    if (!state.spaces?.length) state.spaces = structuredClone(defaultSpaces);
    if (remember) writeJson(STORAGE_SESSION, { username, at: Date.now() });
    authView.classList.add('hidden'); appView.classList.remove('hidden');
    applySettings(); renderAll(); toast(`أهلًا ${state.profile.displayName || username}`);
  }
  function logout() {
    saveState();
    localStorage.removeItem(STORAGE_SESSION);
    currentUser = null;
    appView.classList.add('hidden'); authView.classList.remove('hidden');
    toast('تم تسجيل الخروج');
  }
  function saveState() { if (currentUser) writeJson(dataKey(), state); }
  function seedTasks(spaces) {
    const s0 = spaces[0]?.id, s1 = spaces[1]?.id;
    return [
      { id: uid(), title: 'راجع خطة اليوم', priority: 'high', spaceId: s0, date: todayISO(), note: '', done: false, createdAt: Date.now() },
      { id: uid(), title: 'جلسة تركيز 25 دقيقة', priority: 'medium', spaceId: s1, date: todayISO(), note: '', done: false, createdAt: Date.now() }
    ];
  }

  function bindShell() {
    $('#sideNav').addEventListener('click', onNavClick);
    $('#mobileNav').addEventListener('click', onNavClick);
    $('#collapseSidebar').addEventListener('click', () => appView.classList.toggle('collapsed'));
    $('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#themeToggle').addEventListener('click', () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applySettings(); saveState(); });
    $('#quickTask').addEventListener('click', () => openTaskDialog());
    $('#closeTaskDialog').addEventListener('click', () => $('#taskDialog').close());
    $('#closeSpaceDialog').addEventListener('click', () => $('#spaceDialog').close());
    $('#taskForm').addEventListener('submit', saveTaskFromForm);
    $('#spaceForm').addEventListener('submit', saveSpaceFromForm);
    $('#cmdBtn').addEventListener('click', openCommand);
    $('#commandPalette').addEventListener('click', e => { if (e.target.id === 'commandPalette') closeCommand(); });
    $('#commandInput').addEventListener('input', renderCommandList);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommand(); }
      if (e.key === 'Escape') { closeCommand(); $('#sidebar').classList.remove('open'); if (currentPage === 'focus') toggleDeepFocus(); }
      if (currentPage === 'focus' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
        if (e.code === 'Space') { e.preventDefault(); focusRunning ? pauseFocus() : startFocus(); }
        if (e.key === 'Enter') startFocus();
      }
    });
  }
  function onNavClick(e) {
    const btn = e.target.closest('[data-page]'); if (!btn) return;
    navigate(btn.dataset.page); $('#sidebar').classList.remove('open');
  }
  function navigate(page) {
    currentPage = page;
    $$('.page').forEach(p => p.classList.toggle('active', p.id === page));
    $$('.nav-btn,.mnav').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    const titles = { home:'الرئيسية', tasks:'المهام', focus:'التركيز', spaces:'المساحات', profile:'البروفايل', settings:'الإعدادات' };
    $('#pageTitle').textContent = titles[page] || 'Navo';
    renderPage(page);
  }

  function renderAll() { renderShell(); ['home','tasks','focus','spaces','profile','settings'].forEach(renderPage); navigate(currentPage); }
  function renderShell() {
    $('#sideName').textContent = state.profile.displayName || currentUser;
    $('#sideAvatar').textContent = (state.profile.displayName || currentUser || 'N')[0].toUpperCase();
    $('#sideMode').textContent = currentUser ? `@${currentUser}` : 'Local';
  }
  function renderPage(page) {
    if (!currentUser) return;
    ({ home: renderHome, tasks: renderTasks, focus: renderFocus, spaces: renderSpaces, profile: renderProfile, settings: renderSettings }[page] || renderHome)();
  }

  function stats() {
    const total = state.tasks.length, done = state.tasks.filter(t=>t.done).length;
    const pct = total ? Math.round(done/total*100) : 0;
    const todayTasks = state.tasks.filter(t => !t.date || t.date === todayISO());
    const openToday = todayTasks.filter(t=>!t.done);
    const high = openToday.find(t=>t.priority === 'high') || openToday[0];
    return { total, done, pct, todayTasks, openToday, high };
  }
  function spaceName(id) { return state.spaces.find(s=>s.id===id)?.name || 'عام'; }
  function spaceColor(id) { return state.spaces.find(s=>s.id===id)?.color || state.settings.accent; }
  function priorityText(p) { return p === 'high' ? 'عالية' : p === 'low' ? 'خفيفة' : 'متوسطة'; }

  function renderHome() {
    const s = stats();
    $('#home').innerHTML = `
      <div class="grid home-grid">
        <article class="hero glass-card span-2">
          <p class="chip">CURRENT SIGNAL</p>
          <h2>${greeting()}، ${escapeHtml(state.profile.displayName || currentUser)}.</h2>
          <p>${s.high ? `أهم شيء الآن: ${escapeHtml(s.high.title)}. خلها بداية هادئة وبسيطة.` : 'مساحتك جاهزة لبداية هادئة. أضف أول مهمة وابدأ.'}</p>
          <div class="hero-actions"><button class="btn primary" data-action="start-focus">ابدأ تركيز</button><button class="btn ghost" data-action="new-task">＋ مهمة</button><button class="btn ghost" data-action="go-tasks">فتح المهام</button></div>
        </article>
        <article class="card glass-card time-card"><span>الوقت الآن</span><strong id="liveClock">--:--</strong><small id="liveDate">—</small></article>
        <article class="card glass-card stat"><span>إنجاز اليوم</span><strong>${s.pct}%</strong><div class="progress-line"><i style="width:${s.pct}%"></i></div></article>
        <article class="card glass-card ai-card span-2"><div class="section-head"><div><p class="chip">AI PULSE</p><h3>اقتراحات ذكية</h3></div><button class="btn ghost small" data-action="refresh-home">تحديث</button></div><div class="ai-list">${aiSuggestions().map(x=>`<div class="ai-item"><b>✦</b><p>${x}</p></div>`).join('')}</div></article>
        <article class="card glass-card stat"><span>XP</span><strong>${state.stats.xp}</strong><small>${rank()}</small></article>
        <article class="card glass-card stat"><span>جلسات التركيز</span><strong>${state.stats.sessions}</strong><small>${state.stats.focusMinutes} دقيقة</small></article>
        <article class="card glass-card span-2"><div class="section-head"><h3>المهام القادمة</h3><button class="link-btn" data-action="go-tasks">كل المهام</button></div><div class="task-list">${renderTaskItems(state.tasks.filter(t=>!t.done).slice(0,4), true)}</div></article>
      </div>`;
    $('#home').onclick = handleAction;
    updateClockOnly();
  }

  function renderTasks() {
    const filtered = state.tasks.filter(t => {
      const q = !taskSearch || t.title.toLowerCase().includes(taskSearch.toLowerCase()) || (t.note||'').toLowerCase().includes(taskSearch.toLowerCase());
      const f = taskFilter === 'all' || (taskFilter === 'open' && !t.done) || (taskFilter === 'done' && t.done) || t.priority === taskFilter;
      return q && f;
    }).sort((a,b) => (a.done - b.done) || priorityScore(b.priority)-priorityScore(a.priority) || (b.createdAt||0)-(a.createdAt||0));
    $('#tasks').innerHTML = `
      <div class="grid task-layout">
        <aside class="toolbox glass-card"><p class="chip">TASKS</p><h2>مهامك بشكل أوضح</h2><p class="muted">كل مهمة مربوطة بمساحة، أولوية، وتاريخ. البيانات محفوظة للمستخدم الحالي فقط.</p><button class="btn primary full" data-action="new-task">＋ مهمة جديدة</button><button class="btn ghost full" data-action="smart-sort" style="margin-top:10px">ترتيب ذكي</button></aside>
        <section class="card glass-card"><div class="search-row"><input id="taskSearchBox" placeholder="ابحث في المهام..." value="${escapeAttr(taskSearch)}"><select id="taskFilterBox"><option value="all">الكل</option><option value="open">المعلقة</option><option value="done">المنجزة</option><option value="high">عالية</option><option value="medium">متوسطة</option><option value="low">خفيفة</option></select><button class="btn ghost" data-action="clear-done">تنظيف المنجز</button></div><div class="task-list">${renderTaskItems(filtered)}</div></section>
      </div>`;
    $('#taskFilterBox').value = taskFilter;
    $('#taskSearchBox').addEventListener('input', e => { taskSearch = e.target.value; renderTasks(); });
    $('#taskFilterBox').addEventListener('change', e => { taskFilter = e.target.value; renderTasks(); });
    $('#tasks').onclick = handleAction;
  }
  function renderTaskItems(tasks, compact=false) {
    if (!tasks.length) return `<div class="empty-state"><b>مساحتك جاهزة لبداية هادئة.</b><p>أضف مهمة وخل اليوم أوضح.</p><button class="btn primary small" data-action="new-task">＋ مهمة</button></div>`;
    return tasks.map(t => `<article class="task-item ${t.done?'done':''}" data-id="${t.id}"><div class="task-main"><button class="check" data-action="toggle-task" data-id="${t.id}">${t.done?'✓':' '}</button><div class="task-content"><h4>${escapeHtml(t.title)}</h4><div class="tags"><span class="tag ${t.priority}">${priorityText(t.priority)}</span><span class="tag" style="border-color:${spaceColor(t.spaceId)}55">${escapeHtml(spaceName(t.spaceId))}</span>${t.date?`<span class="tag">${t.date}</span>`:''}</div>${!compact && t.note?`<small class="muted">${escapeHtml(t.note)}</small>`:''}</div></div><div class="task-actions"><button data-action="edit-task" data-id="${t.id}">✎</button><button data-action="delete-task" data-id="${t.id}">×</button></div></article>`).join('');
  }
  function priorityScore(p){return p==='high'?3:p==='medium'?2:1}

  function renderFocus() {
    const open = state.tasks.filter(t=>!t.done);
    const target = stats().high;
    $('#focus').innerHTML = `
      <div class="grid focus-layout">
        <section id="focusRoom" class="focus-room glass-card ${focusRunning?'running':''}">
          <p class="chip">FOCUS ROOM</p>
          <h2 id="focusTaskText">${target ? escapeHtml(target.title) : 'مهمة واحدة فقط'}</h2>
          <p>Space للتشغيل/الإيقاف • Enter للتشغيل • Esc للوضع العميق</p>
          <div class="timer-ring"><strong id="focusClock">${formatTime(focusLeft)}</strong><small>جلسة تركيز</small></div>
          <div class="focus-controls"><button class="btn primary" data-action="focus-start">ابدأ</button><button class="btn ghost" data-action="focus-pause">إيقاف</button><button class="btn ghost" data-action="focus-reset">إعادة</button><button class="btn ghost" data-action="deep-focus">Deep Mode</button></div>
          <div class="sound-row"><button class="${state.settings.sound==='none'?'active':''}" data-action="sound" data-sound="none">Off</button><button class="${state.settings.sound==='rain'?'active':''}" data-action="sound" data-sound="rain">Rain</button><button class="${state.settings.sound==='cafe'?'active':''}" data-action="sound" data-sound="cafe">Cafe</button><button class="${state.settings.sound==='space'?'active':''}" data-action="sound" data-sound="space">Space</button></div>
        </section>
        <aside class="card glass-card"><p class="chip">SESSION</p><h3>إعدادات الجلسة</h3><label>مدة التركيز<input id="focusMinutesInput" type="number" min="5" max="90" value="${state.settings.focusMinutes}"></label><label>مدة الراحة<input id="breakMinutesInput" type="number" min="1" max="30" value="${state.settings.breakMinutes}"></label><div class="data-box">الجلسات: <b>${state.stats.sessions}</b><br>دقائق التركيز: <b>${state.stats.focusMinutes}</b><br>المهمة المقترحة: <b>${target ? escapeHtml(target.title) : 'لا يوجد'}</b></div></aside>
      </div>`;
    $('#focus').onclick = handleAction;
    $('#focusMinutesInput').addEventListener('change', e => { state.settings.focusMinutes = clamp(+e.target.value,5,90); resetFocus(); saveState(); renderFocus(); });
    $('#breakMinutesInput').addEventListener('change', e => { state.settings.breakMinutes = clamp(+e.target.value,1,30); saveState(); });
  }
  function startFocus(){ if(focusRunning) return; focusRunning=true; playTone(420,0.05); focusTimer=setInterval(()=>{ focusLeft--; updateFocusClock(); if(focusLeft<=0) completeFocus(); },1000); $('#focusRoom')?.classList.add('running'); }
  function pauseFocus(){ focusRunning=false; clearInterval(focusTimer); $('#focusRoom')?.classList.remove('running'); playTone(220,0.04); }
  function resetFocus(){ pauseFocus(); focusTotal=state.settings.focusMinutes*60; focusLeft=focusTotal; updateFocusClock(); }
  function completeFocus(){ pauseFocus(); state.stats.sessions++; state.stats.focusMinutes += state.settings.focusMinutes; state.stats.xp += 50; saveState(); toast('جلسة ممتازة. زاد XP +50'); resetFocus(); renderAll(); playTone(660,0.12); }
  function updateFocusClock(){ const el=$('#focusClock'); if(el) el.textContent=formatTime(focusLeft); }
  function toggleDeepFocus(){ document.body.classList.toggle('deep-focus'); }
  function formatTime(sec){ const m=Math.floor(sec/60), s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

  function renderSpaces() {
    $('#spaces').innerHTML = `<div class="section-head"><div><p class="chip">SPACES</p><h2>مساحاتك</h2></div><button class="btn primary" data-action="new-space">＋ مساحة</button></div><div class="space-grid">${state.spaces.map(sp=>`<article class="space-card glass-card" style="--space-color:${sp.color}"><p class="chip">SPACE</p><h3>${escapeHtml(sp.name)}</h3><p>${state.tasks.filter(t=>t.spaceId===sp.id).length} مهمة مرتبطة</p><button class="btn ghost small" data-action="delete-space" data-id="${sp.id}">حذف</button></article>`).join('')}</div>`;
    $('#spaces').onclick = handleAction;
  }
  function renderProfile() {
    const s=stats(), level=Math.floor(state.stats.xp/250)+1, fill=state.stats.xp%250/250*100;
    $('#profile').innerHTML = `<div class="grid profile-grid"><article class="profile-hero glass-card"><div class="avatar">${(state.profile.displayName||currentUser)[0].toUpperCase()}</div><h2>${escapeHtml(state.profile.displayName||currentUser)}</h2><p class="muted">${escapeHtml(state.profile.bio||'Personal Calm Operating System')}</p><div class="levelbar"><i style="width:${fill}%"></i></div><small class="muted">Level ${level} • ${state.stats.xp} XP</small></article><section class="grid"><article class="card glass-card"><h3>ملخصك</h3><div class="grid home-grid"><div class="stat"><span>المهام</span><strong>${s.total}</strong></div><div class="stat"><span>المنجز</span><strong>${s.done}</strong></div><div class="stat"><span>التركيز</span><strong>${state.stats.sessions}</strong></div></div></article><article class="card glass-card"><h3>تعديل البروفايل</h3><label>اسم العرض<input id="profileNameInput" value="${escapeAttr(state.profile.displayName||'')}"></label><label>نبذة<textarea id="profileBioInput">${escapeHtml(state.profile.bio||'')}</textarea></label><button class="btn primary" data-action="save-profile">حفظ البروفايل</button></article></section></div>`;
    $('#profile').onclick = handleAction;
  }
  function renderSettings() {
    $('#settings').innerHTML = `<div class="section-head"><div><p class="chip">SETTINGS</p><h2>الإعدادات</h2></div><button class="btn danger" data-action="logout">تسجيل خروج</button></div><div class="grid settings-grid"><article class="settings-card glass-card"><h3>الثيم والهوية</h3><button class="btn ghost full" data-action="toggle-theme">تبديل الوضع الليلي / النهاري</button><label>لون الهوية<div class="color-picks"><button style="--c1:#35d7ff;--c2:#0b66e4" data-action="accent" data-a="#35d7ff" data-b="#0b66e4"></button><button style="--c1:#ff8a3d;--c2:#ff3d81" data-action="accent" data-a="#ff8a3d" data-b="#ff3d81"></button><button style="--c1:#39d98a;--c2:#13a89e" data-action="accent" data-a="#39d98a" data-b="#13a89e"></button><button style="--c1:#a78bfa;--c2:#6d5dfc" data-action="accent" data-a="#a78bfa" data-b="#6d5dfc"></button></div></label></article><article class="settings-card glass-card"><h3>الأداء</h3><label>وضع الرسوم<select id="graphicsMode"><option value="auto">تلقائي</option><option value="full">كامل</option><option value="low">خفيف</option></select></label><p class="muted">خفف الرسوم لو الجهاز يعلق أو فيه تقطيع.</p></article><article class="settings-card glass-card"><h3>ربط البيانات</h3><div class="data-box"><b>المستخدم الحالي:</b> @${escapeHtml(currentUser)}<br><b>طريقة الحفظ:</b> Local-first لكل مستخدم<br><b>Cloud:</b> Supabase جاهز في config لاحقًا</div><button class="btn ghost full" data-action="export-data">تصدير البيانات</button><label class="btn ghost full" style="margin-top:10px;text-align:center">استيراد البيانات<input id="importData" type="file" accept="application/json" hidden></label></article><article class="settings-card glass-card"><h3>البيانات الخطرة</h3><p class="muted">استخدمها فقط لو تبي تبدأ من جديد.</p><button class="btn danger full" data-action="reset-user">تصفير بيانات المستخدم</button></article></div>`;
    $('#graphicsMode').value = state.settings.graphics || 'auto';
    $('#graphicsMode').addEventListener('change', e => { state.settings.graphics=e.target.value; applySettings(); saveState(); });
    $('#importData').addEventListener('change', importData);
    $('#settings').onclick = handleAction;
  }

  function handleAction(e) {
    const el = e.target.closest('[data-action]'); if(!el) return;
    const a = el.dataset.action, id = el.dataset.id;
    if (a==='new-task') openTaskDialog();
    if (a==='edit-task') openTaskDialog(id);
    if (a==='delete-task') deleteTask(id);
    if (a==='toggle-task') toggleTask(id);
    if (a==='clear-done') { state.tasks = state.tasks.filter(t=>!t.done); saveState(); renderTasks(); toast('تم حذف المهام المنجزة'); }
    if (a==='smart-sort') { smartSort(); renderTasks(); toast('تم الترتيب حسب الأولوية'); }
    if (a==='go-tasks') navigate('tasks');
    if (a==='start-focus') { navigate('focus'); startFocus(); }
    if (a==='focus-start') startFocus();
    if (a==='focus-pause') pauseFocus();
    if (a==='focus-reset') resetFocus();
    if (a==='deep-focus') toggleDeepFocus();
    if (a==='sound') { state.settings.sound=el.dataset.sound; saveState(); renderFocus(); if(state.settings.sound!=='none') playTone(360,0.05); }
    if (a==='new-space') $('#spaceDialog').showModal();
    if (a==='delete-space') deleteSpace(id);
    if (a==='save-profile') saveProfile();
    if (a==='toggle-theme') { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applySettings(); saveState(); renderSettings(); }
    if (a==='accent') { state.settings.accent=el.dataset.a; state.settings.accent2=el.dataset.b; applySettings(); saveState(); }
    if (a==='logout') logout();
    if (a==='export-data') exportData();
    if (a==='reset-user') resetUserData();
    if (a==='refresh-home') renderHome();
  }

  function openTaskDialog(id=null) {
    const task = id ? state.tasks.find(t=>t.id===id) : null;
    $('#taskDialogTitle').textContent = task ? 'تعديل المهمة' : 'مهمة جديدة';
    $('#taskId').value = task?.id || '';
    $('#taskTitle').value = task?.title || '';
    $('#taskPriority').value = task?.priority || 'medium';
    $('#taskDate').value = task?.date || todayISO();
    $('#taskNote').value = task?.note || '';
    $('#taskSpace').innerHTML = state.spaces.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
    $('#taskSpace').value = task?.spaceId || state.spaces[0]?.id || '';
    $('#taskDialog').showModal();
  }
  function saveTaskFromForm(e) {
    e.preventDefault();
    const id = $('#taskId').value;
    const data = { title: $('#taskTitle').value.trim(), priority: $('#taskPriority').value, spaceId: $('#taskSpace').value, date: $('#taskDate').value, note: $('#taskNote').value.trim() };
    if (!data.title) return;
    if (id) Object.assign(state.tasks.find(t=>t.id===id), data);
    else state.tasks.unshift({ id: uid(), done:false, createdAt: Date.now(), ...data });
    state.stats.xp += id ? 0 : 10;
    saveState(); $('#taskDialog').close(); renderAll(); toast(id ? 'تم تعديل المهمة' : 'تمت إضافة المهمة');
  }
  function toggleTask(id){ const t=state.tasks.find(t=>t.id===id); if(!t)return; t.done=!t.done; if(t.done) state.stats.xp += 20; saveState(); renderAll(); }
  function deleteTask(id){ state.tasks=state.tasks.filter(t=>t.id!==id); saveState(); renderAll(); toast('تم حذف المهمة'); }
  function smartSort(){ state.tasks.sort((a,b)=>(a.done-b.done)||priorityScore(b.priority)-priorityScore(a.priority)||(a.date||'9999').localeCompare(b.date||'9999')); saveState(); }
  function saveSpaceFromForm(e){ e.preventDefault(); state.spaces.push({id:uid(), name:$('#spaceName').value.trim(), color:$('#spaceColor').value}); saveState(); $('#spaceDialog').close(); renderAll(); e.target.reset(); toast('تمت إضافة المساحة'); }
  function deleteSpace(id){ if(state.spaces.length<=1) return toast('لازم تبقى مساحة واحدة على الأقل'); const fallback=state.spaces.find(s=>s.id!==id)?.id; state.tasks.forEach(t=>{if(t.spaceId===id)t.spaceId=fallback}); state.spaces=state.spaces.filter(s=>s.id!==id); saveState(); renderAll(); toast('تم حذف المساحة'); }
  function saveProfile(){ state.profile.displayName=$('#profileNameInput').value.trim()||currentUser; state.profile.bio=$('#profileBioInput').value.trim(); saveState(); renderAll(); toast('تم حفظ البروفايل'); }

  function aiSuggestions(){
    const s=stats(); const arr=[];
    if(!s.total) arr.push('ابدأ بثلاث مهام فقط. كثرة المهام في البداية تشتت أكثر مما تساعد.');
    if(s.high) arr.push(`ابدأ الآن بـ “${escapeHtml(s.high.title)}” لأنها أعلى أولوية في يومك.`);
    if(s.openToday.length>5) arr.push('عندك مهام كثيرة اليوم. خل أول جلسة تركيز للمهمة الأصعب، والباقي بعدين.');
    if(state.stats.sessions===0) arr.push('جرب جلسة تركيز واحدة 25 دقيقة. الهدف بداية هادئة مو ضغط.');
    if(s.pct>=70) arr.push('تقدمك ممتاز اليوم. لا تضيف مهام كثيرة، كمل بهدوء.');
    return arr.slice(0,3);
  }
  function greeting(){ const h=new Date().getHours(); return h<12?'صباح الخير':h<18?'مساء الخير':'ليلة هادئة'; }
  function rank(){ return state.stats.xp>=1000?'Master':state.stats.xp>=500?'Builder':state.stats.xp>=200?'Focused':'Rookie'; }
  function updateTodayText(){ const d=new Date(); $('#todayText').textContent=d.toLocaleDateString('ar-SA',{weekday:'long',day:'numeric',month:'long'}); }
  function updateClockOnly(){ const c=$('#liveClock'), d=$('#liveDate'); if(c) c.textContent=new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}); if(d) d.textContent=new Date().toLocaleDateString('ar-SA',{weekday:'long',month:'long',day:'numeric'}); }

  function applySettings(){
    document.body.classList.toggle('light', state.settings.theme==='light');
    document.documentElement.style.setProperty('--accent', state.settings.accent || '#35d7ff');
    document.documentElement.style.setProperty('--accent2', state.settings.accent2 || '#0b66e4');
    document.body.classList.toggle('low-graphics', state.settings.graphics==='low' || (state.settings.graphics==='auto' && isLowDevice()));
  }
  function isLowDevice(){ return (navigator.deviceMemory && navigator.deviceMemory<=4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency<=4) || matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function applyPerformanceAuto(){ if(isLowDevice()) document.body.classList.add('low-graphics'); }
  function clamp(n,min,max){return Math.max(min,Math.min(max,n||min));}

  function openCommand(){ $('#commandPalette').classList.remove('hidden'); $('#commandInput').value=''; renderCommandList(); setTimeout(()=>$('#commandInput').focus(),20); }
  function closeCommand(){ $('#commandPalette').classList.add('hidden'); }
  function renderCommandList(){
    const q=$('#commandInput').value.trim().toLowerCase();
    const cmds=[['مهمة جديدة','new-task','＋'],['افتح المهام','tasks','✓'],['ابدأ التركيز','focus','◉'],['تبديل الثيم','theme','☼'],['الوضع العميق','deep','◎'],['الإعدادات','settings','⚙'],['تسجيل خروج','logout','⇥']];
    $('#commandList').innerHTML=cmds.filter(c=>!q||c[0].includes(q)||c[1].includes(q)).map(c=>`<div class="cmd-item" data-cmd="${c[1]}"><b>${c[2]} ${c[0]}</b><small>/${c[1]}</small></div>`).join('');
    $$('#commandList .cmd-item').forEach(item=>item.onclick=()=>runCommand(item.dataset.cmd));
  }
  function runCommand(cmd){ closeCommand(); if(cmd==='new-task')openTaskDialog(); if(cmd==='tasks')navigate('tasks'); if(cmd==='focus'){navigate('focus');startFocus();} if(cmd==='theme')$('#themeToggle').click(); if(cmd==='deep')toggleDeepFocus(); if(cmd==='settings')navigate('settings'); if(cmd==='logout')logout(); }
  function exportData(){ const blob=new Blob([JSON.stringify({user:currentUser,state},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`navo-${currentUser}-backup.json`; a.click(); URL.revokeObjectURL(a.href); }
  function importData(e){ const file=e.target.files[0]; if(!file)return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); state=data.state||data; saveState(); applySettings(); renderAll(); toast('تم استيراد البيانات'); }catch{toast('ملف غير صالح');} }; r.readAsText(file); }
  function resetUserData(){ if(!confirm('متأكد؟ سيتم تصفير بيانات المستخدم الحالي.'))return; state=defaultState(); state.profile.displayName=currentUser; saveState(); applySettings(); renderAll(); toast('تم تصفير البيانات'); }
  function playTone(freq=440,duration=.05){ try{ audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)(); const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.value=freq; g.gain.value=.025; o.connect(g); g.connect(audioCtx.destination); o.start(); setTimeout(()=>{o.stop();},duration*1000); }catch{} }
  function showMsg(t){ $('#authMsg').textContent=t; }
  function toast(t){ toastEl.textContent=t; toastEl.classList.add('show'); clearTimeout(toastEl._t); toastEl._t=setTimeout(()=>toastEl.classList.remove('show'),2400); }
  function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function escapeAttr(v=''){return escapeHtml(v).replace(/`/g,'&#096;');}
})();
