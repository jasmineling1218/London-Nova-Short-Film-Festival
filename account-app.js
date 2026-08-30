
const cfg=window.LN_CONFIG; const sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
const $=id=>document.getElementById(id);
$("signupBtn").onclick=async()=>{const {data,error}=await sb.auth.signUp({email:$("signupEmail").value,password:$("signupPassword").value});$("signupStatus").innerHTML=error?'<span class="error">'+error.message+'</span>':'<span class="ok">Account created. Check your email if confirmation is enabled.</span>';};
$("loginBtn").onclick=async()=>{const {data,error}=await sb.auth.signInWithPassword({email:$("loginEmail").value,password:$("loginPassword").value});$("loginStatus").innerHTML=error?'<span class="error">'+error.message+'</span>':'<span class="ok">Signed in. <a href="dashboard.html">Open My Submissions →</a></span>';};
$("logoutBtn").onclick=async()=>{await sb.auth.signOut();location.reload();};
