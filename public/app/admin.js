const $=(s)=>document.querySelector(s);
const $$=(s)=>[...document.querySelectorAll(s)];
let token=localStorage.getItem("navo_token")||"";
let me=null;
let users=[];

function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2400)}
async function request(path,opts={}){
  const res=await fetch(path,{...opts,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...(opts.headers||{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw data; return data;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

async function boot(){
  try{
    const data=await request("/api/me");
    me=data.user;
    if(!["owner","admin"].includes(me.role)) throw new Error("not staff");
    $("#admin").classList.remove("hidden");
    bind();
    await Promise.all([loadStats(), loadUsers(), loadTickets(), loadAudit()]);
  }catch{
    $("#blocked").classList.remove("hidden");
  }
}

function bind(){
  $$("[data-tab]").forEach(btn=>btn.onclick=()=>setTab(btn.dataset.tab));
  $("#refreshUsers").onclick=loadUsers;
  $("#refreshTickets").onclick=loadTickets;
  $("#refreshAudit").onclick=loadAudit;
  $("#searchUsers").oninput=debounce(loadUsers,300);
  $("#roleFilter").onchange=loadUsers;
  $("#statusFilter").onchange=loadUsers;
  $("#ticketStatusFilter").onchange=loadTickets;
  $("#homeBtn").onclick=()=>location.href="/";
  $("#logout").onclick=()=>{localStorage.removeItem("navo_token");location.href="/"};
  $("#passwordForm").onsubmit=resetPasswordSubmit;
}

function setTab(tab){
  $$("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  $("#usersTab").classList.toggle("hidden",tab!=="users");
  $("#ticketsTab").classList.toggle("hidden",tab!=="tickets");
  $("#auditTab").classList.toggle("hidden",tab!=="audit");
}

function debounce(fn,ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}

async function loadStats(){
  const s=await request("/api/admin/stats");
  $("#sUsers").textContent=s.users;
  $("#sActive").textContent=s.active;
  $("#sTickets").textContent=s.tickets;
  $("#sTicketsNew").textContent=s.ticketsNew;
}

async function loadUsers(){
  const q=new URLSearchParams();
  if($("#searchUsers").value) q.set("q",$("#searchUsers").value);
  if($("#roleFilter").value) q.set("role",$("#roleFilter").value);
  if($("#statusFilter").value) q.set("status",$("#statusFilter").value);
  const data=await request("/api/admin/users?"+q.toString());
  users=data.users;
  $("#users").innerHTML=users.map(u=>`
    <tr>
      <td>${u.id}</td>
      <td><b>${esc(u.displayName)}</b><br><small class="muted">@${esc(u.username)}</small></td>
      <td><span class="badge ${u.role}">${u.role}</span></td>
      <td><span class="badge ${u.status}">${u.status}</span></td>
      <td><input id="xp_${u.id}" value="${u.xp}" style="width:100px;min-height:38px"></td>
      <td>${u.level}</td>
      <td>${u.focusMinutes}m / ${u.focusSessions}</td>
      <td><div class="row-actions">
        <button class="btn small" onclick="viewUser(${u.id})">تفاصيل</button>
        <button class="btn small" onclick="saveUser(${u.id})">حفظ XP</button>
        <button class="btn small" onclick="toggleBan(${u.id}, '${u.status}')">${u.status==="banned"?"فك الحظر":"حظر"}</button>
        ${me.role==="owner" ? `<button class="btn small" onclick="toggleRole(${u.id}, '${u.role}')">${u.role==="admin"?"User":u.role==="owner"?"Owner":"Admin"}</button>` : ""}
        <button class="btn small" onclick="openResetPassword(${u.id})">كلمة مرور</button>
        <button class="btn small" onclick="deleteUser(${u.id})">حذف</button>
      </div></td>
    </tr>`).join("");
  loadStats();
}

window.saveUser=async(id)=>{
  try{await request("/api/admin/users/"+id,{method:"PATCH",body:JSON.stringify({xp:Number($("#xp_"+id).value)})});toast("تم حفظ XP");loadUsers()}
  catch(e){toast(errorText(e.error))}
}
window.toggleBan=async(id,status)=>{
  try{await request("/api/admin/users/"+id,{method:"PATCH",body:JSON.stringify({status:status==="banned"?"active":"banned"})});toast("تم التحديث");loadUsers()}
  catch(e){toast(errorText(e.error))}
}
window.toggleRole=async(id,role)=>{
  const next=role==="admin"?"user":"admin";
  if(role==="owner") return toast("لا يمكن تعديل Owner");
  try{await request("/api/admin/users/"+id,{method:"PATCH",body:JSON.stringify({role:next})});toast("تم تغيير الرتبة");loadUsers()}
  catch(e){toast(errorText(e.error))}
}
window.deleteUser=async(id)=>{
  if(!confirm("تحذف المستخدم؟")) return;
  try{await request("/api/admin/users/"+id,{method:"DELETE"});toast("تم الحذف");loadUsers()}
  catch(e){toast(errorText(e.error))}
}
window.openResetPassword=(id)=>{
  $("#resetUserId").value=id; $("#newPassword").value=""; $("#passwordDialog").showModal();
}
async function resetPasswordSubmit(e){
  e.preventDefault();
  try{await request("/api/admin/users/"+$("#resetUserId").value+"/reset-password",{method:"POST",body:JSON.stringify({password:$("#newPassword").value})});$("#passwordDialog").close();toast("تم تغيير كلمة المرور")}
  catch(e){toast(errorText(e.error))}
}
window.viewUser=async(id)=>{
  try{
    const d=await request("/api/admin/users/"+id);
    $("#detailsContent").innerHTML=`
      <h2>${esc(d.user.displayName)}</h2>
      <p class="muted">@${esc(d.user.username)} — ${esc(d.user.role)} — ${esc(d.user.status)}</p>
      <div class="details-grid">
        <div><h3>المهام</h3>${d.tasks.length?d.tasks.map(t=>`<div class="ticket"><b>${esc(t.title)}</b><br><small>${t.done?"منجزة":"غير منجزة"} — ${esc(t.priority)}</small></div>`).join(""):"<p class='muted'>لا يوجد</p>"}</div>
        <div><h3>جلسات التركيز</h3>${d.focusLogs.length?d.focusLogs.map(f=>`<div class="ticket">${f.minutes} دقيقة — +${f.xpAdded}XP<br><small>${f.createdAt}</small></div>`).join(""):"<p class='muted'>لا يوجد</p>"}</div>
      </div>
      <h3>التذاكر</h3>
      ${d.tickets.length?d.tickets.map(t=>`<div class="ticket">#${t.id} ${esc(t.title)} — ${esc(t.status)}</div>`).join(""):"<p class='muted'>لا يوجد</p>"}
    `;
    $("#detailsDialog").showModal();
  }catch{toast("تعذر فتح التفاصيل")}
}

async function loadTickets(){
  const q=new URLSearchParams();
  if($("#ticketStatusFilter").value) q.set("status",$("#ticketStatusFilter").value);
  const data=await request("/api/admin/tickets?"+q.toString());
  $("#tickets").innerHTML=data.tickets.length?data.tickets.map(t=>`
    <div class="ticket">
      <div class="section-head">
        <div>
          <span class="chip">#${t.id} — ${esc(t.type)} — ${esc(t.source)}</span>
          <h3>${esc(t.title)}</h3>
          <small class="muted">من: ${esc(t.username || "unknown")} — ${esc(t.createdAt)}</small>
        </div>
        <select onchange="updateTicket(${t.id}, this.value)">
          ${["new","reviewing","solved","rejected"].map(s=>`<option value="${s}" ${t.status===s?"selected":""}>${statusName(s)}</option>`).join("")}
        </select>
      </div>
      <p>${esc(t.message)}</p>
    </div>`).join(""):`<div class="empty">لا توجد تذاكر.</div>`;
  loadStats();
}
function statusName(s){return {new:"جديد",reviewing:"قيد المراجعة",solved:"تم الحل",rejected:"مرفوض"}[s]||s}
window.updateTicket=async(id,status)=>{
  try{await request("/api/admin/tickets/"+id,{method:"PATCH",body:JSON.stringify({status})});toast("تم تحديث التذكرة");loadTickets()}
  catch{toast("تعذر تحديث التذكرة")}
}

async function loadAudit(){
  const data=await request("/api/admin/audit-logs");
  $("#auditLogs").innerHTML=data.logs.length?data.logs.map(l=>`
    <div class="audit-line">
      <b>${esc(l.action)}</b> بواسطة ${esc(l.actorUsername)}<br>
      <small class="muted">${esc(l.targetType)} #${esc(l.targetId)} — ${esc(l.createdAt)}</small>
    </div>`).join(""):`<div class="empty">لا يوجد سجل.</div>`;
}

function errorText(e){
  return {
    OWNER_PROTECTED:"حساب الأونر محمي",
    CANT_DELETE_SELF:"ما تقدر تحذف نفسك",
    CANT_BAN_SELF:"ما تقدر تحظر نفسك",
    OWNER_ONLY:"هذا الإجراء للأونر فقط",
    OWNER_ONLY_ROLE_CHANGE:"تغيير الرتب للأونر فقط",
    BAD_PASSWORD:"كلمة المرور قصيرة"
  }[e] || "صار خطأ";
}
boot();
