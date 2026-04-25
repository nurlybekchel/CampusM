const App = (() => {
  const moneyFormatter = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "KZT",
    maximumFractionDigits: 0
  });

  function formatMoney(value) {
    return moneyFormatter.format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  async function api(url, options = {}) {
    const config = {
      headers: { "Content-Type": "application/json" },
      ...options
    };
    const res = await fetch(url, config);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Ошибка запроса");
    return body;
  }

  function setNotice(el, text, type = "success") {
    if (!el) return;
    if (!text) {
      el.className = "notice hidden";
      el.textContent = "";
      return;
    }
    el.className = `notice ${type}`;
    el.textContent = text;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function itemCard(item, options = {}) {
    const showManage = Boolean(options.showManage);
    const showSeller = options.showSeller !== false;
    const showDetails = options.showDetails !== false;

    return `
      <article class="item-card">
        <a class="item-image-link" href="/item/${item.id}" aria-label="Открыть товар ${escapeHtml(item.title)}">
          ${
            item.imageUrl
              ? `<img class="item-cover" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" />`
              : '<div class="item-cover"></div>'
          }
        </a>
        <div class="item-body">
          <div class="item-top-row">
            <span class="badge ${item.status === "sold" ? "sold" : "active"}">
              ${item.status === "sold" ? "Продано" : "Активно"}
            </span>
            <div class="item-price">${formatMoney(item.price)}</div>
          </div>

          <h3 class="item-title">
            <a class="item-title-link" href="/item/${item.id}">${escapeHtml(item.title)}</a>
          </h3>

          <p class="item-desc">${escapeHtml(item.description)}</p>

          <div class="item-meta">
            <span>Категория: ${escapeHtml(item.category)}</span>
            <span>Локация: ${escapeHtml(item.dormLocation)}</span>
            ${showSeller ? `<span>Продавец: ${escapeHtml(item.seller?.name || "-")}</span>` : ""}
            <span>Обновлено: ${formatDate(item.updatedAt || item.createdAt)}</span>
          </div>

          <div class="item-actions">
            ${showDetails ? `<a class="button ghost button-link" href="/item/${item.id}">Подробнее</a>` : ""}
            ${
              showManage
                ? `
                  <button class="button secondary" data-edit-item="${item.id}" type="button">Редактировать</button>
                  <button class="button danger" data-delete-item="${item.id}" type="button">Удалить</button>
                `
                : ""
            }
          </div>
        </div>
      </article>
    `;
  }

  async function getMe() {
    const data = await api("/api/auth/me");
    return data.user;
  }

  const navIcons = {
    home: "🏠",
    about: "✨",
    support: "💬",
    dashboard: "📦",
    purchases: "🛍️",
    profile: "👤",
    checkout: "💳",
    admin: "⚙️",
    auth: "🔑"
  };

  function mountFooter(user) {
    let footer = document.getElementById("siteFooter");
    if (!footer) {
      footer = document.createElement("footer");
      footer.id = "siteFooter";
      footer.className = "site-footer";
      document.body.appendChild(footer);
    }

    const isLoggedIn = Boolean(user);
    const userLabel = isLoggedIn ? escapeHtml(user.fullName || user.email || "Пользователь") : "Гость";

    const quickLinks = [
      { href: "/", label: "Каталог" },
      { href: "/about", label: "О сервисе" },
      { href: "/support", label: "Помощь" }
    ];

    if (user && user.role !== "admin") {
      quickLinks.push({ href: "/dashboard", label: "Продажи" });
      quickLinks.push({ href: "/purchases", label: "Покупки" });
      quickLinks.push({ href: "/profile", label: "Профиль" });
    }
    if (!user) {
      quickLinks.push({ href: "/auth", label: "Вход" });
    }

    const nowYear = new Date().getFullYear();
    footer.innerHTML = `
      <div class="site-footer-inner">
        <div class="site-footer-brand block">
          <p class="site-footer-title">Campus Market</p>
          <p class="site-footer-text">Безопасные студенческие сделки с оплатой в тенге.</p>
          <p class="site-footer-text">Текущий пользователь: ${userLabel}</p>
        </div>

        <div class="site-footer-nav block">
          <p class="site-footer-caption">Навигация</p>
          <nav class="site-footer-links">
            ${quickLinks.map((link) => `<a href="${link.href}" class="site-footer-link">${link.label}</a>`).join("")}
          </nav>
        </div>

        <div class="site-footer-info block">
          <p class="site-footer-caption">Сделки и оплата</p>
          <ul class="site-footer-list">
            <li>Цены отображаются в KZT</li>
            <li>Покупка через страницу оплаты</li>
            <li>История заказов хранится в профиле</li>
          </ul>
        </div>

        <div class="site-footer-meta block">
          <p class="site-footer-caption">Контакты</p>
          <ul class="site-footer-list">
            <li>nurlybekjj00@gmail.com</li>
            <li>+7 (708) 122-60-29</li>
            <li>Пн-Вс: 09:00-22:00</li>
          </ul>
          <p class="site-footer-text">© ${nowYear} Campus Market</p>
          <p class="site-footer-text">Student marketplace platform</p>
        </div>
      </div>
    `;
  }

  function mountTopbar({ active = "home", user = null } = {}) {
    const root = document.getElementById("topbarMount");
    if (!root) return;

    const nav = [
      { id: "home", href: "/", title: "Каталог" },
      { id: "about", href: "/about", title: "О сервисе" },
      { id: "support", href: "/support", title: "Помощь" }
    ];

    if (user) {
      if (user.role === "admin") {
        nav.push({ id: "admin", href: "/admin", title: "Админ" });
      } else {
        nav.push({ id: "dashboard", href: "/dashboard", title: "Продажи" });
        nav.push({ id: "purchases", href: "/purchases", title: "Покупки" });
        nav.push({ id: "profile", href: "/profile", title: "Профиль" });
      }
    } else {
      nav.push({ id: "auth", href: "/auth", title: "Вход" });
    }

    root.innerHTML = `
      <header class="topbar">
        <div class="topbar-inner">
          <a href="/" class="brand" aria-label="На главную">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 72 72" role="img">
                <defs>
                  <linearGradient id="brandGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#7c5cfc" />
                    <stop offset="100%" stop-color="#c4b5fd" />
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="68" height="68" rx="22" fill="url(#brandGradient)" />
                <path d="M18 45V27h7l8 9 8-9h7v18h-7V37l-8 9-8-9v8z" fill="rgba(255,255,255,0.92)" />
              </svg>
            </span>
            <div>
              <p class="brand-title">Campus Market</p>
              <p class="brand-subtitle">Marketplace for student life</p>
            </div>
          </a>

          <nav class="nav-links">
            ${nav
              .map(
                (link) =>
                  `<a class="nav-link ${link.id === active ? "active" : ""}" href="${link.href}">${link.title}</a>`
              )
              .join("")}
            ${
              user
                ? `<button class="button ghost compact" id="logoutBtn" type="button">Выйти</button>`
                : ""
            }
          </nav>

          <button class="burger-btn" id="burgerBtn" aria-label="Открыть меню" aria-expanded="false" type="button">
            <span class="burger-line"></span>
            <span class="burger-line"></span>
            <span class="burger-line"></span>
          </button>
        </div>
      </header>

      <div class="mobile-menu" id="mobileMenu" role="dialog" aria-modal="true" aria-label="Навигация">
        <div class="mobile-menu-overlay" id="mobileMenuOverlay"></div>
        <div class="mobile-menu-panel">
          <div class="mobile-menu-header">
            <a href="/" class="brand mobile-brand" aria-label="На главную">
              <span class="brand-mark" aria-hidden="true">
                <svg viewBox="0 0 72 72" role="img">
                  <defs>
                    <linearGradient id="brandGradientMobile" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="#7c5cfc" />
                      <stop offset="100%" stop-color="#c4b5fd" />
                    </linearGradient>
                  </defs>
                  <rect x="2" y="2" width="68" height="68" rx="22" fill="url(#brandGradientMobile)" />
                  <path d="M18 45V27h7l8 9 8-9h7v18h-7V37l-8 9-8-9v8z" fill="rgba(255,255,255,0.92)" />
                </svg>
              </span>
              <div>
                <p class="brand-title">Campus Market</p>
                <p class="brand-subtitle">Marketplace for student life</p>
              </div>
            </a>
            <button class="mobile-menu-close" id="mobileMenuClose" aria-label="Закрыть меню" type="button">✕</button>
          </div>
          <nav class="mobile-nav-links">
            ${nav
              .map(
                (link) => `
              <a class="mobile-nav-link ${link.id === active ? "active" : ""}" href="${link.href}">
                <span class="mobile-nav-icon">${navIcons[link.id] || "•"}</span>
                ${link.title}
              </a>`
              )
              .join("")}
          </nav>
          ${
            user
              ? `<div class="mobile-menu-footer">
                  <button class="mobile-logout-btn" id="mobileLogoutBtn" type="button">Выйти из аккаунта</button>
                </div>`
              : ""
          }
        </div>
      </div>
    `;

    // Desktop logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await api("/api/auth/logout", { method: "POST" });
          window.location.href = "/auth";
        } catch (_error) {
          window.location.href = "/auth";
        }
      });
    }

    // Mobile logout
    const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
    if (mobileLogoutBtn) {
      mobileLogoutBtn.addEventListener("click", async () => {
        try {
          await api("/api/auth/logout", { method: "POST" });
          window.location.href = "/auth";
        } catch (_error) {
          window.location.href = "/auth";
        }
      });
    }

    // Burger logic
    const burgerBtn = document.getElementById("burgerBtn");
    const mobileMenu = document.getElementById("mobileMenu");
    const mobileMenuClose = document.getElementById("mobileMenuClose");
    const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");

    function openMenu() {
      burgerBtn.classList.add("open");
      mobileMenu.classList.add("open");
      burgerBtn.setAttribute("aria-expanded", "true");
      document.body.classList.add("menu-open");
    }

    function closeMenu() {
      burgerBtn.classList.remove("open");
      mobileMenu.classList.remove("open");
      burgerBtn.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    }

    function toggleMenu() {
      if (mobileMenu.classList.contains("open")) {
        closeMenu();
        return;
      }
      openMenu();
    }

    if (burgerBtn) burgerBtn.addEventListener("click", toggleMenu);
    if (mobileMenuClose) mobileMenuClose.addEventListener("click", closeMenu);
    if (mobileMenuOverlay) mobileMenuOverlay.addEventListener("click", closeMenu);

    mobileMenu.querySelectorAll(".mobile-nav-link").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && mobileMenu.classList.contains("open")) closeMenu();
    });

    mountFooter(user);
  }

  return {
    api,
    formatDate,
    formatDateTime,
    formatMoney,
    setNotice,
    escapeHtml,
    itemCard,
    getMe,
    mountTopbar
  };
})();
