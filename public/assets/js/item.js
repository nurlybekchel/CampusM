const state = {
  user: null,
  item: null
};

const els = {
  notice: document.getElementById("notice"),
  itemPage: document.getElementById("itemPage")
};

function getItemId() {
  const raw = window.location.pathname.split("/").pop();
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

function canBuy(item, user) {
  if (!user) return false;
  if (user.role === "admin") return false;
  if (item.status === "sold") return false;
  if (item.seller?.id === user.id) return false;
  return true;
}

function cardDisplay(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function renderItem() {
  if (!state.item) return;

  const buyAvailable = canBuy(state.item, state.user);
  const isOwner = state.user && state.item.seller?.id === state.user.id;
  const sellerCard = cardDisplay(state.item.sellerCard);

  els.itemPage.innerHTML = `
    <div class="item-gallery">
      ${
        state.item.imageUrl
          ? `<img src="${App.escapeHtml(state.item.imageUrl)}" alt="${App.escapeHtml(state.item.title)}" />`
          : '<div class="item-cover"></div>'
      }
    </div>
    <div class="item-details">
      <span class="badge ${state.item.status === "sold" ? "sold" : "active"}">${
        state.item.status === "sold" ? "Продано" : "Активно"
      }</span>
      <h1>${App.escapeHtml(state.item.title)}</h1>
      <p class="item-large-price">${App.formatMoney(state.item.price)}</p>
      <p class="item-large-desc">${App.escapeHtml(state.item.description)}</p>

      <div class="meta-grid">
        <article class="meta-card"><strong>Категория</strong><span>${App.escapeHtml(state.item.category)}</span></article>
        <article class="meta-card"><strong>Локация</strong><span>${App.escapeHtml(state.item.dormLocation)}</span></article>
        <article class="meta-card"><strong>Продавец</strong><span>${App.escapeHtml(state.item.seller?.name || "-")}</span></article>
        <article class="meta-card"><strong>Обновлено</strong><span>${App.formatDate(state.item.updatedAt || state.item.createdAt)}</span></article>
      </div>

      ${
        buyAvailable
          ? `
          <article class="panel section">
            <h3>Перевод продавцу</h3>
            <p class="profile-subtitle">Переведите сумму ${App.formatMoney(state.item.price)} по номеру карты продавца:</p>
            <p class="item-large-price">${App.escapeHtml(sellerCard || "Карта не указана")}</p>
          </article>
        `
          : ""
      }

      <div class="item-actions">
        <a class="button ghost button-link" href="/">Назад в каталог</a>
        ${
          buyAvailable
            ? '<button class="button primary" id="transferBtn" type="button">Я перевел деньги</button>'
            : ""
        }
        ${!state.user ? '<a class="button secondary button-link" href="/auth">Войти для покупки</a>' : ""}
        ${isOwner ? '<a class="button secondary button-link" href="/dashboard">Редактировать в кабинете</a>' : ""}
      </div>
    </div>
  `;

  const transferBtn = document.getElementById("transferBtn");
  if (transferBtn) {
    transferBtn.addEventListener("click", async () => {
      try {
        transferBtn.disabled = true;
        await App.api("/api/purchases", {
          method: "POST",
          body: JSON.stringify({ itemId: state.item.id })
        });
        App.setNotice(els.notice, "Перевод отмечен. Ожидайте подтверждение оплаты продавцом.", "success");
        setTimeout(() => {
          window.location.href = "/purchases";
        }, 800);
      } catch (error) {
        transferBtn.disabled = false;
        App.setNotice(els.notice, error.message || "Не удалось создать сделку.", "error");
      }
    });
  }
}

async function bootstrap() {
  const itemId = getItemId();
  if (!itemId) {
    window.location.href = "/";
    return;
  }

  state.user = await App.getMe();
  App.mountTopbar({ active: "home", user: state.user });

  const data = await App.api(`/api/items/${itemId}`);
  state.item = data.item;
  renderItem();
}

bootstrap().catch((error) => {
  App.setNotice(els.notice, error.message || "Не удалось загрузить товар.", "error");
});
