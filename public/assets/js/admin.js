const state = {
  user: null,
  users: [],
  items: [],
  disputes: []
};

const els = {
  notice: document.getElementById("notice"),
  stats: document.getElementById("stats"),
  usersBody: document.getElementById("usersBody"),
  itemsBody: document.getElementById("itemsBody"),
  disputesBody: document.getElementById("disputesBody"),
  refreshBtn: document.getElementById("refreshBtn")
};

function renderStats(stats) {
  els.stats.innerHTML = `
    <article class="mini-stat"><h3>${stats.usersCount}</h3><p>Всего пользователей</p></article>
    <article class="mini-stat"><h3>${stats.activeUsersCount}</h3><p>Активные аккаунты</p></article>
    <article class="mini-stat"><h3>${stats.itemsCount}</h3><p>Всего объявлений</p></article>
    <article class="mini-stat"><h3>${stats.soldItemsCount}</h3><p>Продано</p></article>
    <article class="mini-stat"><h3>${stats.disputesCount || 0}</h3><p>Открытые споры</p></article>
  `;
}

function renderUsers() {
  if (!state.users.length) {
    els.usersBody.innerHTML = "<tr><td colspan=\"8\">Пользователи не найдены.</td></tr>";
    return;
  }

  els.usersBody.innerHTML = state.users
    .map(
      (user) => `
      <tr>
        <td>${user.id}</td>
        <td>${App.escapeHtml(user.fullName)}</td>
        <td>${App.escapeHtml(user.email)}</td>
        <td>${user.role}</td>
        <td>${user.isActive ? "Да" : "Нет"}</td>
        <td>${user.listingsCount}</td>
        <td>${App.formatDate(user.createdAt)}</td>
        <td>
          <div class="item-actions">
            <button class="button secondary" data-toggle-role="${user.id}">
              ${user.role === "admin" ? "Сделать user" : "Сделать admin"}
            </button>
            <button class="button ${user.isActive ? "warning" : "primary"}" data-toggle-active="${user.id}">
              ${user.isActive ? "Отключить" : "Включить"}
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

function renderItems() {
  if (!state.items.length) {
    els.itemsBody.innerHTML = "<tr><td colspan=\"8\">Объявления не найдены.</td></tr>";
    return;
  }

  els.itemsBody.innerHTML = state.items
    .map(
      (item) => `
      <tr>
        <td>${item.id}</td>
        <td>${App.escapeHtml(item.title)}</td>
        <td>${App.escapeHtml(item.category)}</td>
        <td>${App.formatMoney(item.price)}</td>
        <td>${App.escapeHtml(item.seller.name)}</td>
        <td>${item.status}</td>
        <td>${App.formatDate(item.createdAt)}</td>
        <td><button class="button danger" data-delete-item="${item.id}">Удалить</button></td>
      </tr>
    `
    )
    .join("");
}

function renderDisputes() {
  if (!state.disputes.length) {
    els.disputesBody.innerHTML = "<tr><td colspan=\"7\">Открытых споров нет.</td></tr>";
    return;
  }

  els.disputesBody.innerHTML = state.disputes
    .map(
      (d) => `
      <tr>
        <td>${d.id}</td>
        <td>${App.escapeHtml(d.item?.title || "-")}</td>
        <td>${App.escapeHtml(d.buyer?.name || "-")}</td>
        <td>${App.escapeHtml(d.item?.seller?.name || "-")}</td>
        <td>${App.formatMoney(d.soldPrice)}</td>
        <td>${App.escapeHtml(d.disputeNote || "-")}</td>
        <td>${App.formatDateTime(d.disputeOpenedAt)}</td>
      </tr>
    `
    )
    .join("");
}

async function loadAll() {
  const [stats, users, items, disputes] = await Promise.all([
    App.api("/api/admin/stats"),
    App.api("/api/admin/users"),
    App.api("/api/admin/items"),
    App.api("/api/admin/disputes")
  ]);

  state.users = users.users || [];
  state.items = items.items || [];
  state.disputes = disputes.disputes || [];
  renderStats(stats);
  renderUsers();
  renderItems();
  renderDisputes();
}

els.refreshBtn.addEventListener("click", () => {
  loadAll()
    .then(() => App.setNotice(els.notice, "Данные обновлены.", "success"))
    .catch((error) => App.setNotice(els.notice, error.message, "error"));
});

document.addEventListener("click", async (event) => {
  const toggleRoleId = event.target.getAttribute("data-toggle-role");
  const toggleActiveId = event.target.getAttribute("data-toggle-active");
  const deleteItemId = event.target.getAttribute("data-delete-item");

  try {
    if (toggleRoleId) {
      const target = state.users.find((u) => String(u.id) === String(toggleRoleId));
      if (!target) return;

      await App.api(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: target.role === "admin" ? "user" : "admin",
          isActive: target.isActive
        })
      });

      await loadAll();
      App.setNotice(els.notice, "Роль пользователя обновлена.", "success");
    } else if (toggleActiveId) {
      const target = state.users.find((u) => String(u.id) === String(toggleActiveId));
      if (!target) return;

      await App.api(`/api/admin/users/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role: target.role,
          isActive: !target.isActive
        })
      });

      await loadAll();
      App.setNotice(els.notice, "Статус пользователя обновлен.", "success");
    } else if (deleteItemId) {
      const ok = window.confirm("Удалить объявление?");
      if (!ok) return;

      await App.api(`/api/admin/items/${deleteItemId}`, { method: "DELETE" });
      await loadAll();
      App.setNotice(els.notice, "Объявление удалено администратором.", "success");
    }
  } catch (error) {
    App.setNotice(els.notice, error.message, "error");
  }
});

async function bootstrap() {
  const user = await App.getMe();
  if (!user) {
    window.location.href = "/auth";
    return;
  }

  if (user.role !== "admin") {
    window.location.href = "/dashboard";
    return;
  }

  state.user = user;
  App.mountTopbar({ active: "admin", user });
  await loadAll();
}

bootstrap().catch(console.error);
