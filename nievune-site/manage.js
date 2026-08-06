(() => {
  const cfg = window.NIEVUNE_CONFIG || {};
  const authPanel = document.getElementById('authPanel');
  const dashboard = document.getElementById('dashboard');
  const authForm = document.getElementById('authForm');
  const authStatus = document.getElementById('authStatus');
  const productForm = document.getElementById('productForm');
  const productList = document.getElementById('productList');
  const previewUpload = document.getElementById('previewUpload');
  const setupMessage = document.getElementById('setupMessage');

  let client = null;
  let products = [];

  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  if (configured) client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  document.querySelector('[data-auth-signup]')?.addEventListener('click', signUp);
  authForm?.addEventListener('submit', signIn);
  document.getElementById('signOutButton')?.addEventListener('click', signOut);
  document.getElementById('newProductButton')?.addEventListener('click', resetForm);
  document.getElementById('resetFormButton')?.addEventListener('click', resetForm);
  productForm?.addEventListener('submit', saveProduct);
  previewUpload?.addEventListener('change', uploadPreview);

  init();

  async function init() {
    if (!configured) {
      authStatus.textContent = 'Supabase is not configured yet.';
      setupMessage.textContent = 'The storefront works now, but real private access requires Supabase. Add the project URL and anon key to config.js, then run supabase-schema.sql.';
      return;
    }

    const { data } = await client.auth.getSession();
    if (data.session) await authorize(data.session.user);
    else authStatus.textContent = 'Sign in with the owner account.';
  }

  async function signUp() {
    if (!configured) return alert('Configure Supabase first.');
    const data = new FormData(authForm);
    const email = data.get('email');
    const password = data.get('password');
    const { data: result, error } = await client.auth.signUp({ email, password });
    if (error) return setStatus(error.message);
    setStatus('Account created. Confirm the email if required, then sign in.');
    if (result.session) await claimAndAuthorize(result.user);
  }

  async function signIn(event) {
    event.preventDefault();
    if (!configured) return alert('Configure Supabase first.');
    const data = new FormData(authForm);
    const { data: result, error } = await client.auth.signInWithPassword({ email: data.get('email'), password: data.get('password') });
    if (error) return setStatus(error.message);
    await authorize(result.user);
  }

  async function claimAndAuthorize(user) {
    const { error } = await client.rpc('claim_store_owner');
    if (error) return setStatus(error.message);
    await authorize(user);
  }

  async function authorize(user) {
    const { data, error } = await client.rpc('is_store_owner');
    if (error) return setStatus(error.message);
    if (!data) {
      const { data: claimed, error: claimError } = await client.rpc('claim_store_owner');
      if (claimError || !claimed) {
        await client.auth.signOut();
        return setStatus('This account is not the store owner.');
      }
    }
    authPanel.hidden = true;
    dashboard.hidden = false;
    setStatus(`Signed in as ${user.email}`);
    await loadProducts();
  }

  async function signOut() {
    await client.auth.signOut();
    dashboard.hidden = true;
    authPanel.hidden = false;
    setStatus('Signed out.');
  }

  function setStatus(message) { authStatus.textContent = message; }

  async function loadProducts() {
    const { data, error } = await client.from('products').select('*').order('sort_order');
    if (error) return alert(error.message);
    products = data || [];
    renderList();
  }

  function renderList() {
    if (!products.length) {
      productList.innerHTML = '<p class="admin-empty">No products yet.</p>';
      return;
    }
    productList.innerHTML = products.map((product) => `<article class="admin-product-item">
      <div>
        <span>${product.section || 'product'}</span>
        <h4>${product.title}</h4>
        <p>${product.short_description || ''}</p>
        <small>${Number(product.price || 0).toFixed(2)} ${product.currency || 'USD'} • ${product.is_active ? 'Visible' : 'Hidden'}</small>
      </div>
      <div class="admin-item-actions">
        <button class="small-button" type="button" data-edit="${product.id}">Edit</button>
        <button class="small-button danger" type="button" data-delete="${product.id}">Delete</button>
      </div>
    </article>`).join('');
    productList.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => editProduct(button.dataset.edit)));
    productList.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteProduct(button.dataset.delete)));
  }

  function editProduct(id) {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    Object.entries(product).forEach(([key, value]) => {
      const field = productForm.elements.namedItem(key);
      if (!field) return;
      if (field.type === 'checkbox') field.checked = Boolean(value);
      else if (key === 'features') field.value = Array.isArray(value) ? value.join('\n') : '';
      else if (key === 'tags') field.value = Array.isArray(value) ? value.join(', ') : '';
      else field.value = value ?? '';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    productForm.reset();
    productForm.elements.namedItem('id').value = '';
    productForm.elements.namedItem('currency').value = 'USD';
    productForm.elements.namedItem('is_active').checked = true;
    productForm.elements.namedItem('sort_order').value = '0';
  }

  async function saveProduct(event) {
    event.preventDefault();
    const fd = new FormData(productForm);
    const payload = Object.fromEntries(fd.entries());
    if (!payload.id) delete payload.id;
    payload.price = Number(payload.price || 0);
    payload.compare_at_price = payload.compare_at_price ? Number(payload.compare_at_price) : null;
    payload.sort_order = Number(payload.sort_order || 0);
    payload.is_active = productForm.elements.namedItem('is_active').checked;
    payload.features = String(payload.features || '').split('\n').map((v) => v.trim()).filter(Boolean);
    payload.tags = String(payload.tags || '').split(',').map((v) => v.trim()).filter(Boolean);
    payload.updated_at = new Date().toISOString();

    const { error } = await client.from('products').upsert(payload, { onConflict: 'id' });
    if (error) return alert(error.message);
    resetForm();
    await loadProducts();
    alert('Product saved.');
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    const { error } = await client.from('products').delete().eq('id', id);
    if (error) return alert(error.message);
    await loadProducts();
    resetForm();
  }

  function uploadPreview(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { productForm.elements.namedItem('preview_image').value = reader.result; };
    reader.readAsDataURL(file);
  }
})();
