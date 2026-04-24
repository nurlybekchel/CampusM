const state = {
  user: null,
  myItems: []
};

const els = {
  notice: document.getElementById("notice"),
  profileHead: document.getElementById("profileHead"),
  profileStats: document.getElementById("profileStats"),
  recentItems: document.getElementById("recentItems"),
  profileForm: document.getElementById("profileForm"),
  profileFullName: document.getElementById("profileFullName"),
  profilePhone: document.getElementById("profilePhone"),
  profileEmail: document.getElementById("profileEmail"),
  profileSaveBtn: document.getElementById("profileSaveBtn")
};

function renderHeader() {
  const initials = state.user.fullName
    .split(" ")
    .map((x) => x.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  els.profileHead.innerHTML = `
    <div class="profile-avatar">${App.escapeHtml(initials || "U")}</div>
    <div>
      <h1 class="profile-title">${App.escapeHtml(state.user.fullName)}</h1>
      <p class="profile-subtitle">${App.escapeHtml(state.user.email)}</p>
      <p class="profile-subtitle">Телефон: ${App.escapeHtml(state.user.phone || "не указан")}</p>
      <p class="profile-subtitle">Зарегистрирован: ${App.formatDate(state.user.createdAt)}</p>
    </div>
  `;
}

function fillProfileForm() {
  els.profileFullName.value = state.user.fullName || "";
  els.profilePhone.value = state.user.phone || "";
  els.profileEmail.value = state.user.email || "";
}

function renderStats() {
  const soldCount = state.myItems.filter((item) => item.status === "sold").length;
  const activeCount = state.myItems.filter((item) => item.status === "active").length;
  const totalRevenue = state.myItems
    .filter((item) => item.status === "sold")
    .reduce((sum, item) => sum + Number(item.price), 0);

  els.profileStats.innerHTML = `
    <article class="mini-stat"><h3>${state.myItems.length}</h3><p>Всего объявлений</p></article>
    <article class="mini-stat"><h3>${activeCount}</h3><p>Активные</p></article>
    <article class="mini-stat"><h3>${soldCount}</h3><p>Проданные</p></article>
    <article class="mini-stat"><h3>${App.formatMoney(totalRevenue)}</h3><p>Сумма продаж</p></article>
  `;
}

function renderRecentItems() {
  if (!state.myItems.length) {
    els.recentItems.innerHTML = `
      <div class="panel section empty-state">
        <h3>Пока пусто</h3>
        <p>Добавьте первое объявление на странице продаж, и здесь появятся ваши последние товары.</p>
      </div>
    `;
    return;
  }

  const recent = [...state.myItems].slice(0, 6);
  els.recentItems.innerHTML = recent.map((item) => App.itemCard(item, { showSeller: false })).join("");
}

els.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    els.profileSaveBtn.disabled = true;
    const data = await App.api("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: els.profileFullName.value.trim(),
        phone: els.profilePhone.value.trim()
      })
    });

    state.user = data.user;
    renderHeader();
    fillProfileForm();
    App.mountTopbar({ active: "profile", user: state.user });
    App.setNotice(els.notice, "Контакты обновлены.", "success");
  } catch (error) {
    App.setNotice(els.notice, error.message || "Не удалось сохранить контакты.", "error");
  } finally {
    els.profileSaveBtn.disabled = false;
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
  App.mountTopbar({ active: "profile", user });

  const data = await App.api("/api/users/me/items");
  state.myItems = data.items || [];

  renderHeader();
  fillProfileForm();
  renderStats();
  renderRecentItems();
}

bootstrap().catch((error) => {
  App.setNotice(els.notice, error.message || "Не удалось загрузить профиль.", "error");
});
