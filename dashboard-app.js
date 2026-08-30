const cfg = window.LN_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const prettyStatus = (status) => ({
  draft: "Draft",
  awaiting_payment: "Awaiting payment",
  submitted: "Submitted",
  under_review: "Under review",
  selected: "Selected",
  not_selected: "Not selected",
  withdrawn: "Withdrawn"
}[status] || status || "Draft");

(async () => {
  const status = document.getElementById("dashStatus");
  const cards = document.getElementById("cards");
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    status.innerHTML = '<span class="error">No active session. <a href="account.html">Sign in</a> to view your submissions.</span>';
    return;
  }

  const { data, error } = await sb
    .from("submissions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    status.textContent = error.message;
    return;
  }

  if (!data.length) {
    cards.innerHTML = '<div class="panel"><p>No submissions yet.</p><p><a class="btn primary" href="direct-submit.html">Start a submission</a></p></div>';
    return;
  }

  cards.innerHTML = data.map((x) => {
    const editable = ["draft", "awaiting_payment"].includes(x.status) && x.payment_status !== "paid";
    const actionLabel = x.status === "awaiting_payment" ? "Continue & Pay" : "Edit Draft";
    const categories = (x.categories || []).map(c => esc(c.replaceAll("-", " "))).join(" · ") || "No category selected";
    const statusClass = x.status === "submitted" || x.payment_status === "paid" ? "ok" : "";

    return `<article class="panel submission-card">
      <div class="card-top">
        <div>
          <div class="kicker ${statusClass}">${esc(prettyStatus(x.status))} · ${esc(x.payment_status || "unpaid")}</div>
          <h2>${esc(x.film_title || "Untitled film")}</h2>
        </div>
        ${x.payment_status === "paid" ? '<span class="paid-mark">PAYMENT CONFIRMED</span>' : ''}
      </div>
      <p class="summary">${categories}</p>
      <p class="small">Updated: ${new Date(x.updated_at).toLocaleString()}</p>
      <div class="card-actions">
        ${editable ? `<a class="btn primary" href="direct-submit.html?edit=${encodeURIComponent(x.id)}">${actionLabel}</a>` : '<span class="locked-note">Submission locked after successful payment.</span>'}
      </div>
    </article>`;
  }).join("");
})();
