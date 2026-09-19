# Rivertowns Custom: complete project handoff

Use this document as persistent context for a new Codex or ChatGPT account. The repository and live code are the source of truth when this document and older notes disagree.

## Owner intent and business

- Business name: **Rivertowns Custom** / **Rivertowns Custom Creations**.
- Public website: **https://rivertownscustom.com**.
- Contact and internal order email: **rivertownscustom@gmail.com**.
- Location: **Hastings-on-Hudson, New York**.
- The homepage describes it as a **youth-led local shop** making personalized mugs, wooden photo products, magnets, and gifts.
- Products are made using UV printing. Current customer-facing fulfillment promise is that an order should arrive within about two weeks.
- The likely practical business category is a small direct-to-consumer custom-products/e-commerce business. Do not assume a legal entity type; confirm whether it is a sole proprietorship, LLC, or another structure before giving legal or tax setup instructions.
- Sales-tax setup has been discussed but is not implemented in the checked-in code. Before selling broadly, confirm New York registration and configure Stripe Tax or equivalent with professional tax guidance.

## Repository and hosting

- Local repository: `/Users/elireuter/Documents/GitHub/Rivertowns-Custom-Creaions`
- GitHub remote: `https://github.com/rivertownscustom-ops/Rivertowns-Custom-Creaions-site.git`
- Main branch: `main`
- Frontend: static HTML, CSS, and vanilla JavaScript, primarily in `index.html`.
- Frontend hosting: Vercel is used for the public site/domain. There is no checked-in `vercel.json`; deployment is expected to use Vercel's default static-site behavior and the GitHub integration.
- Backend hosting: Render.
- Production backend URL: `https://rivertowns-custom-creations-backend.onrender.com`
- Backend entrypoint: `server/server.js`
- Backend start command: `npm start` from the `server` directory.
- Local frontend can be served with a simple static server. Local frontend requests use `http://127.0.0.1:3000` for the backend.
- Do not expose Stripe, Supabase service-role, Resend, or SMTP secrets in frontend code or documentation.

## Primary files

- `index.html`: homepage, navigation, product cards, canvas customizers, cart, checkout form, and almost all styling/scripts.
- `faq.html`: FAQ page.
- `success.html`: Stripe success page and pending-order summary display.
- `cancel.html`: Stripe cancellation page.
- `server/server.js`: Express API, trusted product prices, Stripe Checkout, Supabase persistence, image uploads, webhook handling.
- `server/orders-schema.sql`: base `public.orders` schema.
- `supabase/functions/hourly-order-summary-text/index.ts`: hosted Supabase Edge Function for paid-order notifications.
- `supabase/migrations/20260618_hosted_hourly_order_summary_text.sql`: queue table, cron, and Vault setup.
- `server/order-image-monitor.js`: older local Gmail/image-download monitor. Treat as legacy unless explicitly reviving it.
- `MOBILE-REDESIGN-TRIAL.md`: rollback note for the labeled mobile CSS trial block in `index.html`.
- `assets/`: product, logo, favicon, editor, and source images.

## Current product catalog

The frontend catalog and backend trusted catalog must always be updated together.

### Live products

1. **Custom Travel Mug**
   - Product ID: `sig-mug`
   - Price: **$16.99**
   - Description: **12 oz with lid**
   - Render mode: `mug`
   - Homepage image: `assets/mug-homepage.png`
   - Editor blank: `assets/mug-editor.png`
   - FAQ says the travel mug is food-safe.

2. **Custom Wooden Photo Frame**
   - Product ID: `wood-frame`
   - Price: **$27.99**
   - Description: **12 x 16 wood frame**
   - Intended visual proportion: **16:12 landscape (4:3)**.
   - Render mode: `woodframe`
   - Homepage/editor assets include `assets/wood-frame.png`, `assets/wood-frame-hero.png`, and `assets/wood-frame-editor.png`.
   - The user wants this product called “Custom Wooden Photo Frame.”
   - The wooden editor intentionally hides the generic mockup disclaimer.

