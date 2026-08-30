
const cfg=window.LN_CONFIG; const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
(async()=>{
 const status=document.getElementById("dashStatus"), cards=document.getElementById("cards");
 const {data:{user}}=await sb.auth.getUser();
 if(!user){status.innerHTML='<span class="error">No active session. <a href="account.html">Sign in</a> or start a guest submission.</span>';return;}
 const {data,error}=await sb.from("submissions").select("*").order("updated_at",{ascending:false});
 if(error){status.textContent=error.message;return;}
 if(!data.length){cards.innerHTML='<div class="panel"><p>No submissions yet.</p></div>';return;}
 cards.innerHTML=data.map(x=>`<div class="panel"><div class="kicker">${x.status||"draft"} · ${x.payment_status||"unpaid"}</div><h2>${x.film_title||"Untitled film"}</h2><p class="summary">${(x.categories||[]).join(" · ")}</p><p class="small">Updated: ${new Date(x.updated_at).toLocaleString()}</p></div>`).join("");
})();
