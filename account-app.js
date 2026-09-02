const cfg = window.LN_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
const originBase = location.protocol === 'file:' ? 'https://novashortfilmfestival.co.uk/' : new URL('./', location.href).href;
const urlFor = path => new URL(path, originBase).href;
const qs = new URLSearchParams(location.search);
let recoveryMode = qs.get('mode') === 'recovery';

function setStatus(id, text, type=''){
  const el=$(id); if(!el) return;
  el.textContent=text; el.className='status '+type;
}
function buttonBusy(btn,busy,label){ if(!btn)return; if(!btn.dataset.label)btn.dataset.label=btn.textContent; btn.disabled=busy; btn.textContent=busy?label:btn.dataset.label; }
function showPassword(button){ const input=$(button.dataset.toggle); if(!input)return; const show=input.type==='password'; input.type=show?'text':'password'; button.textContent=show?'HIDE':'SHOW'; }
document.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>showPassword(b)));

async function processCode(){
  const code=qs.get('code');
  if(!code) return;
  try{
    const {error}=await sb.auth.exchangeCodeForSession(code);
    if(error) throw error;
    const clean=new URL(location.href); clean.searchParams.delete('code'); history.replaceState({},'',clean.pathname+clean.search+clean.hash);
  }catch(e){ console.warn('Auth callback:',e.message); }
}

async function renderSession(){
  const {data:{user}}=await sb.auth.getUser();
  if(recoveryMode){ $('recoveryPanel').hidden=false; $('authGrid').hidden=true; $('signedPanel').hidden=true; return; }
  if(user && !user.is_anonymous){
    $('authGrid').hidden=true; $('signedPanel').hidden=false;
    $('signedName').textContent=(user.user_metadata?.display_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Filmmaker');
    $('signedEmail').textContent=user.email||'';
    $('verifiedBadge').textContent=user.email_confirmed_at?'Email verified':'Email confirmation pending';
    if(qs.get('confirmed')==='1') setTimeout(()=>location.replace('dashboard.html'),650);
  }else{
    $('signedPanel').hidden=true; $('authGrid').hidden=false;
  }
}

$('signupBtn').onclick=async()=>{
  const btn=$('signupBtn'); buttonBusy(btn,true,'Creating…');
  const email=$('signupEmail').value.trim(), password=$('signupPassword').value, displayName=$('signupName').value.trim();
  if(!email||password.length<8){ setStatus('signupStatus','Enter a valid email and a password of at least 8 characters.','error'); buttonBusy(btn,false); return; }
  const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:urlFor('account.html?confirmed=1')}});
  buttonBusy(btn,false);
  if(error){setStatus('signupStatus',error.message,'error');return;}
  if(data.session){ setStatus('signupStatus','Account created. Opening your dashboard…','ok'); setTimeout(()=>location.replace('dashboard.html'),500); }
  else setStatus('signupStatus','Account created. Please check your email and click the confirmation link, then sign in.','ok');
};

$('resendBtn').onclick=async()=>{
  const email=$('signupEmail').value.trim(); if(!email){setStatus('signupStatus','Enter the email address you used to register first.','error');return;}
  const btn=$('resendBtn'); buttonBusy(btn,true,'Sending…');
  const {error}=await sb.auth.resend({type:'signup',email,options:{emailRedirectTo:urlFor('account.html?confirmed=1')}});
  buttonBusy(btn,false); setStatus('signupStatus',error?error.message:'Confirmation email sent. Please check your inbox and spam folder.',error?'error':'ok');
};

$('loginBtn').onclick=async()=>{
  const btn=$('loginBtn'); buttonBusy(btn,true,'Signing in…');
  const {error}=await sb.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
  buttonBusy(btn,false);
  if(error){setStatus('loginStatus',error.message,'error');return;}
  setStatus('loginStatus','Signed in. Opening your dashboard…','ok'); setTimeout(()=>location.replace('dashboard.html'),350);
};

$('forgotBtn').onclick=async()=>{
  const email=$('loginEmail').value.trim(); if(!email){setStatus('loginStatus','Enter your email address first, then choose Forgot password.','error');return;}
  const btn=$('forgotBtn'); buttonBusy(btn,true,'Sending…');
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:urlFor('account.html?mode=recovery')});
  buttonBusy(btn,false); setStatus('loginStatus',error?error.message:'Password-reset email sent. Open the secure link in that email to choose a new password.',error?'error':'ok');
};

$('updatePasswordBtn').onclick=async()=>{
  const a=$('newPassword').value,b=$('newPassword2').value;
  if(a.length<8){setStatus('recoveryStatus','Use at least 8 characters.','error');return;}
  if(a!==b){setStatus('recoveryStatus','The two passwords do not match.','error');return;}
  const btn=$('updatePasswordBtn'); buttonBusy(btn,true,'Updating…');
  const {error}=await sb.auth.updateUser({password:a}); buttonBusy(btn,false);
  if(error){setStatus('recoveryStatus',error.message,'error');return;}
  setStatus('recoveryStatus','Password updated. Opening your dashboard…','ok'); recoveryMode=false; setTimeout(()=>location.replace('dashboard.html'),700);
};

$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.replace('account.html');};
sb.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){recoveryMode=true;renderSession();}});
(async()=>{await processCode();await renderSession();})();