3. **Custom Fridge or Locker Magnets**
   - Product ID: `fridge-magnet`
   - Size: **50 x 70 mm** (5:7 portrait proportion).
   - Price: **1 for $6; 2 or more for $5 each**.
   - Render mode: `magnet`
   - Homepage image: `assets/fridge-magnet-homepage.png`

### Coming soon / unavailable

- **Custom Coaster**, product ID `cork-coast`, displayed as coming soon and disabled.
- A `metal-frame` catalog entry also exists but is not a live homepage product.

### Important pricing rule

- The browser price is only presentation. `server/server.js` owns trusted prices and rejects unknown product IDs by rebuilding each line item from `PRODUCT_CATALOG`.
- Maximum total cart quantity is currently 10. The site tells customers to email for bulk orders over 10.
- README pricing is stale and must not be treated as current truth.

## Homepage content and design direction

- Current hero headline: **“Personalized products made with your image or design.”**
- Hero description explains that this is a youth-led Hastings-on-Hudson shop and that customers upload an image, order securely, and the shop handles the rest.
- Navigation includes Products, Trust, How it works, FAQs, and Cart.
- Products navigation scrolls to “Start here.” Trust scrolls to “Why order here.”
- Trust content includes:
  - Made in Hastings-on-Hudson, NY.
  - Custom proofs handled with care.
  - Most orders ready within 48 hours.
  - Secure checkout with Stripe.
- A separate mobile strip saying “Production within 48 hours” and “$5 flat shipping” was removed. A 48-hour trust card still exists on the homepage; do not confuse the two.
- “How it works” is a four-step section: choose a product, upload an image, checkout securely, and the shop receives/makes/ships the order.
- Visual language: warm cream backgrounds, dark brown/black text, terracotta accent, Fraunces display type, Inter body type, rounded cards, restrained editorial look.
- Preserve the established visual language rather than replacing it with a generic template.

## Mobile design requirements and recent work

Mobile/iPhone behavior has been the main design focus. The user prefers direct visual changes and frequently checks the live site on an iPhone.

- Header should remain visible and phone navigation buttons should be centered and usable.
- Product cards should show large product art that fits cleanly without covering product names/prices.
- All homepage product artwork should feel consistently sized, while respecting different proportions (especially the narrow 5:7 magnet).
- The product customizer should fill the iPhone screen, have no useless page/internal scrolling, and keep Quantity close to Add to cart.
- Extra vertical room should go to the live preview, not become blank space in the form.
- Opening a modal/drawer applies a `modal-locked` class to `html` and `body` to stop background scrolling.
- The mug has a mobile-only `mug-mode` and is anchored to the exact center of the preview.
- The mug should be centered and fairly large.
- The wooden product should fill most of the preview but must remain a true **16:12 / 4:3 landscape** shape. Never stretch or squash it to fill the area.
- Wooden placeholder copy is “UPLOAD YOUR PHOTO” and “then drag or pinch to adjust.”
- The editor supports moving and resizing uploaded artwork; preserve those interactions.
- A CSS section in `index.html` begins with `/* MOBILE REDESIGN TRIAL`. The trial can be rolled back by removing that CSS block, but current phone fixes may now depend on rules inside it. Review changes carefully instead of deleting it blindly.

## Customizer and cart behavior

- Product cards open a shared customizer modal.
- Canvas render modes draw each product and place uploaded artwork into the printable area.
- Wood and magnet artwork use crop/cover behavior with drag and zoom controls.
- Mug artwork uses contained placement on the mug printable area.
- Uploaded artwork is stored temporarily as a data URL in browser state/cart.
- Cart data is stored in `localStorage` under `rt_cart`.
- The pending success-page summary is stored under `rt_pending_order`.
- Cart items preserve product ID, name, quantity, unit price, artwork/name, and display metadata.
- The checkout form collects email, first/last name, delivery option, and address when house delivery is selected.

## Delivery and checkout rules

