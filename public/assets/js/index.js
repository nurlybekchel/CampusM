const state = {
  user: null,
  items: [],
  categories: []
};

const els = {
  itemsGrid: document.getElementById("itemsGrid"),
  searchInput: document.getElementById("searchInput"),
  categorySelect: document.getElementById("categorySelect"),
  minInput: document.getElementById("minInput"),
  maxInput: document.getElementById("maxInput"),
  sortSelect: document.getElementById("sortSelect"),
  resetBtn: document.getElementById("resetBtn"),
  counters: document.getElementById("heroCounters")
};

function collectFilters() {
  const params = new URLSearchParams();
  const q = els.searchInput.value.trim();
  const category = els.categorySelect.value;
  const min = els.minInput.value.trim();
  const max = els.maxInput.value.trim();
  const sort = els.sortSelect.value;

  if (q) params.set("q", q);
  if (category && category !== "all") params.set("category", category);
  if (min) params.set("min", min);
  if (max) params.set("max", max);
  if (sort) params.set("sort", sort);
  return params.toString();
}

function renderItems() {
  if (!state.items.length) {
    els.itemsGrid.innerHTML = `
      <div class="panel section empty-state">
        <h3>Ничего не найдено</h3>
        <p>Попробуйте изменить фильтры, выбрать другую категорию или сбросить диапазон цены.</p>
      </div>
    `;
    return;
  }

  els.itemsGrid.innerHTML = state.items
    .map((item) => App.itemCard(item, { showManage: false, showDetails: true }))
    .join("");
}

function renderCounters() {
  const soldCount = state.items.filter((item) => item.status === "sold").length;
  const activeCount = state.items.length - soldCount;
  const avgPrice =
    state.items.length > 0
      ? Math.round(state.items.reduce((sum, item) => sum + Number(item.price), 0) / state.items.length)
      : 0;

  els.counters.innerHTML = `
    <article class="mini-stat"><h3>${state.items.length}</h3><p>Всего объявлений</p></article>
    <article class="mini-stat"><h3>${activeCount}</h3><p>Активные товары</p></article>
    <article class="mini-stat"><h3>${soldCount}</h3><p>Проданные товары</p></article>
    <article class="mini-stat"><h3>${App.formatMoney(avgPrice)}</h3><p>Средняя цена</p></article>
  `;
}

function fillCategories() {
  els.categorySelect.innerHTML = `<option value="all">Все категории</option>${state.categories
    .map((category) => `<option value="${App.escapeHtml(category)}">${App.escapeHtml(category)}</option>`)
    .join("")}`;
}

async function loadCategories() {
  const data = await App.api("/api/items/categories");
  state.categories = data.categories || [];
  fillCategories();
}

async function loadItems() {
  const query = collectFilters();
  const data = await App.api(`/api/items${query ? `?${query}` : ""}`);
  state.items = data.items || [];
  renderCounters();
  renderItems();
}

function bindEvents() {
  const run = () => loadItems().catch(console.error);
  ["input", "change"].forEach((evt) => {
    els.searchInput.addEventListener(evt, run);
    els.categorySelect.addEventListener(evt, run);
    els.minInput.addEventListener(evt, run);
    els.maxInput.addEventListener(evt, run);
    els.sortSelect.addEventListener(evt, run);
  });

  els.resetBtn.addEventListener("click", () => {
    els.searchInput.value = "";
    els.categorySelect.value = "all";
    els.minInput.value = "";
    els.maxInput.value = "";
    els.sortSelect.value = "newest";
    loadItems().catch(console.error);
  });
}

async function bootstrap() {
  state.user = await App.getMe();
  App.mountTopbar({ active: "home", user: state.user });
  bindEvents();
  await loadCategories();
  await loadItems();
}

bootstrap().catch(console.error);
