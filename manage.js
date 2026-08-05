(() => {
  const config = window.NIEVUNE_CONFIG || {};
  const authPanel = document.getElementById('authPanel');
  const dashboard = document.getElementById('dashboard');
  const authForm = document.getElementById('authForm');
  const authStatus = document.getElementById('authStatus');
  const productForm = document.getElementById('productForm');
  const productList = document.getElementById('productList');
  const resetFormButton = document.getElementById('resetFormButton');
  const newProductButton = document.getElementById('newProductButton');
  const signOutButton = document.getElementById('signOutButton');
  const previewUpload = document.getElementById('previewUpload');
  const signupButton = document.querySelector('[data-auth-signup]');
  let client = null;
  let products = [];

  authForm.addEventListener('submit', signIn);
  signupButton.addEventListener('click', signUp);
  productForm.addEventListener('submit', saveProduct);
  resetFormButton.addEventListener('click', resetForm);
  newProductButton.addEventListener('click', resetForm);
  signOutButton.addEventListener('click', signOut);
  previewUpload.addEventListener('change', handleImageUpload);
  init();

  async function init() {
    if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
      authStatus.textContent = 'Supabase is not configured yet. Add your project URL and anon key to config.js first.';
      authForm.querySelectorAll('input,button').forEach((element) => element.disabled = true);
      return;
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await client.auth.getSession();
    if (data.session) await authorize(data.session.user);
    else authStatus.textContent = 'Sign in, or create the first owner account before publishing the store.';
  }

  async function signUp() {
    const fd = new FormData(authForm);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    if (!email || password.length < 6) { authStatus.textContent = 'Enter a valid email and a password with at least 6 characters.'; return; }
    authStatus.textContent = 'Creating owner account...';
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) { authStatus.textContent = error.message; return; }
    if (data.session) await authorize(data.user, true);
    else authStatus.textContent = 'Account created. Confirm the email, then return here and sign in to claim owner access.';
  }

  async function signIn(event) {
    event.preventDefault();
    const fd = new FormData(authForm);
    authStatus.textContent = 'Signing in...';
    const { data, error } = await client.auth.signInWithPassword({ email: fd.get('email'), password: fd.get('password') });
    if (error) { authStatus.textContent = error.message; return; }
    await authorize(data.user, true);
  }

  async function authorize(user, allowClaim = false) {
    let { data: isAdmin, error } = await client.rpc('is_shop_admin');
    if (error) { authStatus.textContent = `Authorization check failed: ${error.message}`; return; }
    if (!isAdmin && allowClaim) {
      const result = await client.rpc('claim_first_admin');
      if (result.error) { authStatus.textContent = result.error.message; return; }
      isAdmin = result.data === true;
    }
    if (!isAdmin) {
      await client.auth.signOut();
      authStatus.textContent = 'Access denied. This account is not the Nievune store owner.';
      return;
    }
    authStatus.textContent = `Owner access confirmed: ${user.email}`;
    authPanel.hidden = true;
    dashboard.hidden = false;
    await loadProducts();
  }

  async function signOut() {
    await client.auth.signOut();
    dashboard.hidden = true; authPanel.hidden = false;
    authStatus.textContent = 'Signed out.';
  }

  async function loadProducts() {
    const { data, error } = await client.from('products').select('*').order('sort_order');
    if (error) { productList.innerHTML = `<p class="empty-state">${error.message}</p>`; return; }
    products = data || []; renderList();
  }

  function renderList() {
    productList.innerHTML = products.length ? products.map((product) => `
      <article class="admin-item">
        <div><span>${product.category || 'Collection'}</span><h4>${product.title}</h4><p>${product.short_description || ''}</p><small>${Number(product.price || 0).toFixed(2)} ${product.currency || 'USD'} • ${product.is_active ? 'Visible' : 'Hidden'}</small></div>
        <div class="admin-item-actions"><button class="small-button" type="button" data-edit="${product.id}">Edit</button><button class="small-button" type="button" data-delete="${product.id}">Delete</button></div>
      </article>`).join('') : '<p class="empty-state">No products yet.</p>';
    productList.querySelectorAll('[data-edit]').forEach((button)=>button.addEventListener('click',()=>populateForm(button.dataset.edit)));
    productList.querySelectorAll('[data-delete]').forEach((button)=>button.addEventListener('click',()=>removeProduct(button.dataset.delete)));
  }

  function populateForm(id) {
    const product = products.find((item)=>item.id===id); if (!product) return;
    for (const [key,value] of Object.entries(product)) {
      const field=productForm.elements.namedItem(key); if(!field) continue;
      if(field.type==='checkbox') field.checked=Boolean(value);
      else if(key==='features') field.value=Array.isArray(value)?value.join('\n'):'';
      else if(key==='tags') field.value=Array.isArray(value)?value.join(', '):'';
      else field.value=value ?? '';
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function resetForm() {
    productForm.reset();
    productForm.elements.namedItem('id').value='';
    productForm.elements.namedItem('currency').value='USD';
    productForm.elements.namedItem('is_active').checked=true;
    productForm.elements.namedItem('preview_kind').value='zigzag-chat';
    productForm.elements.namedItem('section').value='chat-widgets';
  }

  async function saveProduct(event) {
    event.preventDefault();
    const fd=new FormData(productForm); const payload=Object.fromEntries(fd.entries());
    payload.id=payload.id || crypto.randomUUID();
    payload.features=String(payload.features||'').split('\n').map(v=>v.trim()).filter(Boolean);
    payload.tags=String(payload.tags||'').split(',').map(v=>v.trim()).filter(Boolean);
    payload.price=Number(payload.price||0);
    payload.compare_at_price=payload.compare_at_price?Number(payload.compare_at_price):null;
    payload.sort_order=Number(payload.sort_order||0);
    payload.is_active=productForm.elements.namedItem('is_active').checked;
    payload.updated_at=new Date().toISOString();
    const { error }=await client.from('products').upsert(payload,{onConflict:'id'});
    if(error){alert(error.message);return;}
    resetForm(); await loadProducts(); alert('Product saved.');
  }
  async function removeProduct(id) {
    if(!confirm('Delete this product?')) return;
    const {error}=await client.from('products').delete().eq('id',id);
    if(error){alert(error.message);return;}
    await loadProducts(); resetForm();
  }
  function handleImageUpload(event) {
    const file=event.target.files?.[0]; if(!file)return;
    if(file.size>1_500_000){alert('Use an image smaller than 1.5 MB for this simple upload method.');event.target.value='';return;}
    const reader=new FileReader(); reader.onload=()=>{productForm.elements.namedItem('preview_image').value=reader.result;}; reader.readAsDataURL(file);
  }
})();