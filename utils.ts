/* Nievune product manager — v5
   Works in two modes:
   - Local mode (no cloud keys): products persist in this browser and can be exported.
   - Cloud mode (Supabase keys in config.js): owner signs in and edits the live database. */
(() => {
  const config = window.NIEVUNE_CONFIG || {};
  const LOCAL_PRODUCTS_KEY = 'nievune.products.v1';

  const banner = document.getElementById('modeBanner');
  const authCard = document.getElementById('authCard');
  const editorCard = document.getElementById('editorCard');
  const form = document.getElementById('productForm');
  const rows = document.getElementById('productRows');
  const listHint = document.getElementById('listHint');
  const editorTitle = document.getElementById('editorTitle');
  const toastStack = document.getElementById('toastStack');

  let supabaseClient = null;
  let cloudMode = false;
  let signedIn = false;
  let products = [];
  let editingId = null;

  if (config.supabaseUrl && config.supabaseAnonKey && window.supabase) {
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'nievune-auth-session' },
    });
    cloudMode = true;
  }

  function toast(message, kind) {
    const el = document.createElement('div');
    el.className = `toast${kind ? ` ${kind}` : ''}`;
    el.textContent = message;
    toastStack.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }
  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_PRODUCTS_KEY) || 'null'); } catch { return null; }
  }
  function writeLocal(list) { localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(list)); }
  function money(value, currency) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(value || 0)); }
    catch { return `$${Number(value || 0).toFixed(2)}`; }
  }
  function toList(value) {
    return String(value || '').split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  function slugify(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  /* ---------------- data ---------------- */
  async function loadProducts() {
    if (cloudMode && signedIn) {
      const { data, error } = await supabaseClient.from('products').select('*').order('sort_order');
      if (error) { toast(error.message, 'error'); return; }
      products = data || [];
    } else if (!cloudMode) {
      const local = readLocal();
      products = local || await (await fetch('products.local.json')).json();
      if (!local) writeLocal(products);
    } else {
      products = [];
    }
    renderRows();
  }

  async function saveProduct(payload) {
    if (cloudMode && signedIn) {
      const query = editingId
        ? supabaseClient.from('products').update(payload).eq('id', editingId)
        : supabaseClient.from('products').insert(payload);
      const { error } = await query;
      if (error) { toast(error.message, 'error'); return false; }
      return true;
    }
    if (editingId) {
      products = products.map((product) => (product.id === editingId ? { ...product, ...payload } : product));
    } else {
      products = [...products, { ...payload, id: payload.slug }];
    }
    writeLocal(products);
    return true;
  }

  async function removeProduct(id) {
    if (!confirm('Delete this product permanently?')) return;
    if (cloudMode && signedIn) {
      const { error } = await supabaseClient.from('products').delete().eq('id', id);
      if (error) { toast(error.message, 'error'); return; }
    } else {
      products = products.filter((product) => product.id !== id);
      writeLocal(products);
    }
    toast('Product deleted');
    loadProducts();
  }

  async function toggleActive(product) {
    const payload = { is_active: !product.is_active };
    if (cloudMode && signedIn) {
      const { error } = await supabaseClient.from('products').update(payload).eq('id', product.id);
      if (error) { toast(error.message, 'error'); return; }
    } else {
      products = products.map((item) => (item.id === product.id ? { ...item, ...payload } : item));
      writeLocal(products);
    }
    toast(payload.is_active ? 'Product is now visible' : 'Product hidden');
    loadProducts();
  }

  async function move(product, delta) {
    const sorted = [...products].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    const index = sorted.findIndex((item) => item.id === product.id);
    const target = index + delta;
    if (target < 0 || target >= sorted.length) return;
    const swap = sorted[target];
    const updates = [
      { id: product.id, sort_order: Number(swap.sort_order || target + 1) },
      { id: swap.id, sort_order: Number(product.sort_order || index + 1) },
    ];
    if (cloudMode && signedIn) {
      for (const update of updates) {
        const { error } = await supabaseClient.from('products').update({ sort_order: update.sort_order }).eq('id', update.id);
        if (error) { toast(error.message, 'error'); return; }
      }
    } else {
      products = products.map((item) => {
        const update = updates.find((entry) => entry.id === item.id);
        return update ? { ...item, sort_order: update.sort_order } : item;
      });
      writeLocal(products);
    }
    loadProducts();
  }

  /* ---------------- rendering ---------------- */
  function renderRows() {
    const sorted = [...products].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
    listHint.textContent = `${sorted.length} product${sorted.length === 1 ? '' : 's'} in the catalog.`;
    if (!sorted.length) {
      rows.innerHTML = '<tr><td colspan="6">No products yet. Use the form above to create the first one.</td></tr>';
      return;
    }
    rows.innerHTML = sorted.map((product) => `<tr>
      <td><strong>${product.title || ''}</strong><br><small style="color:var(--muted)">${product.slug || product.id}</small></td>
      <td>${product.section || '—'}</td>
      <td>${money(product.price, product.currency)}</td>
      <td><span class="status-chip ${product.is_active ? 'on' : 'off'}">${product.is_active ? 'Visible' : 'Hidden'}</span></td>
      <td>${product.sort_order ?? 0}</td>
      <td><div class="row-actions">
        <button type="button" data-edit="${product.id}">Edit</button>
        <button type="button" data-toggle="${product.id}">${product.is_active ? 'Hide' : 'Show'}</button>
        <button type="button" data-up="${product.id}">↑</button>
        <button type="button" data-down="${product.id}">↓</button>
        <button type="button" data-delete="${product.id}">Delete</button>
      </div></td>
    </tr>`).join('');

    rows.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => startEdit(btn.dataset.edit)));
    rows.querySelectorAll('[data-toggle]').forEach((btn) => btn.addEventListener('click', () => {
      const product = products.find((item) => item.id === btn.dataset.toggle);
      if (product) toggleActive(product);
    }));
    rows.querySelectorAll('[data-up]').forEach((btn) => btn.addEventListener('click', () => {
      const product = products.find((item) => item.id === btn.dataset.up);
      if (product) move(product, -1);
    }));
    rows.querySelectorAll('[data-down]').forEach((btn) => btn.addEventListener('click', () => {
      const product = products.find((item) => item.id === btn.dataset.down);
      if (product) move(product, 1);
    }));
    rows.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', () => removeProduct(btn.dataset.delete)));
  }

  function startEdit(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    editingId = id;
    editorTitle.textContent = `Editing: ${product.title}`;
    form.title.value = product.title || '';
    form.slug.value = product.slug || product.id || '';
    form.badge.value = product.badge || '';
    form.category.value = product.category || '';
    form.section.value = product.section || 'chat-widgets';
    form.preview_kind.value = product.preview_kind || '';
    form.price.value = product.price ?? '';
    form.compare_at_price.value = product.compare_at_price ?? '';
    form.currency.value = product.currency || 'USD';
    form.sort_order.value = product.sort_order ?? 0;
    form.purchase_url.value = product.purchase_url || '';
    form.video_embed.value = product.video_embed || '';
    form.preview_image.value = product.preview_image || '';
    form.is_active.value = String(product.is_active !== false);
    form.short_description.value = product.short_description || '';
    form.description.value = product.description || '';
    form.features.value = (product.features || []).join('\n');
    form.tags.value = (product.tags || []).join(', ');
    window.scrollTo({ top: editorCard.offsetTop - 20, behavior: 'smooth' });
  }

  function resetForm() {
    editingId = null;
    form.reset();
    form.currency.value = 'USD';
    form.sort_order.value = products.length + 1;
    editorTitle.textContent = 'New product';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      title: String(data.get('title')).trim(),
      slug: slugify(data.get('slug') || data.get('title')),
      badge: String(data.get('badge') || '').trim(),
      category: String(data.get('category') || '').trim(),
      section: String(data.get('section')),
      preview_kind: String(data.get('preview_kind') || ''),
      price: Number(data.get('price')),
      compare_at_price: data.get('compare_at_price') ? Number(data.get('compare_at_price')) : null,
      currency: String(data.get('currency') || 'USD').toUpperCase(),
      sort_order: Number(data.get('sort_order') || 0),
      purchase_url: String(data.get('purchase_url') || '').trim(),
      video_embed: String(data.get('video_embed') || '').trim(),
      preview_image: String(data.get('preview_image') || '').trim(),
      is_active: data.get('is_active') === 'true',
      short_description: String(data.get('short_description') || '').trim(),
      description: String(data.get('description') || '').trim(),
      features: toList(data.get('features')),
      tags: toList(data.get('tags')),
    };
    if (!payload.title || !payload.slug || Number.isNaN(payload.price)) { toast('Fill title, slug and price.', 'error'); return; }
    const saved = await saveProduct(payload);
    if (!saved) return;
    toast(editingId ? 'Product updated' : 'Product created');
    resetForm();
    loadProducts();
  });

  document.getElementById('resetButton').addEventListener('click', resetForm);
  document.getElementById('exportButton').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'products.local.json';
    link.click();
    URL.revokeObjectURL(link.href);
    toast('products.local.json exported');
  });
  document.getElementById('restoreButton').addEventListener('click', async () => {
    if (cloudMode && signedIn) { toast('Restore is only available in local mode.', 'error'); return; }
    if (!confirm('Replace the local catalog with the starter products?')) return;
    products = await (await fetch('products.local.json')).json();
    writeLocal(products);
    toast('Starter catalog restored');
    renderRows();
  });

  /* ---------------- auth ---------------- */
  async function refreshSession() {
    if (!cloudMode) return;
    const { data, error: sessionError } = await supabaseClient.auth.getSession();
    const session = data.session;
    let isAdmin = false;

    if (session && !sessionError) {
      const { data: adminResult, error: adminError } = await supabaseClient.rpc('is_shop_admin');
      if (adminError) {
        document.getElementById('authMessage').textContent = adminError.message;
      } else {
        isAdmin = adminResult === true;
      }
    }

    signedIn = Boolean(session && isAdmin);
    authCard.hidden = signedIn;
    editorCard.hidden = !signedIn;
    document.getElementById('signOutButton').hidden = !session;
    banner.className = `mode-banner ${signedIn ? 'cloud' : 'local'}`;

    if (signedIn) {
      banner.textContent = `Cloud mode — owner ${session.user.email} is signed in. Changes go live immediately.`;
      document.getElementById('authMessage').textContent = '';
    } else if (session) {
      banner.textContent = 'Access denied — this customer account is not registered as a shop owner.';
      document.getElementById('authMessage').textContent = 'This account can use the storefront, but it cannot manage products. Add your owner user ID to public.shop_admins in Supabase.';
    } else {
      banner.textContent = 'Cloud mode — sign in with the owner account to manage products.';
    }
    loadProducts();
  }
  document.getElementById('signInButton')?.addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { document.getElementById('authMessage').textContent = error.message; return; }
    refreshSession();
  });
  document.getElementById('signOutButton')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    refreshSession();
  });

  /* ---------------- boot ---------------- */
  if (cloudMode) {
    supabaseClient.auth.onAuthStateChange(() => setTimeout(refreshSession, 0));
    refreshSession();
  } else {
    banner.className = 'mode-banner local';
    banner.textContent = 'Local mode — no cloud keys in config.js. Products are saved in this browser; use "Export JSON" to replace products.local.json and publish the changes.';
    authCard.hidden = true;
    editorCard.hidden = false;
    loadProducts().then(() => { form.sort_order.value = products.length + 1; });
  }
})();
