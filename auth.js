/* Nievune customer accounts — Supabase Auth + cached, cross-device favorites.
   Security is enforced by Row Level Security in supabase-schema.sql. */
(() => {
  const config = window.NIEVUNE_CONFIG || {};
  const LEGACY_FAVORITES_KEY = 'nievune.favorites.v1';
  const AUTH_SNAPSHOT_KEY = 'nievune.auth.snapshot.v1';
  const PROFILE_CACHE_PREFIX = 'nievune.profile.cache.v1:';
  const FAVORITES_CACHE_PREFIX = 'nievune.favorites.cache.v2:';
  const FAVORITES_QUEUE_PREFIX = 'nievune.favorites.queue.v1:';

  const modal = document.getElementById('authModal');
  const accountButton = document.getElementById('accountButton');
  const accountAvatar = document.getElementById('accountAvatar');
  const accountLabel = document.getElementById('accountLabel');
  const toastStack = document.getElementById('toastStack');
  const signedOutAvatar = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c.8-4.5 3.5-7 8-7s7.2 2.5 8 7"></path></svg>';

  let client = null;
  let user = null;
  let profile = null;
  let favorites = new Set();
  let initialized = false;
  let activeUserRequest = 0;

  function readStore(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage may be disabled. The live database remains the source of truth.
    }
  }

  function removeStore(key) {
    try { localStorage.removeItem(key); } catch { /* storage disabled */ }
  }

  function toast(message, kind) {
    if (!toastStack) return;
    const element = document.createElement('div');
    element.className = `toast${kind ? ` ${kind}` : ''}`;
    element.textContent = message;
    toastStack.appendChild(element);
    setTimeout(() => element.remove(), 3200);
  }

  function redirectUrl() {
    if (config.authRedirectUrl) return config.authRedirectUrl;
    if (location.protocol === 'file:') return location.href.split('#')[0];
    return `${location.origin}${location.pathname}`;
  }

  function isConfigured() {
    return Boolean(config.supabaseUrl && config.supabaseAnonKey && window.supabase);
  }

  function initial(value) {
    const text = String(value || '').trim();
    return text ? text.charAt(0).toUpperCase() : '♡';
  }

  function displayName() {
    return profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Account';
  }

  function setHeaderFromSnapshot() {
    const snapshot = readStore(AUTH_SNAPSHOT_KEY, null);
    if (!snapshot) return;
    accountAvatar.textContent = initial(snapshot.displayName || snapshot.email);
    accountLabel.textContent = snapshot.displayName || snapshot.email?.split('@')[0] || 'Account';
    accountButton?.classList.add('is-signed-in', 'is-loading-session');
  }

  function updateHeader() {
    if (!accountButton || !accountAvatar || !accountLabel) return;
    accountButton.classList.remove('is-loading-session');
    if (user) {
      const name = displayName();
      accountAvatar.textContent = initial(name);
      accountLabel.textContent = name;
      accountButton.classList.add('is-signed-in');
      accountButton.setAttribute('aria-label', `Open account for ${name}`);
      writeStore(AUTH_SNAPSHOT_KEY, { userId: user.id, email: user.email, displayName: name });
    } else {
      accountAvatar.innerHTML = signedOutAvatar;
      accountLabel.textContent = 'Sign in';
      accountButton.classList.remove('is-signed-in');
      accountButton.setAttribute('aria-label', 'Sign in or create an account');
      removeStore(AUTH_SNAPSHOT_KEY);
    }
  }

  function dispatch(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function setFeedback(id, message, kind = '') {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message || '';
    element.className = `auth-feedback${kind ? ` ${kind}` : ''}`;
  }

  function setBusy(form, busy) {
    if (!form) return;
    form.querySelectorAll('button, input').forEach((element) => {
      element.disabled = busy;
    });
    form.classList.toggle('is-busy', busy);
  }

  function setView(view) {
    if (!modal) return;
    modal.querySelectorAll('[data-auth-view]').forEach((section) => {
      section.hidden = section.dataset.authView !== view;
    });
    modal.dataset.activeView = view;

    if (view === 'account') renderAccountView();
    requestAnimationFrame(() => {
      modal.querySelector(`[data-auth-view="${view}"] input:not([type="hidden"])`)?.focus();
    });
  }

  function open(view = user ? 'account' : 'signin', message = '') {
    if (!modal) return;
    if (view === 'account' && !user) view = 'signin';
    setView(view);
    if (message) {
      const target = view === 'signup' ? 'signUpFeedback' : view === 'forgot' ? 'forgotFeedback' : 'signInFeedback';
      setFeedback(target, message, 'info');
    }
    if (typeof modal.showModal === 'function' && !modal.open) modal.showModal();
    else modal.setAttribute('open', '');
  }

  function close() {
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  function renderAccountView() {
    const nameInput = document.getElementById('profileDisplayName');
    const email = document.getElementById('accountEmail');
    const avatar = document.getElementById('accountLargeAvatar');
    const count = document.getElementById('accountFavoriteCount');
    if (nameInput) nameInput.value = displayName();
    if (email) email.textContent = user?.email || '';
    if (avatar) avatar.textContent = initial(displayName());
    if (count) count.textContent = String(favorites.size);
  }

  function profileCacheKey(userId) { return `${PROFILE_CACHE_PREFIX}${userId}`; }
  function favoritesCacheKey(userId) { return `${FAVORITES_CACHE_PREFIX}${userId}`; }
  function favoritesQueueKey(userId) { return `${FAVORITES_QUEUE_PREFIX}${userId}`; }

  function writeFavoritesCache() {
    if (!user) return;
    writeStore(favoritesCacheKey(user.id), { ids: [...favorites], updatedAt: Date.now() });
  }

  function emitFavorites() {
    writeFavoritesCache();
    updateHeader();
    renderAccountView();
    dispatch('nievune:favoriteschange', { favorites: [...favorites], user });
  }

  function queuedMutations() {
    if (!user) return [];
    return readStore(favoritesQueueKey(user.id), []);
  }

  function queueMutation(productId, action) {
    if (!user) return;
    const queue = queuedMutations().filter((item) => item.product_id !== productId);
    queue.push({ product_id: productId, action, updated_at: Date.now() });
    writeStore(favoritesQueueKey(user.id), queue);
  }

  function clearQueuedMutation(productId) {
    if (!user) return;
    const queue = queuedMutations().filter((item) => item.product_id !== productId);
    writeStore(favoritesQueueKey(user.id), queue);
  }

  async function applyFavoriteMutation(productId, action, silent = false) {
    if (!client || !user) return false;
    let error = null;
    if (action === 'add') {
      ({ error } = await client.from('user_favorites').upsert({ user_id: user.id, product_id: productId }, { onConflict: 'user_id,product_id' }));
    } else {
      ({ error } = await client.from('user_favorites').delete().eq('user_id', user.id).eq('product_id', productId));
    }
    if (error) {
      queueMutation(productId, action);
      if (!silent) toast('Saved on this device. It will sync when you are online.', 'error');
      return false;
    }
    clearQueuedMutation(productId);
    return true;
  }

  async function flushFavoriteQueue() {
    if (!client || !user || !navigator.onLine) return;
    const queue = queuedMutations();
    for (const item of queue) {
      await applyFavoriteMutation(item.product_id, item.action, true);
    }
  }

  async function loadProfile(currentUser, requestId) {
    const cached = readStore(profileCacheKey(currentUser.id), null);
    if (cached) {
      profile = cached;
      updateHeader();
    }

    const { data, error } = await client.from('profiles').select('user_id, display_name, created_at, updated_at').eq('user_id', currentUser.id).maybeSingle();
    if (requestId !== activeUserRequest || user?.id !== currentUser.id) return;
    if (error) {
      console.warn('Unable to load profile:', error.message);
      return;
    }

    profile = data || {
      user_id: currentUser.id,
      display_name: currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || '',
    };
    writeStore(profileCacheKey(currentUser.id), profile);
    updateHeader();
    renderAccountView();
  }

  async function migrateLegacyFavorites(currentUser) {
    const legacy = readStore(LEGACY_FAVORITES_KEY, []);
    if (!Array.isArray(legacy) || !legacy.length) return;
    legacy.forEach((id) => favorites.add(id));
    writeFavoritesCache();
    const rows = legacy.map((productId) => ({ user_id: currentUser.id, product_id: productId }));
    const { error } = await client.from('user_favorites').upsert(rows, { onConflict: 'user_id,product_id' });
    if (!error) removeStore(LEGACY_FAVORITES_KEY);
  }

  async function loadFavorites(currentUser, requestId) {
    const cached = readStore(favoritesCacheKey(currentUser.id), null);
    favorites = new Set(Array.isArray(cached?.ids) ? cached.ids : []);

    // Pending offline mutations must be reflected immediately on top of the cache.
    readStore(favoritesQueueKey(currentUser.id), []).forEach((item) => {
      if (item.action === 'add') favorites.add(item.product_id);
      else favorites.delete(item.product_id);
    });
    emitFavorites();

    await migrateLegacyFavorites(currentUser);
    const { data, error } = await client.from('user_favorites').select('product_id').eq('user_id', currentUser.id);
    if (requestId !== activeUserRequest || user?.id !== currentUser.id) return;
    if (error) {
      console.warn('Unable to refresh favorites:', error.message);
      return;
    }

    const serverFavorites = new Set((data || []).map((row) => row.product_id));
    queuedMutations().forEach((item) => {
      if (item.action === 'add') serverFavorites.add(item.product_id);
      else serverFavorites.delete(item.product_id);
    });
    favorites = serverFavorites;
    emitFavorites();
    await flushFavoriteQueue();
  }

  async function handleSession(session) {
    const requestId = ++activeUserRequest;
    user = session?.user || null;
    profile = null;

    if (!user) {
      favorites = new Set();
      updateHeader();
      emitFavorites();
      dispatch('nievune:authchange', { user: null, profile: null });
      return;
    }

    updateHeader();
    dispatch('nievune:authchange', { user, profile });
    await Promise.all([
      loadProfile(user, requestId),
      loadFavorites(user, requestId),
    ]);
    if (requestId === activeUserRequest) dispatch('nievune:authchange', { user, profile });
  }

  async function toggleFavorite(productId) {
    if (!user) {
      open('signin', 'Sign in to save favorites and access them on every device.');
      return false;
    }
    const removing = favorites.has(productId);
    if (removing) favorites.delete(productId);
    else favorites.add(productId);
    emitFavorites();
    toast(removing ? 'Removed from favorites' : 'Saved to favorites');
    await applyFavoriteMutation(productId, removing ? 'remove' : 'add');
    return true;
  }

  function ensureConfigured(feedbackId) {
    if (client) return true;
    setFeedback(feedbackId, 'The account interface is ready, but Supabase still needs to be connected in config.js.', 'error');
    return false;
  }

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!ensureConfigured('signInFeedback')) return;
    setFeedback('signInFeedback', '');
    setBusy(form, true);
    const email = form.email.value.trim();
    const password = form.password.value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    setBusy(form, false);
    if (error) {
      setFeedback('signInFeedback', error.message, 'error');
      return;
    }
    close();
    toast('Welcome back!');
  }

  async function signUp(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!ensureConfigured('signUpFeedback')) return;
    const displayNameValue = form.displayName.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password.length < 8) {
      setFeedback('signUpFeedback', 'Use at least 8 characters for your password.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      setFeedback('signUpFeedback', 'The passwords do not match.', 'error');
      return;
    }

    setFeedback('signUpFeedback', '');
    setBusy(form, true);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayNameValue },
        emailRedirectTo: redirectUrl(),
      },
    });
    setBusy(form, false);

    if (error) {
      setFeedback('signUpFeedback', error.message, 'error');
      return;
    }
    if (data.session) {
      close();
      toast('Your account is ready!');
    } else {
      document.getElementById('verificationEmail').textContent = email;
      setView('verify');
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!ensureConfigured('forgotFeedback')) return;
    setBusy(form, true);
    const { error } = await client.auth.resetPasswordForEmail(form.email.value.trim(), { redirectTo: redirectUrl() });
    setBusy(form, false);
    setFeedback('forgotFeedback', error ? error.message : 'Password reset email sent. Check your inbox.', error ? 'error' : 'success');
  }

  async function resetPassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!ensureConfigured('resetFeedback')) return;
    const password = form.password.value;
    if (password.length < 8) {
      setFeedback('resetFeedback', 'Use at least 8 characters.', 'error');
      return;
    }
    if (password !== form.confirmPassword.value) {
      setFeedback('resetFeedback', 'The passwords do not match.', 'error');
      return;
    }
    setBusy(form, true);
    const { error } = await client.auth.updateUser({ password });
    setBusy(form, false);
    if (error) {
      setFeedback('resetFeedback', error.message, 'error');
      return;
    }
    setFeedback('resetFeedback', 'Password updated successfully.', 'success');
    setTimeout(() => setView('account'), 700);
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!user || !ensureConfigured('profileFeedback')) return;
    const name = form.displayName.value.trim();
    if (!name) {
      setFeedback('profileFeedback', 'Enter a display name.', 'error');
      return;
    }
    setBusy(form, true);
    const payload = { user_id: user.id, display_name: name, updated_at: new Date().toISOString() };
    const [{ error: profileError }, { error: userError }] = await Promise.all([
      client.from('profiles').upsert(payload, { onConflict: 'user_id' }),
      client.auth.updateUser({ data: { display_name: name } }),
    ]);
    setBusy(form, false);
    const error = profileError || userError;
    if (error) {
      setFeedback('profileFeedback', error.message, 'error');
      return;
    }
    profile = payload;
    writeStore(profileCacheKey(user.id), profile);
    updateHeader();
    renderAccountView();
    setFeedback('profileFeedback', 'Profile updated.', 'success');
    dispatch('nievune:authchange', { user, profile });
  }

  async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!user || !ensureConfigured('accountPasswordFeedback')) return;
    const password = form.password.value;
    if (password.length < 8) {
      setFeedback('accountPasswordFeedback', 'Use at least 8 characters.', 'error');
      return;
    }
    if (password !== form.confirmPassword.value) {
      setFeedback('accountPasswordFeedback', 'The passwords do not match.', 'error');
      return;
    }
    setBusy(form, true);
    const { error } = await client.auth.updateUser({ password });
    setBusy(form, false);
    if (error) {
      setFeedback('accountPasswordFeedback', error.message, 'error');
      return;
    }
    form.reset();
    setFeedback('accountPasswordFeedback', 'Password changed.', 'success');
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
    close();
    toast('Signed out.');
  }

  function bindUI() {
    const openAccount = () => open(user ? 'account' : 'signin', client ? '' : 'The account interface is ready, but Supabase still needs to be connected in config.js.');
    accountButton?.addEventListener('click', openAccount);
    document.getElementById('mobileAccountButton')?.addEventListener('click', openAccount);

    modal?.addEventListener('click', (event) => {
      if (event.target === modal || event.target.hasAttribute('data-close-auth')) close();
    });
    modal?.querySelectorAll('[data-auth-switch]').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.authSwitch));
    });

    document.getElementById('signInForm')?.addEventListener('submit', signIn);
    document.getElementById('signUpForm')?.addEventListener('submit', signUp);
    document.getElementById('forgotForm')?.addEventListener('submit', requestPasswordReset);
    document.getElementById('resetPasswordForm')?.addEventListener('submit', resetPassword);
    document.getElementById('profileForm')?.addEventListener('submit', saveProfile);
    document.getElementById('accountPasswordForm')?.addEventListener('submit', changePassword);
    document.getElementById('accountSignOut')?.addEventListener('click', signOut);
    window.addEventListener('online', flushFavoriteQueue);
  }

  async function init() {
    if (initialized) return;
    initialized = true;
    setHeaderFromSnapshot();
    bindUI();

    if (!isConfigured()) {
      updateHeader();
      dispatch('nievune:authready', { configured: false, user: null });
      return;
    }

    client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'nievune-auth-session',
      },
    });

    const { data: { session } } = await client.auth.getSession();
    await handleSession(session);

    client.auth.onAuthStateChange((event, nextSession) => {
      // Avoid performing database work directly inside the auth callback.
      setTimeout(async () => {
        await handleSession(nextSession);
        if (event === 'PASSWORD_RECOVERY') open('reset');
      }, 0);
    });

    dispatch('nievune:authready', { configured: true, user });
  }

  window.NievuneAuth = {
    init,
    open,
    close,
    isConfigured,
    getClient: () => client,
    getUser: () => user,
    getProfile: () => profile,
    getFavorites: () => [...favorites],
    toggleFavorite,
    signOut,
  };

  init();
})();
