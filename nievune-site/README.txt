NIEVUNE E-COMMERCE V4

WHAT CHANGED
- The public store no longer shows any admin or sign-in links.
- Product management moved to a separate private page: manage-nievune.html.
- The private manager no longer opens in local mode. Supabase must be configured.
- The first authenticated account can claim permanent owner access.
- Database policies allow only the owner account to insert, edit, hide, or delete products.
- Public visitors can only read active products.
- Product selection/gallery was added to the product modal.
- Minimalist Notification now displays the real Follow/Sub widget preview.
- The notification preview can switch between Combined card and Separate cards.
- Every product still includes a reserved video area.

PUBLIC STORE
- index.html

PRIVATE OWNER PAGE
- manage-nievune.html
- This page is intentionally not linked anywhere in the public store.
- Knowing the URL does not grant access; Supabase authentication and database policies protect the dashboard.

IMPORTANT FIRST SETUP ORDER
1. Create a Supabase project.
2. Run supabase-schema.sql in Supabase SQL Editor.
3. Paste the Project URL and anon key into config.js.
4. Open manage-nievune.html BEFORE publishing the store publicly.
5. Create your owner account.
6. Confirm the email if Supabase asks for confirmation.
7. Sign in again. The first account claims the owner role.
8. After that, other accounts cannot manage the store.

STARTER PRODUCTS
- Zigzag Chat
- Minimalist Widget Chat
- Minimalist Notification
- Minimalist Chat & Notification

LINKS TO ADD LATER
Each product has these fields in the private manager:
- Checkout URL
- Video URL
- Preview image URL

SECURITY
- Do not remove Row Level Security from Supabase.
- Do not publish a service-role key in config.js.
- Use only the public anon key in config.js.
