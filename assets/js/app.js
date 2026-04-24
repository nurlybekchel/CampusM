const state = {
  user: null,
  items: []
};

const el = {
  userInfo: document.getElementById("userInfo"),
  showLoginBtn: document.getElementById("showLoginBtn"),
  showRegisterBtn: document.getElementById("showRegisterBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  authSection: document.getElementById("authSection"),
  loginTabBtn: document.getElementById("loginTabBtn"),
  registerTabBtn: document.getElementById("registerTabBtn"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  createItemSection: document.getElementById("createItemSection"),
  createItemForm: document.getElementById("createItemForm"),
  itemsGrid: document.getElementById("itemsGrid"),
  messageBox: document.getElementById("messageBox"),
  adminPanel: document.getElementById("adminPanel"),
  adminStats: document.getElementById("adminStats"),
  adminUsersList: document.getElementById("adminUsersList"),
  adminItemsList: document.getElementById("adminItemsList")
};

function showMessage(text, type = "success") {
  el.messageBox.textContent = text;
  el.messageBox.classList.remove("hidden", "success", "error");
  el.messageBox.classList.add(type);
  setTimeout(() => {
    el.messageBox.classList.add("hidden");
  }, 3200);
}

function api(url, options = {}) {
  return fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  }).then(async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Ошибка запроса");
    }
    return body;
  });
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function renderItems() {
  if (!state.items.length) {
    el.itemsGrid.innerHTML =
      '<div class="card"><p>Пока нет объявлений. Будь первым, кто что-то выставит.</p></div>';
    return;
  }

  el.itemsGrid.innerHTML = state.items
    .map((item) => {
      const canDelete =
        state.user && (state.user.role === "admin" || state.user.id === item.seller.id);
      return `
        <article class="item-card">
          ${
            item.imageUrl
              ? `<img class="item-cover" src="${item.imageUrl}" alt="${item.title}" />`
              : '<div class="item-cover"></div>'
          }
          <div class="item-content">
            <h4>${item.title}</h4>
            <p>${item.description}</p>
            <div class="item-meta">Продавец: ${item.seller.name}</div>
            <div class="item-meta">Опубликовано: ${formatDate(item.createdAt)}</div>
            <div class="item-price">${Number(item.price).toFixed(2)} ₽</div>
            ${
              canDelete
                ? `<div class="item-actions"><button class="btn btn-danger" data-delete-item="${item.id}">Удалить</button></div>`
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAuth() {
  const loggedIn = Boolean(state.user);
  el.showLoginBtn.classList.toggle("hidden", loggedIn);
  el.showRegisterBtn.classList.toggle("hidden", loggedIn);
  el.logoutBtn.classList.toggle("hidden", !loggedIn);
  el.createItemSection.classList.toggle("hidden", !loggedIn);
  el.userInfo.textContent = loggedIn
    ? `${state.user.fullName} (${state.user.role})`
    : "Гость";

  if (!loggedIn) {
    el.adminPanel.classList.add("hidden");
    return;
  }

  if (state.user.role === "admin") {
    el.adminPanel.classList.remove("hidden");
    loadAdminPanel();
  } else {
    el.adminPanel.classList.add("hidden");
  }
}

function openAuth(tab) {
  el.authSection.classList.remove("hidden");
  const loginActive = tab === "login";
  el.loginForm.classList.toggle("hidden", !loginActive);
  el.registerForm.classList.toggle("hidden", loginActive);
  el.loginTabBtn.classList.toggle("active", loginActive);
  el.registerTabBtn.classList.toggle("active", !loginActive);
}

function closeAuth() {
  el.authSection.classList.add("hidden");
}

async function loadMe() {
  const data = await api("/api/auth/me", { method: "GET" });
  state.user = data.user;
  renderAuth();
}

async function loadItems() {
  const data = await api("/api/items", { method: "GET" });
  state.items = data.items;
  renderItems();
}

async function loadAdminPanel() {
  const [stats, users, items] = await Promise.all([
    api("/api/admin/stats", { method: "GET" }),
    api("/api/admin/users", { method: "GET" }),
    api("/api/admin/items", { method: "GET" })
  ]);

  el.adminStats.innerHTML = `
    <span>Пользователей: ${stats.usersCount}</span>
    <span>Объявлений: ${stats.itemsCount}</span>
  `;

  el.adminUsersList.innerHTML = users.users
    .map(
      (user) =>
        `<li><strong>${user.fullName}</strong><br />${user.email} | ${user.role} | ${formatDate(
          user.createdAt
        )}</li>`
    )
    .join("");

  el.adminItemsList.innerHTML = items.items
    .map(
      (item) =>
        `<li><strong>${item.title}</strong><br />${Number(item.price).toFixed(
          2
        )} ₽ | ${item.seller_name}
        <br /><button class="btn btn-danger" data-admin-delete-item="${item.id}">Удалить</button></li>`
    )
    .join("");
}

el.showLoginBtn.addEventListener("click", () => openAuth("login"));
el.showRegisterBtn.addEventListener("click", () => openAuth("register"));
el.loginTabBtn.addEventListener("click", () => openAuth("login"));
el.registerTabBtn.addEventListener("click", () => openAuth("register"));

el.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(el.loginForm);
  try {
    await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    el.loginForm.reset();
    closeAuth();
    await loadMe();
    await loadItems();
    showMessage("Успешный вход.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

el.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(el.registerForm);
  try {
    await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        password: formData.get("password")
      })
    });
    el.registerForm.reset();
    closeAuth();
    await loadMe();
    showMessage("Регистрация прошла успешно.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

el.logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    state.user = null;
    renderAuth();
    showMessage("Вы вышли из аккаунта.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

el.createItemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(el.createItemForm);
  try {
    await api("/api/items", {
      method: "POST",
      body: JSON.stringify({
        title: formData.get("title"),
        description: formData.get("description"),
        price: formData.get("price"),
        imageUrl: formData.get("imageUrl")
      })
    });
    el.createItemForm.reset();
    await loadItems();
    if (state.user && state.user.role === "admin") {
      await loadAdminPanel();
    }
    showMessage("Объявление добавлено.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

document.addEventListener("click", async (event) => {
  const userDeleteId = event.target.getAttribute("data-delete-item");
  const adminDeleteId = event.target.getAttribute("data-admin-delete-item");
  const targetId = userDeleteId || adminDeleteId;

  if (!targetId) {
    return;
  }

  if (!window.confirm("Удалить это объявление?")) {
    return;
  }

  try {
    const url = adminDeleteId ? `/api/admin/items/${targetId}` : `/api/items/${targetId}`;
    await api(url, { method: "DELETE" });
    await loadItems();
    if (state.user && state.user.role === "admin") {
      await loadAdminPanel();
    }
    showMessage("Объявление удалено.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

async function bootstrap() {
  try {
    await loadMe();
    await loadItems();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

bootstrap();
