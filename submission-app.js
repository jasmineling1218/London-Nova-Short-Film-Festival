const cfg = window.LN_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
let currentSubmissionId = null;
let currentRowStatus = null;

const $ = (id) => document.getElementById(id);
const fieldIds = ["film_title","original_title","runtime_minutes","year","country","language","synopsis","filmmaker_name","contact_email","director_name","producer_name","screener_url","screener_password","download_url","artwork_url"];

function selectedCategories(){
  return [...document.querySelectorAll('#categoryChecks input:checked')].map(x => x.value);
}

async function ensureSession(){
  const { data: { session } } = await sb.auth.getSession();
  if (session) return session;
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

async function showSession(){
  const { data: { user } } = await sb.auth.getUser();
  const el = $("sessionStatus");
  if (!user) { el.textContent = "No active session yet."; return; }
  el.innerHTML = user.is_anonymous
    ? '<span class="ok">Guest session active.</span>'
    : '<span class="ok">Signed in as '+(user.email || 'account user')+'. Drafts are saved to your account.</span>';
}

function payload(){
  const p = {};
  fieldIds.forEach(id => p[id] = $(id).value || null);
  p.runtime_minutes = p.runtime_minutes ? Number(p.runtime_minutes) : null;
  p.year = p.year ? Number(p.year) : null;
  p.categories = selectedCategories();
  p.rights_confirmed = $("rights_ok").checked;
  p.screening_permission = $("screening_ok").checked;
  p.marketing_permission = $("marketing_ok").checked;
  p.terms_accepted = $("terms_ok").checked;
  return p;
}

function fillForm(data){
  currentSubmissionId = data.id;
  currentRowStatus = data.status;
  fieldIds.forEach(k => { if ($(k) && data[k] !== null) $(k).value = data[k]; });
  document.querySelectorAll('#categoryChecks input').forEach(el => el.checked = false);
  (data.categories || []).forEach(c => {
    const el = document.querySelector('#categoryChecks input[value="'+CSS.escape(c)+'"]');
    if (el) el.checked = true;
  });
  $("rights_ok").checked = !!data.rights_confirmed;
  $("screening_ok").checked = !!data.screening_permission;
  $("marketing_ok").checked = !!data.marketing_permission;
  $("terms_ok").checked = !!data.terms_accepted;
  localStorage.setItem("ln_current_submission_id", data.id);
  renderSummary();
}

function lockSubmitted(message){
  document.querySelectorAll('#submissionForm input, #submissionForm textarea, #submissionForm button').forEach(el => el.disabled = true);
  $("formStatus").innerHTML = '<span class="ok">'+message+'</span>';
}

async function saveDraft(){
  const status = $("formStatus");
  try {
    const session = await ensureSession();
    const p = payload();
    if (p.runtime_minutes && p.runtime_minutes > 30) throw new Error("Running time must be 30 minutes or less.");
    if (!p.categories.length) throw new Error("Choose at least one category.");

    if (currentSubmissionId) {
      const { data: existing, error: existingError } = await sb.from("submissions")
        .select("id,status,payment_status")
        .eq("id", currentSubmissionId)
        .single();
      if (existingError) throw existingError;
      if (existing.payment_status === "paid" || existing.status === "submitted") {
        throw new Error("This submission has already been paid and can no longer be edited.");
      }
    }

    const row = { ...p, user_id: session.user.id, status: "draft", payment_status: "unpaid" };
    let res;
    if (currentSubmissionId) {
      res = await sb.from("submissions").update(row).eq("id", currentSubmissionId).select().single();
    } else {
      res = await sb.from("submissions").insert(row).select().single();
    }
    if (res.error) throw res.error;

    currentSubmissionId = res.data.id;
    currentRowStatus = res.data.status;
    localStorage.setItem("ln_current_submission_id", currentSubmissionId);
    status.innerHTML = '<span class="ok">Draft saved. You can return from My Submissions and continue editing later.</span>';
    await showSession();
    return res.data;
  } catch (e) {
    status.innerHTML = '<span class="error">'+e.message+'</span>';
    throw e;
  }
}

async function loadDraft(){
  const params = new URLSearchParams(location.search);
  const editId = params.get("edit");
  const localId = localStorage.getItem("ln_current_submission_id");
  const id = editId || localId;
  if (!id) return;

  const { data, error } = await sb.from("submissions").select("*").eq("id", id).maybeSingle();
  if (error || !data) {
    if (editId) $("formStatus").innerHTML = '<span class="error">This draft could not be opened. Please return to My Submissions.</span>';
    return;
  }

  fillForm(data);
  if (data.payment_status === "paid" || data.status === "submitted") {
    lockSubmitted("This submission is confirmed and locked after payment.");
  } else if (editId) {
    $("formStatus").innerHTML = '<span class="ok">Draft loaded. Edit any field and press Save Draft when you are ready.</span>';
  }
}

function renderSummary(){
  const p = payload();
  const cats = p.categories.map(c => '<span class="pill">'+c.replaceAll('-', ' ')+'</span>').join('');
  $("summary").innerHTML = '<p><strong>Film:</strong> '+(p.film_title || '—')+'</p><p><strong>Runtime:</strong> '+(p.runtime_minutes || '—')+' min</p><p><strong>Contact:</strong> '+(p.contact_email || '—')+'</p><p><strong>Categories:</strong><br>'+(cats || '—')+'</p>';
}

$("guestBtn").addEventListener("click", async () => {
  try { await ensureSession(); await showSession(); }
  catch (e) { $("sessionStatus").innerHTML = '<span class="error">'+e.message+'</span>'; }
});
$("saveDraftBtn").addEventListener("click", async () => { try { await saveDraft(); } catch {} });
$("submissionForm").addEventListener("input", renderSummary);
$("submissionForm").addEventListener("change", renderSummary);

$("submissionForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payBtn = $("payBtn");
  try {
    if (!$("submissionForm").reportValidity()) return;
    const p = payload();
    if (p.runtime_minutes > 30) throw new Error("Running time must be 30 minutes or less.");
    if (!p.categories.length) throw new Error("Choose at least one category.");

    payBtn.disabled = true;
    payBtn.textContent = "Preparing secure checkout…";
    $("formStatus").innerHTML = '<span class="ok">Preparing secure checkout…</span>';

    const row = await saveDraft();
    const { data, error } = await sb.functions.invoke("create-checkout", {
      body: { submission_id: row.id }
    });

    if (error) {
      let message = error.message || "Could not start payment.";
      try {
        if (error.context) {
          const detail = await error.context.json();
          if (detail?.error) message = detail.error;
        }
      } catch {}
      throw new Error(message);
    }

    const checkoutUrl = data?.checkout_url || data?.url;
    if (!checkoutUrl) throw new Error("No Stripe Checkout URL returned.");
    window.location.assign(checkoutUrl);
  } catch (err) {
    $("formStatus").innerHTML = '<span class="error">'+err.message+'</span>';
    payBtn.disabled = false;
    payBtn.textContent = "Review & Pay";
  }
});

(async () => {
  await showSession();
  await loadDraft();
  renderSummary();
})();
