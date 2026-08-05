<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Nievune — Product manager</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css" />
</head>
<body class="admin-body">
  <div class="admin-shell">
    <div class="admin-header">
      <div>
        <h1>Product manager</h1>
        <p>Private page — add, edit, hide, reorder or delete the products shown in the store.</p>
      </div>
      <div class="row-actions">
        <a class="button-quiet" href="index.html">Open store</a>
        <button class="button-quiet" type="button" id="exportButton">Export JSON</button>
        <button class="button-quiet" type="button" id="signOutButton" hidden>Sign out</button>
      </div>
    </div>

    <div class="mode-banner local" id="modeBanner">Checking configuration…</div>

    <section class="admin-card" id="authCard" hidden>
      <h2>Owner sign in</h2>
      <p class="hint">Sign in with the owner account. Customer accounts are blocked by database policies even if they discover this page.</p>
      <div class="auth-grid">
        <label class="field"><span>Email</span><input id="authEmail" type="email" autocomplete="email" /></label>
        <label class="field"><span>Password</span><input id="authPassword" type="password" autocomplete="current-password" /></label>
        <div class="row-actions">
          <button class="button-primary" type="button" id="signInButton">Sign in as owner</button>
        </div>
      </div>
      <p class="hint" id="authMessage" style="margin-top:12px"></p>
    </section>

    <section class="admin-card" id="editorCard">
      <h2 id="editorTitle">New product</h2>
      <p class="hint">Fields marked with * are required. Features and tags accept one item per line or comma separated values.</p>
      <form id="productForm">
        <div class="field-grid">
          <label class="field"><span>Title *</span><input name="title" required /></label>
          <label class="field"><span>Slug *</span><input name="slug" required placeholder="minimalist-chat" /></label>
          <label class="field"><span>Badge</span><input name="badge" placeholder="CHAT WIDGET" /></label>
          <label class="field"><span>Collection</span><input name="category" placeholder="Minimalist Collection" /></label>
          <label class="field"><span>Section *</span>
            <select name="section" required>
              <option value="chat-widgets">Chat widgets</option>
              <option value="notifications">Notifications</option>
              <option value="bundles">Bundles</option>
            </select>
          </label>
          <label class="field"><span>Preview style</span>
            <select name="preview_kind">
              <option value="">Image / none</option>
              <option value="minimalist-chat">Minimalist chat</option>
              <option value="zigzag-chat">Zigzag chat</option>
              <option value="minimalist-notification">Minimalist notification</option>
              <option value="minimalist-bundle">Minimalist bundle</option>
            </select>
          </label>
          <label class="field"><span>Price *</span><input name="price" type="number" step="0.01" min="0" required /></label>
          <label class="field"><span>Compare at price</span><input name="compare_at_price" type="number" step="0.01" min="0" /></label>
          <label class="field"><span>Currency</span><input name="currency" value="USD" /></label>
          <label class="field"><span>Sort order</span><input name="sort_order" type="number" min="0" value="0" /></label>
          <label class="field"><span>Checkout URL</span><input name="purchase_url" type="url" placeholder="https://…" /></label>
          <label class="field"><span>Video URL</span><input name="video_embed" type="url" placeholder="https://youtu.be/…" /></label>
          <label class="field"><span>Preview image URL</span><input name="preview_image" placeholder="assets/preview-chat.webp" /></label>
          <label class="field"><span>Active</span>
            <select name="is_active"><option value="true">Visible in store</option><option value="false">Hidden</option></select>
          </label>
          <label class="field wide"><span>Short description</span><input name="short_description" /></label>
          <label class="field wide"><span>Description</span><textarea name="description"></textarea></label>
          <label class="field wide"><span>Features</span><textarea name="features" placeholder="One feature per line"></textarea></label>
          <label class="field wide"><span>Tags</span><input name="tags" placeholder="chat, minimalist, streamelements" /></label>
        </div>
        <div class="admin-actions">
          <button class="button-primary" type="submit" id="saveButton">Save product</button>
          <button class="button-quiet" type="button" id="resetButton">Clear form</button>
        </div>
      </form>
    </section>

    <section class="admin-card">
      <h2>Products</h2>
      <p class="hint" id="listHint">Loading…</p>
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr><th>Product</th><th>Section</th><th>Price</th><th>Status</th><th>Order</th><th>Actions</th></tr>
          </thead>
          <tbody id="productRows"></tbody>
        </table>
      </div>
      <div class="admin-actions">
        <button class="button-quiet" type="button" id="restoreButton">Restore starter catalog</button>
      </div>
    </section>
  </div>

  <div class="toast-stack" id="toastStack" aria-live="polite"></div>

  <script src="config.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="manage.js"></script>
</body>
</html>
