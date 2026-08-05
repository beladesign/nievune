(() => {
  const config = window.NIEVUNE_CONFIG || {};
  const grid = document.getElementById('productGrid');
  const resultCount = document.getElementById('resultCount');
  const searchInput = document.getElementById('globalSearchInput');
  const searchForm = document.getElementById('globalSearchForm');
  const sortSelect = document.getElementById('sortSelect');
  const activeFilterRow = document.getElementById('activeFilterRow');
  const activeFilterLabel = document.getElementById('activeFilterLabel');
  const modal = document.getElementById('productModal');
  const sidebar = document.querySelector('.catalog-sidebar');
  let products = [];
  let activeCategory = 'all';
  let activeSearch = '';
  let currentProduct = null;
  let notificationLayout = 'combined';
  let supabaseClient = null;

  if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

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
    activeCategory = 'all'; activeSearch = ''; searchInput.value = ''; syncFilterButtons(); render();
  });
  document.querySelector('[data-toggle-sidebar]')?.addEventListener('click', () => sidebar.classList.toggle('is-open'));
  document.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      syncFilterButtons(); render(); sidebar.classList.remove('is-open');
    });
  });
  document.querySelectorAll('[data-notification-layout]').forEach((button) => {
    button.addEventListener('click', () => {
      notificationLayout = button.dataset.notificationLayout;
      document.querySelectorAll('[data-notification-layout]').forEach((item) => item.classList.toggle('is-active', item === button));
      if (currentProduct) renderSelectedPreview({ type: 'notification-live', layout: notificationLayout });
    });
  });
  modal?.addEventListener('click', (event) => {
    if (event.target === modal || event.target.hasAttribute('data-close-modal')) modal.close();
  });

  async function loadProducts() {
    try {
      if (supabaseClient) {
        const { data, error } = await supabaseClient.from('products').select('*').eq('is_active', true).order('sort_order');
        if (error) throw error;
        products = data || [];
      } else {
        products = await (await fetch('products.local.json')).json();
      }
      updateCounts(); render();
    } catch (error) {
      console.error(error); grid.innerHTML = '<p class="empty-state">The catalog could not be loaded.</p>';
    }
  }

  function updateCounts() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const category = el.dataset.count;
      el.textContent = category === 'all' ? products.length : products.filter((p) => p.section === category).length;
    });
  }
  function syncFilterButtons() {
    document.querySelectorAll('[data-category]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.category === activeCategory));
  }
  function filteredProducts() {
    let items = [...products];
    if (activeCategory !== 'all') {
      if (activeCategory === 'minimalist') items = items.filter((p) => (p.category || '').toLowerCase().includes('minimalist'));
      else items = items.filter((p) => p.section === activeCategory);
    }
    if (activeSearch) items = items.filter((p) => [p.title,p.short_description,p.description,p.category,...(p.tags||[])].join(' ').toLowerCase().includes(activeSearch));
    const sort = sortSelect?.value || 'recommended';
    if (sort === 'price-asc') items.sort((a,b)=>Number(a.price)-Number(b.price));
    if (sort === 'price-desc') items.sort((a,b)=>Number(b.price)-Number(a.price));
    if (sort === 'name') items.sort((a,b)=>a.title.localeCompare(b.title));
    if (sort === 'recommended') items.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    return items;
  }
  function money(value, currency='USD') { return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(value||0)); }

  function notificationPreview(layout='separate', large=false) {
    const combined = `<div class="notification-card combined-card">
      <div class="notification-row"><span class="notification-icon follow">♡</span><div><small>LAST FOLLOW</small><strong>peachglow</strong></div></div>
      <hr>
      <div class="notification-row"><span class="notification-icon sub">☆</span><div><small>LAST SUB</small><strong>mintyspell</strong></div></div>
    </div>`;
    const separate = `<div class="notification-separate">
      <div class="notification-card single follow-card"><div class="notification-row"><span class="notification-icon follow">♡</span><div><small>LAST FOLLOW</small><strong>peachglow</strong></div></div></div>
      <div class="notification-card single sub-card"><div class="notification-row"><span class="notification-icon sub">☆</span><div><small>LAST SUB</small><strong>mintyspell</strong></div></div></div>
    </div>`;
    return `<div class="notification-stage ${large?'large':''}">${layout==='combined'?combined:separate}</div>`;
  }

  function chatLivePreview(large=false) {
    return `<div class="minimal-chat-live ${large?'large':''}">
      <article><b>LunaPixie</b><p>hi!!</p></article>
      <article><b>StarlitBunny <i>SUB</i> <i>TW</i></b><p>this design feels so delicate!</p></article>
      <article><b>PixelNova <i>MOD</i> <i>YT</i></b><p>it looks much better like this</p></article>
    </div>`;
  }

  function bundleLivePreview(large=false) {
    return `<div class="bundle-live ${large?'large':''}">${chatLivePreview(false)}${notificationPreview('separate',false)}</div>`;
  }

  function previewMarkup(product, large=false, override=null) {
    if (override?.type === 'notification-live') return notificationPreview(override.layout || 'combined', large);
    if (override?.type === 'chat-live') return chatLivePreview(large);
    if (override?.type === 'bundle-live') return bundleLivePreview(large);
    if (override?.type === 'image' && override.src) return `<img src="${override.src}" alt="${product.title} preview">`;
    if (product.preview_kind === 'zigzag-chat') return `<div class="zigzag-preview ${large?'large':''}"><article class="zig one"><b>LunaByte <i>SUB</i></b><span>this layout is so cute</span></article><article class="zig two"><b>NebulaTea <i>VIP</i></b><span>love the alternating cards</span></article><article class="zig three"><b>PixelMint <i>TW</i></b><span>hi chat!!</span></article></div>`;
    if (product.preview_kind === 'minimalist-notification') return notificationPreview('separate', large);
    if (product.preview_kind === 'minimalist-chat') return chatLivePreview(large);
    if (product.preview_kind === 'minimalist-bundle') return bundleLivePreview(large);
    if (product.preview_image) return `<img src="${product.preview_image}" alt="${product.title} preview">`;
    return '<div class="image-placeholder">Preview coming soon</div>';
  }

  function render() {
    const items = filteredProducts();
    resultCount.textContent = items.length;
    const filterParts=[];
    if(activeCategory!=='all') filterParts.push(labelForCategory(activeCategory));
    if(activeSearch) filterParts.push(`Search: “${activeSearch}”`);
    activeFilterRow.hidden = filterParts.length===0;
    activeFilterLabel.textContent = filterParts.join(' • ');
    if(!items.length){grid.innerHTML='<p class="empty-state">No products match this search.</p>';return;}
    grid.innerHTML=items.map(product=>{
      const bundle=product.section==='bundles';
      const discount=product.compare_at_price ? Math.round((1-Number(product.price)/Number(product.compare_at_price))*100) : 0;
      return `<article class="listing-card">
        <button class="listing-image" type="button" data-open-product="${product.id}" aria-label="View ${product.title}">
          ${previewMarkup(product)}
          <span class="listing-type">${product.badge||'DIGITAL PRODUCT'}</span>
          <span class="favorite-button" aria-hidden="true">♡</span>
          ${bundle?'<span class="bundle-ribbon">Best value</span>':''}
        </button>
        <div class="listing-info">
          <button class="listing-title" type="button" data-open-product="${product.id}">${product.title}</button>
          <p>Nievune</p>
          <div class="listing-tags"><span>Digital download</span>${product.category?.toLowerCase().includes('minimalist')?'<span>Minimalist</span>':''}</div>
          <div class="listing-price"><strong>${money(product.price,product.currency||'USD')}</strong>${product.compare_at_price?`<small>${money(product.compare_at_price,product.currency||'USD')}</small><em>${discount}% off</em>`:''}</div>
        </div>
      </article>`;
    }).join('');
    grid.querySelectorAll('[data-open-product]').forEach(btn=>btn.addEventListener('click',()=>openProduct(btn.dataset.openProduct)));
  }
  function labelForCategory(category){return ({'chat-widgets':'Chat widgets','notifications':'Notifications','bundles':'Bundles','minimalist':'Minimalist collection'})[category]||category;}
  function normalizeVideo(url){
    if(!url) return '';
    const v=url.trim();
    if(v.includes('youtube.com/watch?v=')){const id=new URL(v).searchParams.get('v');return `https://www.youtube.com/embed/${id}`;}
    if(v.includes('youtu.be/')) return `https://www.youtube.com/embed/${v.split('youtu.be/')[1].split(/[?&]/)[0]}`;
    return v;
  }

  function galleryItemsFor(product) {
    if (product.preview_kind === 'minimalist-notification') return [
      { label: 'Combined', type: 'notification-live', layout: 'combined' },
      { label: 'Separate', type: 'notification-live', layout: 'separate' },
      ...(product.preview_image ? [{ label: 'Overview', type: 'image', src: product.preview_image }] : [])
    ];
    if (product.preview_kind === 'minimalist-chat') return [
      { label: 'Live preview', type: 'chat-live' },
      ...(product.preview_image ? [{ label: 'Overview', type: 'image', src: product.preview_image }] : [])
    ];
    if (product.preview_kind === 'minimalist-bundle') return [
      { label: 'Bundle', type: 'bundle-live' },
      { label: 'Chat', type: 'chat-live' },
      { label: 'Notification', type: 'notification-live', layout: 'separate' },
      ...(product.preview_image ? [{ label: 'Overview', type: 'image', src: product.preview_image }] : [])
    ];
    return [{ label: 'Preview', type: 'default' }];
  }

  function renderSelectedPreview(item) {
    const preview = document.getElementById('modalPreview');
    preview.innerHTML = item.type === 'default' ? previewMarkup(currentProduct,true) : previewMarkup(currentProduct,true,item);
    document.querySelectorAll('.modal-thumbnail').forEach((button) => button.classList.toggle('is-active', button.dataset.previewIndex === String(item.index)));
  }

  function openProduct(id){
    const product=products.find(p=>p.id===id); if(!product)return;
    currentProduct=product;
    notificationLayout='combined';
    document.querySelectorAll('[data-notification-layout]').forEach((b)=>b.classList.toggle('is-active',b.dataset.notificationLayout==='combined'));
    document.getElementById('modalBadge').textContent=product.badge||'DIGITAL PRODUCT';
    document.getElementById('modalTitle').textContent=product.title;
    document.getElementById('modalPrice').textContent=money(product.price,product.currency||'USD');
    document.getElementById('modalCompare').textContent=product.compare_at_price?`${money(product.compare_at_price,product.currency||'USD')} separately`:'';
    document.getElementById('modalDescription').textContent=product.description||product.short_description||'';
    document.getElementById('modalFeatures').innerHTML=(product.features||[]).map(f=>`<li>${f}</li>`).join('');
    const layoutChoice=document.getElementById('modalLayoutChoice');
    layoutChoice.hidden=product.preview_kind!=='minimalist-notification';

    const items=galleryItemsFor(product).map((item,index)=>({...item,index}));
    const thumbs=document.getElementById('modalThumbnails');
    thumbs.innerHTML=items.map((item,index)=>`<button type="button" class="modal-thumbnail ${index===0?'is-active':''}" data-preview-index="${index}"><span>${item.label}</span></button>`).join('');
    thumbs.querySelectorAll('[data-preview-index]').forEach((button)=>button.addEventListener('click',()=>renderSelectedPreview(items[Number(button.dataset.previewIndex)])));
    renderSelectedPreview(items[0]);

    const video=normalizeVideo(product.video_embed);
    const videoEl=document.getElementById('modalVideo');
    videoEl.innerHTML=video?`<iframe src="${video}" title="${product.title} demo" allowfullscreen></iframe>`:'<span>Video coming soon</span>';
    const buy=document.getElementById('modalBuy');
    buy.href=product.purchase_url||'#';
    buy.textContent=product.purchase_url?'Buy now':'Checkout link will be added later';
    buy.classList.toggle('is-disabled',!product.purchase_url);
    if(product.purchase_url){buy.target='_blank';buy.rel='noopener';}else buy.removeAttribute('target');
    modal.showModal();
  }
  loadProducts();
})();