- Current visible checkout option is **Delivery to house**.
- House delivery fee: **$5**.
- Backend also recognizes “Delivery in person by Eli” and “Delivery in person by Zev,” both free, although these may not currently be shown in the frontend select.
- A legacy Slices pickup constant/formatter still exists in parts of the backend, but the active normalization currently maps unknown options to house delivery. Review before reintroducing pickup.
- Address is required for house delivery.
- Stripe Checkout runs in one-time payment mode.
- Success URL: `${PUBLIC_SITE_URL}/success.html`.
- Cancel URL: `${PUBLIC_SITE_URL}/cancel.html`.
- Customer email is passed to Stripe Checkout.
- Multi-item checkouts create one Stripe session but one Supabase `orders` row per cart item.
- The first row includes the delivery fee/address; subsequent rows in the same session do not duplicate that fee.

## Backend and environment variables

Render must provide these as appropriate:

- `PORT` (Render normally supplies this)
- `PUBLIC_SITE_URL` (should be the production site origin)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_IMAGE_BUCKET` (backend default: `mug-images`)
- `RESEND_API_KEY` (optional in the Express server; hosted Edge Function also supports Resend)
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO`

Do not copy secret values into source control. Confirm the exact configured Storage bucket name because the legacy local monitor uses `mug images`, while the active Express backend defaults to `mug-images`.

## Stripe flow

1. Frontend POSTs `{ items }` to `/api/create-checkout-session` on Render.
2. Backend normalizes product IDs, quantities, prices, delivery, customer data, and address.
3. Backend creates Stripe line items and a separate $5 house-delivery line when required.
4. Backend creates a Stripe Checkout Session.
5. Before payment completes, backend uploads customer images to Supabase Storage and inserts `pending` order rows keyed by the Stripe session ID.
6. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`.
7. Webhook verifies the Stripe signature, marks all rows with that session ID `paid`, stores the payment-intent ID, and triggers the hosted Supabase order-summary function.
8. The browser is redirected to `success.html` after payment.

The webhook URL configured in Stripe should be the Render backend URL plus `/api/stripe-webhook`.

## Supabase

- Project name: **Rivertowns-Custom-Creaions** (spelling in existing project/context).
- Project ID/reference: **`ejoyopfapvulkegsqfxb`**.
- Project URL: `https://ejoyopfapvulkegsqfxb.supabase.co`.
- Main table: `public.orders`.
- Order money fields (`unit_price`, `delivery_fee`, `total_amount`) are integer cents.
- Important fields include product/customer/delivery data, notes, image metadata/public URL, payment status, Stripe session/payment intent IDs, confirmation timestamp, and creation timestamp.
- Uploaded images are stored in Supabase Storage and public URLs are written to order rows.

## Paid-order notification automation

- Automation/task name: **Hourly Supabase Order Summary Text**.
- Automation ID: `hourly-supabase-order-summary-text`.
- It checks paid rows created during the previous America/New_York hour and groups them by `stripe_checkout_session_id`, so a multi-item checkout produces one order summary.
- If no paid orders are found, it should finish quietly with no notification.
- If Supabase is inactive or a query fails, Eli should receive a brief monitor-failure report.
- The hosted implementation is `supabase/functions/hourly-order-summary-text/index.ts`.
- It can process the previous hour or a specific Stripe session. The Stripe webhook immediately invokes it with `sessionId`, while `pg_cron` also invokes it hourly at minute 5.
- It writes deduplicated jobs to `public.hourly_order_summary_queue`, keyed by Stripe session ID.
- It sends an internal plain-text order email to Eli, with uploaded images attached, and sends a customer confirmation email when the contact field contains an email address.
- Queue statuses: `pending`, `sent`, or `failed`; failed jobs are retried on later runs.
- Customer wording should remain warm and ready to send, end with receipt within two weeks, avoid extra “Thanks again” closings, and never promise a later readiness update.
- Required internal summary includes customer, contact, human-readable delivery option, optional address, total, Stripe session, paid status, New York placed time, and all items with quantity, unit price, optional notes/image.
- Required customer message includes item summary, optional notes, delivery, optional address, total paid, acknowledgment of custom details/image when present, and the two-week expectation.

