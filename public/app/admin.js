const $=(s)=>document.querySelector(s);
let token=localStorage.getItem("navo_token")||"";
let users=[];
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2400)}
async function request(path,opts={}){
  const res=await fetch(path,{...opts,headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...(opts.headers||{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw data; return data;
}
async function boot(){
  try{
    const me=await request("/api/me");
    if(me.user.role!=="admin") throw new Error("not admin");
    $("#admin").classList.remove("hidden");
    await load();
  }catch{
    $("#blocked").classList.remove("hidden");
  }
}
async function load(){
  const stats=await request("/api/admin/stats");
  $("#sUsers").textContent=stats.users; $("#sActive").textContent=stats.active; $("#sBanned").textContent=stats.banned; $("#sFocus").textContent=stats.focus+"m";
  const data=await request("/api/admin/users"); users=data.users;
  $("#users").innerHTML=users.map(u=>`
    <tr>
      <td>${u.id}</td>
      <td><b>${esc(u.displayName)}</b><br><small class="muted">${esc(u.username)}</small></td>
      <td><span class="badge ${u.role}">${u.role}</span></td>
      <td><span class="badge ${u.status}">${u.status}</span></td>
      <td><input id="xp_${u.id}" value="${u.xp}" style="width:100px;min-height:38px"></td>
      <td>${u.level}</td>
      <td>${u.focusMinutes}m / ${u.focusSessions}</td>
      <td><div class="row-actions">
        <button class="btn small" onclick="saveUser(${u.id})">حفظ XP</button>
        <button class="btn small" onclick="toggleBan(${u.id}, '${u.status}')">${u.status==="banned"?"فك الحظر":"حظر"}</button>
        <button class="btn small" onclick="toggleRole(${u.id}, '${u.role}')">${u.role==="admin"?"User":"Admin"}</button>
        <button class="btn small" onclick="deleteUser(${u.id})">حذف</button>
      </div></td>
    </tr>`).join("");
}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
window.saveUser=async(id)=>{await request("/api/admin/users/"+id,{method:"PATCH",body:JSON.stringify({xp:Number($("#xp_"+id).value)})});toast("تم الحفظ");load()};
window.toggleBan=async(id,status)=>{await request("/api/admin/users/"+id,{method:"PATCH",body:JSON.stringify({status:status==="banned"?"active":"banned"})});toast("تم التحديث");load()};
window.toggleRole=async(id,role)=>{await request("/api/admin/users/"+id,{method:"PATCH",body:JSON.stringify({role:role==="admin"?"user":"admin"})});toast("تم تغيير الرتبة");load()};
window.deleteUser=async(id)=>{if(confirm("تحذف المستخدم؟")){await request("/api/admin/users/"+id,{method:"DELETE"});toast("تم الحذف");load()}};
$("#refresh").onclick=load;
$("#homeBtn").onclick=()=>location.href="/";
$("#logout").onclick=()=>{localStorage.removeItem("navo_token");location.href="/"};
boot();
