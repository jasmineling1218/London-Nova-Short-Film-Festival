const cfg = window.LN_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
const esc=(v='')=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const prettyStatus=s=>({draft:'Draft',awaiting_payment:'Awaiting payment',submitted:'Submitted',under_review:'Under review',selected:'Selected',not_selected:'Not selected',withdrawn:'Withdrawn'}[s]||s||'Draft');
(async()=>{
  const status=document.getElementById('dashStatus'),cards=document.getElementById('cards');
  const {data:{user}}=await sb.auth.getUser();
  if(!user||user.is_anonymous){ status.innerHTML='<span class="error">Please <a href="account.html">sign in</a> to open your filmmaker dashboard.</span>'; return; }
  const name=(user.user_metadata?.display_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Filmmaker').trim();
  document.getElementById('welcomeTitle').textContent='WELCOME, '+name.toUpperCase();
  document.getElementById('accountStrip').hidden=false;document.getElementById('accountName').textContent=name;document.getElementById('accountEmail').textContent=user.email||'';document.getElementById('emailState').textContent=user.email_confirmed_at?'Email verified':'Email confirmation pending';
  document.getElementById('signoutBtn').onclick=async()=>{await sb.auth.signOut();location.replace('account.html')};
  try{const {data:isAdmin}=await sb.rpc('is_admin');if(isAdmin===true){document.getElementById('editorialLink').hidden=false;document.getElementById('adminFeedbackLink').hidden=false}}catch{}
  const {data,error}=await sb.from('submissions').select('*').order('updated_at',{ascending:false});
  if(error){status.textContent=error.message;return}
  if(!data?.length){cards.innerHTML='<div class="panel"><h2>No submissions yet.</h2><p class="summary">Start a draft when you are ready. You can return and edit it before payment.</p><p><a class="btn primary" href="direct-submit.html">Start a submission</a></p></div>';return}
  cards.innerHTML=data.map(x=>{const editable=['draft','awaiting_payment'].includes(x.status)&&x.payment_status!=='paid';const actionLabel=x.status==='awaiting_payment'?'Continue & Pay':'Edit Draft';const categories=(x.categories||[]).map(c=>esc(c.replaceAll('-',' '))).join(' · ')||'No category selected';const statusClass=x.status==='submitted'||x.payment_status==='paid'?'ok':'';return `<article class="panel submission-card"><div class="card-top"><div><div class="kicker ${statusClass}">${esc(prettyStatus(x.status))} · ${esc(x.payment_status||'unpaid')}</div><h2>${esc(x.film_title||'Untitled film')}</h2></div>${x.payment_status==='paid'?'<span class="paid-mark">PAYMENT CONFIRMED</span>':''}</div><p class="summary">${categories}</p><p class="small">Updated: ${new Date(x.updated_at).toLocaleString('en-GB')}</p><div class="card-actions">${editable?`<a class="btn primary" href="direct-submit.html?edit=${encodeURIComponent(x.id)}">${actionLabel}</a>`:'<span class="locked-note">Submission locked after successful payment.</span>'}</div></article>`}).join('');
})();
