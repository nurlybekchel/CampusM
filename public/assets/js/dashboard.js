const state = {
  user: null,
  myItems: [],
  sales: []
};

const els = {
  notice: document.getElementById("notice"),
  profileBox: document.getElementById("profileBox"),
  itemForm: document.getElementById("itemForm"),
  formTitle: document.getElementById("formTitle"),
  submitBtn: document.getElementById("submitBtn"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  itemId: document.getElementById("itemId"),
  title: document.getElementById("title"),
  description: document.getElementById("description"),
  price: document.getElementById("price"),
  category: document.getElementById("category"),
  dormLocation: document.getElementById("dormLocation"),
  sellerCard: document.getElementById("sellerCard"),
  imageUrl: document.getElementById("imageUrl"),
  status: document.getElementById("status"),
  myItemsGrid: document.getElementById("myItemsGrid"),
  salesGrid: document.getElementById("salesGrid")
};

function formatCardInput(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function transferStatusText(status) {
  if (status === "pending_seller_confirmation") return "Ожидает подтверждения оплаты продавцом";
  if (status === "pending_buyer_confirmation") return "Ожидает подтверждения получения товара покупателем";
  if (status === "completed") return "Сделка завершена";
  if (status === "disputed") return "Открыт спор";
  return status || "-";
}

function resetForm() {
  els.itemForm.reset();
  els.itemId.value = "";
  els.status.value = "active";
  els.formTitle.textContent = "Добавить новое объявление";
  els.submitBtn.textContent = "Опубликовать";
  els.cancelEditBtn.classList.add("hidden");
}

function fillForm(item) {
  els.itemId.value = item.id;
  els.title.value = item.title;
  els.description.value = item.description;
  els.price.value = item.price;
  els.category.value = item.category;
  els.dormLocation.value = item.dormLocation;
  els.sellerCard.value = formatCardInput(item.sellerCard || "");
  els.imageUrl.value = item.imageUrl || "";
  els.status.value = item.status || "active";
  els.formTitle.textContent = `Редактирование: ${item.title}`;
  els.submitBtn.textContent = "Сохранить";
  els.cancelEditBtn.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderProfile() {
  els.profileBox.innerHTML = `
    <article class="mini-stat"><h3>${App.escapeHtml(state.user.fullName)}</h3><p>${App.escapeHtml(
      state.user.email
    )}</p></article>
    <article class="mini-stat"><h3>${state.myItems.length}</h3><p>Всего объявлений</p></article>
    <article class="mini-stat"><h3>${state.myItems.filter((x) => x.status === "active").length}</h3><p>Активные</p></article>
    <article class="mini-stat"><h3>${state.myItems.filter((x) => x.status === "sold").length}</h3><p>Проданные</p></article>
  `;
}

function renderMyItems() {
  if (!state.myItems.length) {
    els.myItemsGrid.innerHTML = `
      <div class="panel section empty-state">
        <h3>Мои объявления</h3>
        <p>У вас пока нет объявлений. Добавьте первое выше, и оно сразу появится в этом блоке.</p>
      </div>
    `;
    return;
  }

  els.myItemsGrid.innerHTML = state.myItems
    .map((item) => App.itemCard(item, { showManage: true, showSeller: false }))
    .join("");
}

function renderSales() {
  if (!state.sales.length) {
    els.salesGrid.innerHTML = `
      <div class="panel section empty-state">
        <h3>Сделок пока нет</h3>
        <p>Когда покупатель подтвердит перевод по вашему товару, сделка появится здесь.</p>
      </div>
    `;
    return;
  }

  els.salesGrid.innerHTML = state.sales
    .map((sale) => {
      const canConfirmPayment = sale.transferStatus !== "completed" && sale.transferStatus !== "disputed" && !sale.sellerPaymentConfirmed;
      const canDispute = sale.transferStatus !== "completed" && sale.transferStatus !== "disputed";
      return `
        <article class="panel section">
          <h3>${App.escapeHtml(sale.item.title)}</h3>
          <p class="profile-subtitle">Покупатель: ${App.escapeHtml(sale.buyer?.name || "-")}</p>
          <p class="profile-subtitle">Сумма: ${App.formatMoney(sale.soldPrice)}</p>
          <p class="profile-subtitle">Статус: ${transferStatusText(sale.transferStatus)}</p>
          <div class="item-actions">
            <a class="button ghost button-link" href="/item/${sale.item.id}">Открыть товар</a>
            ${canConfirmPayment ? `<button class="button primary" data-confirm-payment="${sale.id}" type="button">Подтвердить получение оплаты</button>` : ""}
            ${canDispute ? `<button class="button warning" data-open-dispute="${sale.id}" type="button">Открыть спор</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadData() {
  const [itemsData, salesData] = await Promise.all([App.api("/api/users/me/items"), App.api("/api/users/me/sales")]);
  state.myItems = itemsData.items || [];
  state.sales = salesData.sales || [];
  renderProfile();
  renderMyItems();
  renderSales();
}

els.itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    title: els.title.value,
    description: els.description.value,
    price: Number(els.price.value),
    category: els.category.value,
    dormLocation: els.dormLocation.value,
    sellerCard: els.sellerCard.value,
    imageUrl: els.imageUrl.value,
    status: els.status.value
  };

  const id = els.itemId.value;

  try {
    if (id) {
      await App.api(`/api/items/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      App.setNotice(els.notice, "Объявление обновлено.", "success");
    } else {
      await App.api("/api/items", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      App.setNotice(els.notice, "Объявление создано.", "success");
    }

    resetForm();
    await loadData();
  } catch (error) {
    App.setNotice(els.notice, error.message, "error");
  }
});

els.cancelEditBtn.addEventListener("click", () => resetForm());

els.sellerCard.addEventListener("input", () => {
  els.sellerCard.value = formatCardInput(els.sellerCard.value);
});

document.addEventListener("click", async (event) => {
  const editId = event.target.getAttribute("data-edit-item");
  const deleteId = event.target.getAttribute("data-delete-item");
  const confirmPaymentId = event.target.getAttribute("data-confirm-payment");
  const disputeId = event.target.getAttribute("data-open-dispute");

  if (editId) {
    const item = state.myItems.find((x) => String(x.id) === String(editId));
    if (item) fillForm(item);
    return;
  }

  if (deleteId) {
    const ok = window.confirm("Удалить объявление без возможности восстановления?");
    if (!ok) return;

    try {
      await App.api(`/api/items/${deleteId}`, { method: "DELETE" });
      App.setNotice(els.notice, "Объявление удалено.", "success");
      await loadData();
    } catch (error) {
      App.setNotice(els.notice, error.message, "error");
    }
    return;
  }

  if (confirmPaymentId) {
    try {
      await App.api(`/api/purchases/${confirmPaymentId}/confirm-payment`, { method: "POST" });
      App.setNotice(els.notice, "Получение оплаты подтверждено.", "success");
      await loadData();
    } catch (error) {
      App.setNotice(els.notice, error.message, "error");
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
      await loadData();
    } catch (error) {
      App.setNotice(els.notice, error.message, "error");
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
  App.mountTopbar({ active: "dashboard", user });
  resetForm();
  await loadData();
}

bootstrap().catch(console.error);
