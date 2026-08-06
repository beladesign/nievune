(() => {
  const cfg = window.NIEVUNE_CONFIG || {};
  const grid = document.getElementById('productGrid');
  const searchInput = document.getElementById('globalSearchInput');
  const searchForm = document.getElementById('globalSearchForm');
  const sortSelect = document.getElementById('sortSelect');
  const countEl = document.getElementById('resultCount');
  const activeFilterRow = document.getElementById('activeFilterRow');
  const activeFilterLabel = document.getElementById('activeFilterLabel');
  const modal = document.getElementById('productModal');
  const menuButton = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.getElementById('mobileMenu');

  let products = [];
  let activeCategory = 'all';
  let activeSearch = '';
  let supabaseClient = null;

  if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
    supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }

  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!open));
    mobileMenu.hidden = open;
  });

  document.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      document.querySelectorAll('[data-category]').forEach((item) => item.classList.toggle('is-active', item.dataset.category === activeCategory));
      render();
    });
  });

  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    activeSearch = searchInput.value.trim().toLowerCase();
    render();
  });

  searchInput?.addEventListener('input', () => {
    activeSearch = searchInput.value.trim().toLowerCase();
    render();
  });

  sortSelect?.addEventListener('change', render);
  document.querySelector('[data-clear-filter]')?.addEventListener('click', () => {
    activeCategory = 'all';
    activeSearch = '';
    searchInput.value = '';
    document.querySelectorAll('[data-category]').forEach((item) => item.classList.toggle('is-active', item.dataset.category === 'all'));
    render();
  });

  modal?.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close-modal]')) modal.close();
  });

  document.querySelectorAll('[data-notification-layout]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-notification-layout]').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      const productId = modal.dataset.productId;
      const product = products.find((item) => item.id === productId);
      if (product) setMainPreview(product, button.dataset.notificationLayout);
    });
  });

  function money(value, currency = 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));
  }

  function categoryMatch(product) {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'minimalist') return String(product.category).toLowerCase().includes('minimalist');
    return product.section === activeCategory;
  }

  function searchMatch(product) {
    if (!activeSearch) return true;
    return [product.title, product.short_description, product.description, product.category, ...(product.tags || [])]
      .join(' ').toLowerCase().includes(activeSearch);
  }

  function currentProducts() {
    const filtered = products.filter((product) => product.is_active !== false && categoryMatch(product) && searchMatch(product));
    const sort = sortSelect?.value || 'recommended';
    if (sort === 'price-asc') filtered.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === 'price-desc') filtered.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === 'name') filtered.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'recommended') filtered.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    return filtered;
  }

  function previewMarkup(product, mode = 'card', notificationLayout = 'combined') {
    const cls = mode === 'modal' ? 'listing-preview is-modal' : 'listing-preview';
    if (product.preview_kind === 'zigzag-chat') {
      return `<div class="${cls} zigzag-preview">
        <div class="zigzag-bubble left"><b>LunaByte <i>SUB</i></b><span>this layout is so cute!</span></div>
        <div class="zigzag-bubble right"><b>NebulaTea <i>VIP</i></b><span>love the alternating cards</span></div>
        <div class="zigzag-bubble left small"><b>PixelMint</b><span>hi chat!!</span></div>
      </div>`;
    }
    if (product.preview_kind === 'minimalist-notification') {
      if (notificationLayout === 'separate') {
        return `<div class="${cls} notification-preview separate">
          <div class="notice-card follow"><span>♡</span><div><small>LAST FOLLOW</small><b>peachglow</b></div></div>
          <div class="notice-card sub"><span>☆</span><div><small>LAST SUB</small><b>mintyspell</b></div></div>
        </div>`;
      }
      return `<div class="${cls} notification-preview combined">
        <div class="notice-row"><span>♡</span><div><small>LAST FOLLOW</small><b>peachglow</b></div></div>
        <hr>
        <div class="notice-row"><span>☆</span><div><small>LAST SUB</small><b>mintyspell</b></div></div>
      </div>`;
    }
    if (product.preview_kind === 'minimalist-bundle') {
      return `<div class="${cls} bundle-preview">
        <div class="bundle-chat"><b>Moonberry <i>SUB</i></b><span>everything matches now ✦</span></div>
        <div class="bundle-notice"><span>♡</span><div><small>LAST FOLLOW</small><b>peachglow</b></div></div>
      </div>`;
    }
    if (product.preview_image) {
      return `<div class="${cls} image-preview"><img src="${product.preview_image}" alt="${product.title} preview"></div>`;
    }
    return `<div class="${cls} placeholder-preview">Preview coming soon</div>`;
  }

  function render() {
    const items = currentProducts();
    countEl.textContent = String(items.length);
    activeFilterRow.hidden = activeCategory === 'all' && !activeSearch;
    activeFilterLabel.textContent = activeSearch ? `Search: ${activeSearch}` : activeCategory.replace('-', ' ');

    document.querySelectorAll('[data-count]').forEach((el) => {
      const cat = el.dataset.count;
      const total = products.filter((p) => p.is_active !== false && (cat === 'all' || p.section === cat)).length;
      el.textContent = String(total);
    });

    if (!items.length) {
      grid.innerHTML = '<div class="empty-results"><h3>No products found</h3><p>Try another search or category.</p></div>';
      return;
    }

    grid.innerHTML = items.map((product) => {
      const discount = product.compare_at_price ? Math.round((1 - Number(product.price) / Number(product.compare_at_price)) * 100) : 0;
      return `<article class="market-product-card" data-product-id="${product.id}">
        <button class="product-image-button" type="button" aria-label="Open ${product.title}">
          ${previewMarkup(product)}
          <span class="favorite-button" aria-hidden="true">♡</span>
          ${discount > 0 ? `<span class="discount-chip">${discount}% off</span>` : ''}
        </button>
        <div class="listing-copy">
          <p class="listing-category">${product.category || 'Nievune'}</p>
          <h3>${product.title}</h3>
          <p class="listing-description">${product.short_description || ''}</p>
          <div class="listing-rating">★★★★★ <span>New</span></div>
          <div class="listing-price">
            <strong>${money(product.price, product.currency || cfg.currency || 'USD')}</strong>
            ${product.compare_at_price ? `<small>${money(product.compare_at_price, product.currency || cfg.currency || 'USD')}</small>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');

    grid.querySelectorAll('.market-product-card').forEach((card) => {
      card.querySelector('.product-image-button').addEventListener('click', () => {
        const product = products.find((item) => item.id === card.dataset.productId);
        if (product) openProduct(product);
      });
      card.querySelector('.listing-copy').addEventListener('click', () => {
        const product = products.find((item) => item.id === card.dataset.productId);
        if (product) openProduct(product);
      });
    });
  }

  function setMainPreview(product, notificationLayout = 'combined') {
    document.getElementById('modalPreview').innerHTML = previewMarkup(product, 'modal', notificationLayout);
  }

  function openProduct(product) {
    modal.dataset.productId = product.id;
    document.getElementById('modalBadge').textContent = product.badge || 'DIGITAL PRODUCT';
    document.getElementById('modalTitle').textContent = product.title;
    document.getElementById('modalPrice').textContent = money(product.price, product.currency || cfg.currency || 'USD');
    document.getElementById('modalCompare').textContent = product.compare_at_price ? `${money(product.compare_at_price, product.currency || cfg.currency || 'USD')} separately` : '';
    document.getElementById('modalDescription').textContent = product.description || product.short_description || '';
    document.getElementById('modalFeatures').innerHTML = (product.features || []).map((feature) => `<li>${feature}</li>`).join('');

    const layoutChoice = document.getElementById('modalLayoutChoice');
    layoutChoice.hidden = product.preview_kind !== 'minimalist-notification';
    document.querySelectorAll('[data-notification-layout]').forEach((item) => item.classList.toggle('is-active', item.dataset.notificationLayout === 'combined'));
    setMainPreview(product, 'combined');

    const thumbs = document.getElementById('modalThumbnails');
    thumbs.innerHTML = `<button type="button" class="is-active">${previewMarkup(product)}</button>`;

    const video = document.getElementById('modalVideo');
    if (product.video_embed) {
      video.innerHTML = `<iframe src="${normalizeVideo(product.video_embed)}" title="${product.title} video" allowfullscreen loading="lazy"></iframe>`;
    } else {
      video.innerHTML = '<span>Video coming soon</span>';
    }

    const buy = document.getElementById('modalBuy');
    if (product.purchase_url) {
      buy.href = product.purchase_url;
      buy.target = '_blank';
      buy.rel = 'noopener';
      buy.textContent = 'Buy now';
      buy.classList.remove('is-disabled');
    } else {
      buy.href = '#';
      buy.textContent = 'Checkout link will be added later';
      buy.classList.add('is-disabled');
      buy.removeAttribute('target');
    }
    modal.showModal();
  }

  function normalizeVideo(url) {
    try {
      if (url.includes('youtube.com/watch')) return `https://www.youtube.com/embed/${new URL(url).searchParams.get('v')}`;
      if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1].split(/[?&]/)[0]}`;
    } catch (_) {}
    return url;
  }

  async function loadProducts() {
    try {
      if (supabaseClient) {
        const { data, error } = await supabaseClient.from('products').select('*').eq('is_active', true).order('sort_order');
        if (error) throw error;
        products = data || [];
      } else {
        const response = await fetch('products.local.json', { cache: 'no-store' });
        products = await response.json();
      }
      render();
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<div class="empty-results"><h3>Unable to load products</h3><p>Check the site files and try again.</p></div>';
    }
  }

  loadProducts();
})();
