/* Nievune storefront — v6
   Catalog, search, filters, cart, product views and customer-account favorites. */
(() => {
  const config = window.NIEVUNE_CONFIG || {};
  const CART_KEY = 'nievune.cart.v1';
  const LOCAL_PRODUCTS_KEY = 'nievune.products.v1';

  const grid = document.getElementById('productGrid');
  const resultCount = document.getElementById('resultCount');
  const searchInput = document.getElementById('globalSearchInput');
  const searchForm = document.getElementById('globalSearchForm');
  const sortSelect = document.getElementById('sortSelect');
  const activeFilterRow = document.getElementById('activeFilterRow');
  const activeFilterLabel = document.getElementById('activeFilterLabel');
  const modal = document.getElementById('productModal');
  const sidebar = document.querySelector('.catalog-sidebar');
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const toastStack = document.getElementById('toastStack');

  let products = [];
  let activeCategory = 'all';
  let activeSearch = '';
  let currentProduct = null;
  let modalQty = 1;
  let notificationLayout = 'combined';
  let supabaseClient = null;

  let cart = readStore(CART_KEY, []);
  let favorites = new Set(window.NievuneAuth?.getFavorites?.() || []);

  function readStore(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v ?? fallback; }
    catch { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage disabled */ }
  }
  function money(value, currency) {
    const number = Number(value || 0);
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || config.currency || 'USD' }).format(number); }
    catch { return `$${number.toFixed(2)}`; }
  }
  function toast(message, kind) {
    const el = document.createElement('div');
    el.className = `toast${kind ? ` ${kind}` : ''}`;
    el.textContent = message;
    toastStack.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  supabaseClient = window.NievuneAuth?.getClient?.() || null;
  if (!supabaseClient && config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'nievune-auth-session' },
    });
  }

  /* ---------------- data ---------------- */
  async function loadProducts() {
    grid.innerHTML = '<p class="empty-state">Loading products…</p>';
    try {
      if (supabaseClient) {
        const { data, error } = await supabaseClient.from('products').select('*').eq('is_active', true).order('sort_order');
        if (error) throw error;
        products = data || [];
      } else {
        const local = readStore(LOCAL_PRODUCTS_KEY, null);
        products = local && local.length ? local : await (await fetch('products.local.json')).json();
        products = products.filter((p) => p.is_active !== false);
      }
      products.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
      updateCounts();
      render();
      openFromHash();
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<p class="empty-state">The catalog could not be loaded. Please refresh the page.</p>';
    }
  }

  /* ---------------- filters ---------------- */
  function updateCounts() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const category = el.dataset.count;
      el.textContent = category === 'all'
        ? products.length
        : category === 'favorites'
          ? products.filter((p) => favorites.has(p.id)).length
          : products.filter((p) => p.section === category).length;
    });
    const count = document.getElementById('shopProductCount');
    if (count) count.textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;
  }
  function syncFilterButtons() {
    document.querySelectorAll('[data-category]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.category === activeCategory));
  }
  function labelForCategory(category) {
    return ({ 'chat-widgets': 'Chat widgets', notifications: 'Notifications', bundles: 'Bundles', minimalist: 'Minimalist collection', favorites: 'Favorites' })[category] || category;
  }
  function filteredProducts() {
    let items = [...products];
    if (activeCategory === 'minimalist') items = items.filter((p) => (p.category || '').toLowerCase().includes('minimalist'));
    else if (activeCategory === 'favorites') items = items.filter((p) => favorites.has(p.id));
    else if (activeCategory !== 'all') items = items.filter((p) => p.section === activeCategory);

    if (activeSearch) {
      items = items.filter((p) => [p.title, p.short_description, p.description, p.category, ...(p.tags || [])]
        .join(' ').toLowerCase().includes(activeSearch));
    }
    const sort = sortSelect?.value || 'recommended';
    if (sort === 'price-asc') items.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price-desc') items.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'name') items.sort((a, b) => String(a.title).localeCompare(String(b.title)));
    return items;
  }

  /* ---------------- previews ---------------- */
  function notificationPreview(layout = 'combined', large = false) {
    const combined = `<div class="notification-card combined-card">
      <div class="notification-row"><span class="notification-icon follow">♡</span><div><small>LAST FOLLOW</small><strong>peachglow</strong></div></div>
      <hr>
      <div class="notification-row"><span class="notification-icon sub">☆</span><div><small>LAST SUB</small><strong>mintyspell</strong></div></div>
    </div>`;
    const separate = `<div class="notification-separate">
      <div class="notification-card single follow-card"><div class="notification-row"><span class="notification-icon follow">♡</span><div><small>LAST FOLLOW</small><strong>peachglow</strong></div></div></div>
      <div class="notification-card single sub-card"><div class="notification-row"><span class="notification-icon sub">☆</span><div><small>LAST SUB</small><strong>mintyspell</strong></div></div></div>
    </div>`;
    return `<div class="notification-stage ${large ? 'large' : ''}">${layout === 'combined' ? combined : separate}</div>`;
  }
  function chatLivePreview(large = false) {
    return `<div class="minimal-chat-live ${large ? 'large' : ''}">
      <article><b>LunaPixie</b><p>hi!!</p></article>
      <article><b>StarlitBunny <i>SUB</i> <i>TW</i></b><p>this design feels so delicate!</p></article>
      <article><b>PixelNova <i>MOD</i> <i>YT</i></b><p>it looks much better like this</p></article>
    </div>`;
  }
  function zigzagPreview(large = false) {
    return `<div class="zigzag-preview ${large ? 'large' : ''}">
      <article class="zig one"><b>LunaByte <i>SUB</i></b><span>this layout is so cute</span></article>
      <article class="zig two"><b>NebulaTea <i>VIP</i></b><span>love the alternating cards</span></article>
      <article class="zig three"><b>PixelMint <i>TW</i></b><span>hi chat!!</span></article>
    </div>`;
  }
  function bundleLivePreview(large = false) {
    return `<div class="bundle-live ${large ? 'large' : ''}">${chatLivePreview(false)}${notificationPreview('separate', false)}</div>`;
  }
  function previewMarkup(product, large = false, override = null) {
    if (override?.type === 'notification-live') return notificationPreview(override.layout || 'combined', large);
    if (override?.type === 'chat-live') return chatLivePreview(large);
    if (override?.type === 'zigzag-live') return zigzagPreview(large);
    if (override?.type === 'bundle-live') return bundleLivePreview(large);
    if (override?.type === 'image' && override.src) return `<img src="${escapeHtml(override.src)}" alt="${escapeHtml(product.title)} preview">`;
    if (product.preview_kind === 'zigzag-chat') return zigzagPreview(large);
    if (product.preview_kind === 'minimalist-notification') return notificationPreview('separate', large);
    if (product.preview_kind === 'minimalist-chat') return chatLivePreview(large);
    if (product.preview_kind === 'minimalist-bundle') return bundleLivePreview(large);
    if (product.preview_image) return `<img src="${escapeHtml(product.preview_image)}" alt="${escapeHtml(product.title)} preview">`;
    return '<div class="image-placeholder">Preview coming soon</div>';
  }
  function galleryItemsFor(product) {
    const overview = product.preview_image ? [{ label: 'Overview', type: 'image', src: product.preview_image }] : [];
    if (product.preview_kind === 'minimalist-notification') return [
      { label: 'Combined', type: 'notification-live', layout: 'combined' },
      { label: 'Separate', type: 'notification-live', layout: 'separate' },
      ...overview,
    ];
    if (product.preview_kind === 'minimalist-chat') return [{ label: 'Live preview', type: 'chat-live' }, ...overview];
    if (product.preview_kind === 'zigzag-chat') return [{ label: 'Live preview', type: 'zigzag-live' }, ...overview];
    if (product.preview_kind === 'minimalist-bundle') return [
      { label: 'Bundle', type: 'bundle-live' },
      { label: 'Chat', type: 'chat-live' },
      { label: 'Notification', type: 'notification-live', layout: 'separate' },
      ...overview,
    ];
    return [{ label: 'Preview', type: 'default' }, ...overview];
  }

  /* ---------------- catalog render ---------------- */
  function render() {
    const items = filteredProducts();
    resultCount.textContent = items.length;
    const filterParts = [];
    if (activeCategory !== 'all') filterParts.push(labelForCategory(activeCategory));
    if (activeSearch) filterParts.push(`Search: “${activeSearch}”`);
    activeFilterRow.hidden = filterParts.length === 0;
    activeFilterLabel.textContent = filterParts.join(' • ');

    if (!items.length) {
      grid.innerHTML = `<p class="empty-state">${activeCategory === 'favorites' ? 'You have no favorites yet. Tap ♡ on a product to save it.' : 'No products match this search.'}</p>`;
      return;
    }
    grid.innerHTML = items.map((product) => {
      const bundle = product.section === 'bundles';
      const discount = product.compare_at_price ? Math.round((1 - Number(product.price) / Number(product.compare_at_price)) * 100) : 0;
      const inCart = cart.some((line) => line.id === product.id);
      return `<article class="listing-card">
        <button class="listing-image" type="button" data-open-product="${escapeHtml(product.id)}" aria-label="View ${escapeHtml(product.title)}">
          ${previewMarkup(product)}
          <span class="listing-type">${escapeHtml(product.badge || 'DIGITAL PRODUCT')}</span>
          ${bundle ? '<span class="bundle-ribbon">Best value</span>' : ''}
        </button>
        <button class="favorite-button ${favorites.has(product.id) ? 'is-active' : ''}" type="button" data-favorite="${escapeHtml(product.id)}" aria-label="${favorites.has(product.id) ? 'Remove from favorites' : 'Add to favorites'}">${favorites.has(product.id) ? '♥' : '♡'}</button>
        <div class="listing-info">
          <button class="listing-title" type="button" data-open-product="${escapeHtml(product.id)}">${escapeHtml(product.title)}</button>
          <p>${escapeHtml(product.short_description || 'Nievune')}</p>
          <div class="listing-tags"><span>Digital download</span>${(product.category || '').toLowerCase().includes('minimalist') ? '<span>Minimalist</span>' : ''}</div>
          <div class="listing-price"><strong>${money(product.price, product.currency)}</strong>${product.compare_at_price ? `<small>${money(product.compare_at_price, product.currency)}</small><em>${discount}% off</em>` : ''}</div>
          <div class="listing-actions">
            <button class="add-cart-button ${inCart ? 'is-in-cart' : ''}" type="button" data-add-cart="${escapeHtml(product.id)}">${inCart ? 'In cart ✓' : 'Add to cart'}</button>
            <button class="ghost-button" type="button" data-open-product="${escapeHtml(product.id)}">Details</button>
          </div>
        </div>
      </article>`;
    }).join('');

    grid.querySelectorAll('[data-open-product]').forEach((btn) => btn.addEventListener('click', () => openProduct(btn.dataset.openProduct)));
    grid.querySelectorAll('[data-add-cart]').forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.addCart, 1)));
    grid.querySelectorAll('[data-favorite]').forEach((btn) => btn.addEventListener('click', () => toggleFavorite(btn.dataset.favorite)));
  }

  /* ---------------- favorites ---------------- */
  async function toggleFavorite(id) {
    if (!window.NievuneAuth?.getUser?.()) {
      window.NievuneAuth?.open?.('signin', 'Sign in to save favorites and access them on every device.');
      return;
    }
    await window.NievuneAuth.toggleFavorite(id);
  }

  /* ---------------- cart ---------------- */
  function cartQuantity() { return cart.reduce((sum, line) => sum + line.qty, 0); }
  function cartTotals() {
    let total = 0;
    let compare = 0;
    cart.forEach((line) => {
      const product = products.find((p) => p.id === line.id);
      if (!product) return;
      total += Number(product.price) * line.qty;
      compare += Number(product.compare_at_price || product.price) * line.qty;
    });
    return { total, savings: Math.max(0, compare - total) };
  }
  function addToCart(id, qty) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    const line = cart.find((item) => item.id === id);
    if (line) line.qty += qty; else cart.push({ id, qty });
    persistCart();
    toast(`${product.title} added to cart`);
    openCart();
  }
  function setQty(id, qty) {
    const line = cart.find((item) => item.id === id);
    if (!line) return;
    line.qty = qty;
    if (line.qty <= 0) cart = cart.filter((item) => item.id !== id);
    persistCart();
  }
  function persistCart() {
    writeStore(CART_KEY, cart);
    updateBadges();
    renderCart();
    render();
  }
  function updateBadges() {
    const cartCount = document.getElementById('cartCount');
    const favCount = document.getElementById('favoritesCount');
    const quantity = cartQuantity();
    cartCount.textContent = quantity;
    cartCount.hidden = quantity === 0;
    favCount.textContent = favorites.size;
    favCount.hidden = favorites.size === 0;
  }
  function renderCart() {
    const container = document.getElementById('cartItems');
    const foot = document.getElementById('cartFoot');
    if (!cart.length) {
      container.innerHTML = '<p class="cart-empty">Your cart is empty.<br>Add a widget to get started.</p>';
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    container.innerHTML = cart.map((line) => {
      const product = products.find((p) => p.id === line.id);
      if (!product) return '';
      return `<div class="cart-item">
        <div class="cart-item-copy">
          <strong>${escapeHtml(product.title)}</strong>
          <small>${escapeHtml(product.badge || 'Digital product')}</small>
          <div class="qty-control" style="margin-top:8px">
            <button type="button" data-cart-qty="${escapeHtml(product.id)}" data-delta="-1" aria-label="Decrease">−</button>
            <span>${line.qty}</span>
            <button type="button" data-cart-qty="${escapeHtml(product.id)}" data-delta="1" aria-label="Increase">+</button>
          </div>
          <button class="cart-remove" type="button" data-cart-remove="${escapeHtml(product.id)}">Remove</button>
        </div>
        <span class="cart-item-price">${money(Number(product.price) * line.qty, product.currency)}</span>
      </div>`;
    }).join('');

    const { total, savings } = cartTotals();
    document.getElementById('cartItemsTotal').textContent = cartQuantity();
    document.getElementById('cartSavings').textContent = money(savings);
    document.getElementById('cartTotal').textContent = money(total);

    container.querySelectorAll('[data-cart-qty]').forEach((btn) => btn.addEventListener('click', () => {
      const line = cart.find((item) => item.id === btn.dataset.cartQty);
      if (line) setQty(line.id, line.qty + Number(btn.dataset.delta));
    }));
    container.querySelectorAll('[data-cart-remove]').forEach((btn) => btn.addEventListener('click', () => setQty(btn.dataset.cartRemove, 0)));
  }
  function openCart() {
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }
  function closeCart() {
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }
  function checkout() {
    if (!cart.length) return;
    const lines = cart.map((line) => ({ line, product: products.find((p) => p.id === line.id) })).filter((entry) => entry.product);
    const ready = lines.filter((entry) => entry.product.purchase_url);
    const pending = lines.filter((entry) => !entry.product.purchase_url);

    ready.forEach((entry, index) => {
      setTimeout(() => window.open(entry.product.purchase_url, '_blank', 'noopener'), index * 250);
    });
    if (ready.length) toast(`Opening ${ready.length} payment link${ready.length === 1 ? '' : 's'}…`);
    if (pending.length) {
      const summary = lines.map((entry) => `${entry.line.qty}x ${entry.product.title} — ${money(Number(entry.product.price) * entry.line.qty, entry.product.currency)}`).join('\n');
      const total = money(cartTotals().total);
      navigator.clipboard?.writeText(`Nievune order\n${summary}\nTotal: ${total}`).catch(() => {});
      toast(`${pending.length} item(s) without payment link — order summary copied`, 'error');
    }
  }

  /* ---------------- product modal ---------------- */
  function renderSelectedPreview(item) {
    const preview = document.getElementById('modalPreview');
    preview.innerHTML = item.type === 'default' ? previewMarkup(currentProduct, true) : previewMarkup(currentProduct, true, item);
    document.querySelectorAll('.modal-thumbnail').forEach((button) => button.classList.toggle('is-active', button.dataset.previewIndex === String(item.index)));
  }
  function normalizeVideo(url) {
    if (!url) return '';
    const value = String(url).trim();
    if (value.includes('youtube.com/watch?v=')) { try { return `https://www.youtube.com/embed/${new URL(value).searchParams.get('v')}`; } catch { return value; } }
    if (value.includes('youtu.be/')) return `https://www.youtube.com/embed/${value.split('youtu.be/')[1].split(/[?&]/)[0]}`;
    return value;
  }
  function updateModalQty() { document.getElementById('modalQty').textContent = modalQty; }

  function openProduct(id) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    currentProduct = product;
    modalQty = 1;
    updateModalQty();
    notificationLayout = 'combined';
    document.querySelectorAll('[data-notification-layout]').forEach((b) => b.classList.toggle('is-active', b.dataset.notificationLayout === 'combined'));
    document.getElementById('modalBadge').textContent = product.badge || 'DIGITAL PRODUCT';
    document.getElementById('modalTitle').textContent = product.title;
    document.getElementById('modalPrice').textContent = money(product.price, product.currency);
    document.getElementById('modalCompare').textContent = product.compare_at_price ? money(product.compare_at_price, product.currency) : '';
    document.getElementById('modalDescription').textContent = product.description || product.short_description || '';
    document.getElementById('modalFeatures').innerHTML = (product.features || []).map((f) => `<li>${escapeHtml(f)}</li>`).join('');
    document.getElementById('modalLayoutChoice').hidden = product.preview_kind !== 'minimalist-notification';

    const items = galleryItemsFor(product).map((item, index) => ({ ...item, index }));
    const thumbs = document.getElementById('modalThumbnails');
    thumbs.innerHTML = items.map((item, index) => `<button type="button" class="modal-thumbnail ${index === 0 ? 'is-active' : ''}" data-preview-index="${index}"><span>${escapeHtml(item.label)}</span></button>`).join('');
    thumbs.querySelectorAll('[data-preview-index]').forEach((button) => button.addEventListener('click', () => renderSelectedPreview(items[Number(button.dataset.previewIndex)])));
    renderSelectedPreview(items[0]);

    const video = normalizeVideo(product.video_embed);
    document.getElementById('modalVideo').innerHTML = video
      ? `<iframe src="${escapeHtml(video)}" title="${escapeHtml(product.title)} demo" allowfullscreen loading="lazy"></iframe>`
      : '<span>Video coming soon</span>';

    const buy = document.getElementById('modalBuy');
    buy.href = product.purchase_url || '#';
    buy.textContent = product.purchase_url ? 'Buy now' : 'Payment link coming soon';
    buy.classList.toggle('is-disabled', !product.purchase_url);
    if (product.purchase_url) { buy.target = '_blank'; buy.rel = 'noopener'; } else buy.removeAttribute('target');

    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
    history.replaceState(null, '', `#product=${product.slug || product.id}`);
  }
  function openFromHash() {
    const match = location.hash.match(/#product=(.+)/);
    if (!match) return;
    const key = decodeURIComponent(match[1]);
    const product = products.find((p) => p.slug === key || p.id === key);
    if (product) openProduct(product.id);
  }

  /* ---------------- events ---------------- */
  document.querySelector('[data-menu-toggle]')?.addEventListener('click', (event) => {
    const menu = document.getElementById('mobileMenu');
    const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
    event.currentTarget.setAttribute('aria-expanded', String(!expanded));
    menu.hidden = expanded;
  });
  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    activeSearch = searchInput.value.trim().toLowerCase();
    render();
    document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
  });
  searchInput?.addEventListener('input', () => { activeSearch = searchInput.value.trim().toLowerCase(); render(); });
  sortSelect?.addEventListener('change', render);
  document.querySelector('[data-clear-filter]')?.addEventListener('click', () => {
    activeCategory = 'all'; activeSearch = ''; if (searchInput) searchInput.value = '';
    syncFilterButtons(); render();
  });
  document.querySelector('[data-toggle-sidebar]')?.addEventListener('click', () => sidebar.classList.toggle('is-open'));
  document.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.category === 'favorites' && !window.NievuneAuth?.getUser?.()) {
        window.NievuneAuth?.open?.('signin', 'Sign in to open your saved favorites.');
        return;
      }
      activeCategory = button.dataset.category;
      syncFilterButtons(); render(); sidebar.classList.remove('is-open');
      document.getElementById('mobileMenu').hidden = true;
    });
  });
  document.querySelectorAll('[data-notification-layout]').forEach((button) => {
    button.addEventListener('click', () => {
      notificationLayout = button.dataset.notificationLayout;
      document.querySelectorAll('[data-notification-layout]').forEach((item) => item.classList.toggle('is-active', item === button));
      if (currentProduct) renderSelectedPreview({ type: 'notification-live', layout: notificationLayout, index: notificationLayout === 'combined' ? 0 : 1 });
    });
  });
  document.querySelectorAll('[data-qty]').forEach((button) => button.addEventListener('click', () => {
    modalQty = Math.max(1, modalQty + Number(button.dataset.qty));
    updateModalQty();
  }));
  document.getElementById('modalAddToCart')?.addEventListener('click', () => {
    if (!currentProduct) return;
    addToCart(currentProduct.id, modalQty);
    modal.close?.();
  });
  modal?.addEventListener('click', (event) => {
    if (event.target === modal || event.target.hasAttribute('data-close-modal')) modal.close();
  });
  modal?.addEventListener('close', () => { history.replaceState(null, '', location.pathname); });
  document.getElementById('cartButton')?.addEventListener('click', openCart);
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  backdrop?.addEventListener('click', closeCart);
  document.getElementById('checkoutButton')?.addEventListener('click', checkout);
  document.getElementById('clearCartButton')?.addEventListener('click', () => { cart = []; persistCart(); toast('Cart cleared'); });
  document.getElementById('favoritesButton')?.addEventListener('click', () => {
    if (!window.NievuneAuth?.getUser?.()) {
      window.NievuneAuth?.open?.('signin', 'Sign in to open your saved favorites.');
      return;
    }
    activeCategory = 'favorites'; syncFilterButtons(); render();
    document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCart(); });
  window.addEventListener('hashchange', openFromHash);
  window.addEventListener('nievune:favoriteschange', (event) => {
    favorites = new Set(event.detail?.favorites || []);
    updateCounts();
    updateBadges();
    render();
  });
  window.addEventListener('nievune:authchange', (event) => {
    if (!event.detail?.user && activeCategory === 'favorites') activeCategory = 'all';
    favorites = new Set(window.NievuneAuth?.getFavorites?.() || []);
    syncFilterButtons();
    updateCounts();
    updateBadges();
    render();
  });

  updateBadges();
  renderCart();
  loadProducts();
})();
