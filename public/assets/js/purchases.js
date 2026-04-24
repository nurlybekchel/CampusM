const state = {
  user: null,
  purchases: []
};

const els = {
  notice: document.getElementById("notice"),
  purchasesStats: document.getElementById("purchasesStats"),
  purchasesGrid: document.getElementById("purchasesGrid")
};

function transferStatusText(status) {
  if (status === "pending_seller_confirmation") return "Ожидает подтверждения оплаты продавцом";
  if (status === "pending_buyer_confirmation") return "Ожидает подтверждения получения товара";
  if (status === "completed") return "Сделка завершена";
  if (status === "disputed") return "Открыт спор";
  return status || "-";
}

function renderStats() {
  const total = state.purchases.length;
  const totalSum = state.purchases.reduce((sum, purchase) => sum + Number(purchase.soldPrice || 0), 0);
  const avg = total ? Math.round(totalSum / total) : 0;

  els.purchasesStats.innerHTML = `
    <article class="mini-stat"><h3>${total}</h3><p>Всего покупок</p></article>
    <article class="mini-stat"><h3>${App.formatMoney(totalSum)}</h3><p>Потрачено</p></article>
    <article class="mini-stat"><h3>${App.formatMoney(avg)}</h3><p>Средний чек</p></article>
    <article class="mini-stat"><h3>${state.user ? App.escapeHtml(state.user.fullName) : "-"}</h3><p>Покупатель</p></article>
  `;
}

function renderPurchases() {
  if (!state.purchases.length) {
    els.purchasesGrid.innerHTML = `
      <div class="panel section empty-state">
        <h3>Покупок пока нет</h3>
        <p>Откройте каталог, выберите товар и сделайте перевод по карте продавца.</p>
      </div>
    `;
    return;
  }

  els.purchasesGrid.innerHTML = state.purchases
    .map((purchase) => {
      const card = App.itemCard(purchase.item, { showSeller: true, showManage: false, showDetails: true });
      const canConfirmReceipt = purchase.transferStatus !== "completed" && purchase.transferStatus !== "disputed" && !purchase.buyerItemConfirmed;
      const canDispute = purchase.transferStatus !== "completed" && purchase.transferStatus !== "disputed";

      return `
        <div class="purchase-card-wrap panel section">
          <div class="purchase-meta">Сделка: ${App.formatDateTime(purchase.purchasedAt)}</div>
          <p class="profile-subtitle">Статус: ${transferStatusText(purchase.transferStatus)}</p>
          ${card}
          <div class="item-actions">
            ${canConfirmReceipt ? `<button class="button primary" data-confirm-receipt="${purchase.id}" type="button">Подтвердить получение товара</button>` : ""}
            ${canDispute ? `<button class="button warning" data-open-dispute="${purchase.id}" type="button">Открыть спор</button>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadPurchases() {
  const data = await App.api("/api/users/me/purchases");
  state.purchases = data.purchases || [];
  renderStats();
  renderPurchases();
}

document.addEventListener("click", async (event) => {
  const confirmReceiptId = event.target.getAttribute("data-confirm-receipt");
  const disputeId = event.target.getAttribute("data-open-dispute");

  if (confirmReceiptId) {
    try {
      await App.api(`/api/purchases/${confirmReceiptId}/confirm-receipt`, { method: "POST" });
      App.setNotice(els.notice, "Получение товара подтверждено.", "success");
      await loadPurchases();
    } catch (error) {
      App.setNotice(els.notice, error.message || "Не удалось подтвердить получение.", "error");
    }
    return;
  }

  if (disputeId) {
    const note = window.prompt("Опишите проблему для администратора:");
    if (!note) return;
    try {
      await App.api(`/api/purchases/${disputeId}/dispute`, {
        method: "POST",
        body: JSON.stringify({ note })
      });
      App.setNotice(els.notice, "Спор отправлен администратору.", "success");
      await loadPurchases();
    } catch (error) {
      App.setNotice(els.notice, error.message || "Не удалось открыть спор.", "error");
    }
  }
});

async function bootstrap() {
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
  App.mountTopbar({ active: "purchases", user });
  await loadPurchases();
}

bootstrap().catch((error) => {
  App.setNotice(els.notice, error.message || "Не удалось загрузить покупки.", "error");
});
