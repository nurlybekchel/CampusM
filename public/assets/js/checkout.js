const state = {
  user: null,
  item: null
};

const els = {
  notice: document.getElementById("notice"),
  checkoutSummary: document.getElementById("checkoutSummary"),
  backToItem: document.getElementById("backToItem"),
  payBtn: document.getElementById("payBtn")
};

function getItemId() {
  const params = new URLSearchParams(window.location.search);
  const itemId = Number(params.get("itemId"));
  return Number.isInteger(itemId) ? itemId : null;
}

function cardDisplay(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function renderSummary() {
  els.checkoutSummary.innerHTML = `
    <p class="eyebrow">Перевод по карте</p>
    <h2>${App.escapeHtml(state.item.title)}</h2>
    <p class="checkout-copy">${App.escapeHtml(state.item.description)}</p>

    <div class="summary-box">
      <div class="summary-row"><span>Категория</span><strong>${App.escapeHtml(state.item.category)}</strong></div>
      <div class="summary-row"><span>Локация</span><strong>${App.escapeHtml(state.item.dormLocation)}</strong></div>
      <div class="summary-row"><span>Карта продавца</span><strong>${App.escapeHtml(cardDisplay(state.item.sellerCard) || "-")}</strong></div>
      <div class="summary-row summary-total"><span>Итого к переводу</span><strong>${App.formatMoney(state.item.price)}</strong></div>
    </div>
  `;
  els.backToItem.href = `/item/${state.item.id}`;
}

els.payBtn.addEventListener("click", async () => {
  try {
    els.payBtn.disabled = true;
    await App.api("/api/purchases", {
      method: "POST",
      body: JSON.stringify({ itemId: state.item.id })
    });
    App.setNotice(els.notice, "Перевод отмечен. Ожидайте подтверждение продавца.", "success");
    setTimeout(() => {
      window.location.href = "/purchases";
    }, 700);
  } catch (error) {
    els.payBtn.disabled = false;
    App.setNotice(els.notice, error.message || "Не удалось создать сделку.", "error");
  }
});

async function bootstrap() {
  const itemId = getItemId();
  if (!itemId) {
    window.location.href = "/";
    return;
  }

  const user = await App.getMe();
  if (!user) {
    window.location.href = "/auth";
    return;
  }
  if (user.role === "admin") {
    window.location.href = "/admin";
    return;
  }

  state.user = user;
  App.mountTopbar({ active: "checkout", user });

  const data = await App.api(`/api/items/${itemId}`);
  state.item = data.item;

  if (state.item.status === "sold" || state.item.seller?.id === user.id) {
    window.location.href = `/item/${itemId}`;
    return;
  }

  renderSummary();
}

bootstrap().catch((error) => {
  App.setNotice(els.notice, error.message || "Не удалось открыть страницу перевода.", "error");
});