Supabase hosted notification configuration uses the service role for authorization. The migration expects Vault secrets for the project URL and service-role key. The Edge Function obtains Resend/from/internal recipient settings through `get_hourly_order_summary_mail_config` and/or Edge Function environment variables. Never expose these values.

## FAQ content

The current FAQ answers:

- High-quality family photos, pet photos, logos, team designs, drawings, and transparent PNGs work best.
- Custom Travel Mugs are food-safe: “Yes.”
- Bulk orders over 10 should email `rivertownscustom@gmail.com`.
- Products are made with a UV printer that places and cures colored ink resin.
- Location is Hastings-on-Hudson, NY.

Previously removed FAQ entries should not be restored without asking:

- “How fast is production? Most orders are ready within 48 hours.”
- “Can you help fix or crop my image? Yes. We'll make sure it fits nicely before printing.”

## Asset history and preferences

- Logo: `assets/rivertowns-logo-transparent.png`.
- Mug assets have been repeatedly refined. The desired travel mug is a normal white blank mug resembling the editor blank, with uploaded art on it, a transparent opening inside the handle, and no tan image background.
- Wood homepage art uses a family photo and should appear as a landscape 12 x 16 wooden photo product, not as a conventional picture frame border.
- Magnet art was changed to a 5 x 7/50 x 70 mm portrait product using a waterfall photo. Avoid beige fringes or accidental green/background artifacts.
- Product asset backgrounds should blend cleanly with their card backgrounds, but do not destructively edit source files without retaining a source version.

## Known issues and inconsistencies to review

- `README.md` is outdated (it still mentions a $20 mug, Slices pickup, and incomplete image storage).
- The backend catalog calls the wooden product `Custom Photo Frame`, while the frontend calls it `Custom Wooden Photo Frame`. Align these names when safe.
- The active backend bucket default (`mug-images`) differs from the legacy monitor bucket (`mug images`). Confirm the real Supabase bucket.
- The Express server contains older Resend confirmation helpers that are not called by the current webhook path; the Supabase Edge Function is the active notification system.
- The trust section still says most orders are ready within 48 hours, while customer order messages promise delivery within two weeks. Decide whether both promises are accurate.
- Checkout does not currently calculate or collect sales tax.
- CORS is currently permissive (`origin: true`). Restrict it to trusted production/local origins if practical.
- Product notes exist in backend/database/message templates, but the current checkout payload sends `notes: null`; there is no active customer notes field in the customizer.
- There is an unrelated untracked directory named ` Rivertowns-Custom-Creaions-site/` (leading space) in the local worktree. Do not delete or modify it without explicit permission.

## Safe change workflow for future AI work

1. Read `index.html` and the relevant backend file before changing behavior.
2. Preserve existing user changes and do not reset the working tree.
3. Update both frontend `PRODUCTS` and backend `PRODUCT_CATALOG` for any product/price change.
4. Keep prices authoritative on the server.
5. Test desktop and iPhone layouts, especially all three live customizers.
6. Verify the wood preview remains 4:3 landscape and the magnet remains 5:7 portrait.
7. Verify uploaded art still moves/zooms and exports correctly.
8. Verify cart persistence, checkout validation, Render API call, Stripe redirect, webhook, Supabase rows, and success page.
9. Run JavaScript syntax checks and `git diff --check` after edits.
10. Do not deploy, push, change Stripe/Supabase/Render/Vercel settings, or rotate secrets unless explicitly asked.

## Current owner communication preferences

- Use plain, non-technical wording unless technical detail is requested.
- Make requested changes directly rather than only suggesting them.
- Before removing or visually editing an image, confirm the exact unwanted area when the request is ambiguous.
- Mobile changes should not unintentionally alter desktop, and desktop changes should not unintentionally alter phone layouts.
- Keep explanations short and focus on what visibly changed and whether it was verified.
