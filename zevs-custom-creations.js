const BACKEND_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://rivertowns-custom-creations-backend.onrender.com";

const DELIVERY_FEES = {
  slices: 1,
  house: 5,
};

const PRODUCTS = [
  {
    id: "sig-mug",
    category: "drinkware",
    name: "Custom Photo Mug",
    price: 20,
    badge: "Best seller",
    tagline: "Classic ceramic · 11 oz",
    heroImage: "assets/mug-family.png",
    render: "mug",
  },
  {
    id: "wood-frame",
    category: "frames",
    name: "Wood Frame",
    price: 25,
    badge: "New",
    tagline: "Solid maple · 12x16",
    heroImage: "assets/wood-frame.png",
    render: "woodframe",
  },
  {
    id: "metal-frame",
    category: "frames",
    name: "Metal Print Frame",
    price: 48,
    badge: "Premium",
    tagline: "Brushed aluminum · 8x10",
    render: "frame",
  },
  {
    id: "fridge-magnet",
    category: "gifts",
    name: "Fridge Magnets",
    price: 10,
    badge: "Set of 4",
    tagline: "Square magnets · set of 4",
    render: "magnet",
  },
  {
    id: "cork-coast",
    category: "gifts",
    name: "Custom Coaster",
    price: 7,
    badge: "Fast gift",
    tagline: "Cork coaster · single",
    render: "coaster",
  },
];

const state = {
  activeProductId: PRODUCTS[0].id,
  quantity: 1,
  artwork: null,
  artworkName: "",
  itemNotes: "",
  deliveryOption: "slices",
  cart: JSON.parse(localStorage.getItem("rtc_cart") || "[]"),
  filter: "all",
};

const overlay = document.getElementById("overlay");
const productGrid = document.getElementById("productGrid");
const cartCount = document.getElementById("cartCount");
const customizer = document.getElementById("customizer");
const cartDrawer = document.getElementById("cartDrawer");
const checkoutModal = document.getElementById("checkoutModal");
const cartBody = document.getElementById("cartBody");
const cartTotals = document.getElementById("cartTotals");
const checkoutTotals = document.getElementById("checkoutTotals");
const shipNote = document.getElementById("shipNote");
const openCartButton = document.getElementById("openCart");
const openCheckoutButton = document.getElementById("openCheckout");
const addToCartButton = document.getElementById("addToCart");
const placeOrderButton = document.getElementById("placeOrder");
const fileInput = document.getElementById("fileInput");
const uploadZone = document.getElementById("uploadZone");
const uploadPreview = document.getElementById("uploadPreview");
const uploadThumb = document.getElementById("uploadThumb");
const uploadName = document.getElementById("uploadName");
const uploadRemove = document.getElementById("uploadRemove");
const qtyInput = document.getElementById("qtyInput");
const qtyUp = document.getElementById("qtyUp");
const qtyDown = document.getElementById("qtyDown");
const livePrice = document.getElementById("livePrice");
const liveUnit = document.getElementById("liveUnit");
const custTitle = document.getElementById("custTitle");
const custSubtitle = document.getElementById("custSubtitle");
const itemNotesInput = document.getElementById("itemNotes");
const toastEl = document.getElementById("toast");
const toastMsg = document.getElementById("toastMsg");
const deliveryOptionSelect = document.getElementById("deliveryOption");
const checkoutDeliveryOption = document.getElementById("checkoutDeliveryOption");
const addressField = document.getElementById("addressField");
const checkoutAddress = document.getElementById("checkoutAddress");
const checkoutEmail = document.getElementById("checkoutEmail");
const checkoutFirstName = document.getElementById("checkoutFirstName");
const checkoutLastName = document.getElementById("checkoutLastName");
const canvas = document.getElementById("productCanvas");
const ctx = canvas.getContext("2d");

const mugBlank = new Image();
mugBlank.src = "assets/mug-blank.png";
const woodFrameBlank = new Image();
woodFrameBlank.src = "assets/wood-frame-blank.png";

let artworkImage = null;
let toastTimer = null;

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getProduct(productId = state.activeProductId) {
  return PRODUCTS.find((product) => product.id === productId) || PRODUCTS[0];
}

function getDeliveryFee(option = state.deliveryOption) {
  return DELIVERY_FEES[option] || DELIVERY_FEES.slices;
}

function getDeliveryLabel(option = state.deliveryOption) {
  return option === "house" ? "Delivery to house" : "Pick up at Slices";
}

function setBodyLock(isLocked) {
  document.body.style.overflow = isLocked ? "hidden" : "";
}

function showToast(message) {
  toastMsg.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function saveCart() {
  localStorage.setItem("rtc_cart", JSON.stringify(state.cart));
}

function getCartSubtotal() {
  return state.cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

function getCartTotal() {
  if (state.cart.length === 0) {
    return 0;
  }
  return getCartSubtotal() + getDeliveryFee();
}

function updateCartCount() {
  const quantity = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  cartCount.textContent = String(quantity);
}

function renderGrid() {
  const filtered = PRODUCTS.filter(
    (product) => state.filter === "all" || product.category === state.filter,
  );

  productGrid.innerHTML = filtered
    .map((product) => {
      const media = product.heroImage
        ? `<div class="ph image-panel"><img src="${product.heroImage}" alt="${product.name}" /></div>`
        : `<div class="ph simple-graphic ${product.render === "coaster" ? "cream" : product.render === "magnet" ? "amber" : ""}"><span>${product.name}</span></div>`;

      return `
        <article class="card">
          <div class="card-media">
            ${product.badge ? `<span class="card-badge">${product.badge}</span>` : ""}
            ${media}
          </div>
          <div class="card-body">
            <div class="card-title">
              <h3>${product.name}</h3>
              <span>${formatCurrency(product.price)}</span>
            </div>
            <div class="card-meta">${product.tagline}</div>
            <div class="card-foot">
              <button class="btn btn-primary" type="button" data-open-product="${product.id}">Customize</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateCustomizerPrice() {
  const product = getProduct();
  const total = product.price * state.quantity;
  livePrice.textContent = formatCurrency(total);
  liveUnit.textContent = state.quantity > 1 ? `/ ${state.quantity} items` : "/ 1 item";
  qtyInput.value = String(state.quantity);
}

function resetCustomizerState() {
  state.quantity = 1;
  state.artwork = null;
  state.artworkName = "";
  state.itemNotes = "";
  artworkImage = null;
  itemNotesInput.value = "";
  fileInput.value = "";
  uploadPreview.classList.remove("shown");
  updateCustomizerPrice();
  drawPreview();
}

function openCustomizer(productId) {
  const product = getProduct(productId);
  state.activeProductId = product.id;
  custTitle.textContent = `Customize your ${product.name.toLowerCase()}`;
  custSubtitle.textContent = product.tagline;
  resetCustomizerState();
  overlay.classList.add("open");
  customizer.classList.add("open");
  customizer.setAttribute("aria-hidden", "false");
  setBodyLock(true);
}

function closeCustomizer() {
  customizer.classList.remove("open");
  customizer.setAttribute("aria-hidden", "true");
  if (!cartDrawer.classList.contains("open") && !checkoutModal.classList.contains("open")) {
    overlay.classList.remove("open");
    setBodyLock(false);
  }
}

function openCart() {
  overlay.classList.add("open");
  cartDrawer.classList.add("open");
  setBodyLock(true);
}

function closeCart() {
  cartDrawer.classList.remove("open");
  if (!customizer.classList.contains("open") && !checkoutModal.classList.contains("open")) {
    overlay.classList.remove("open");
    setBodyLock(false);
  }
}

function openCheckout() {
  checkoutDeliveryOption.value = state.deliveryOption;
  updateCheckoutDeliveryState();
  renderCheckoutTotals();
  overlay.classList.add("open");
  checkoutModal.classList.add("open");
  checkoutModal.setAttribute("aria-hidden", "false");
  setBodyLock(true);
}

function closeCheckout() {
  checkoutModal.classList.remove("open");
  checkoutModal.setAttribute("aria-hidden", "true");
  if (!customizer.classList.contains("open") && !cartDrawer.classList.contains("open")) {
    overlay.classList.remove("open");
    setBodyLock(false);
  }
}

function updateCheckoutDeliveryState() {
  const needsAddress = checkoutDeliveryOption.value === "house";
  addressField.classList.toggle("is-hidden", !needsAddress);
  checkoutAddress.required = needsAddress;
  if (!needsAddress) {
    checkoutAddress.value = "";
  }
}

function renderCart() {
  updateCartCount();
  saveCart();

  if (state.cart.length === 0) {
    cartBody.innerHTML = '<div class="empty"><h3>Your cart is empty</h3><p>Pick a product to customize.</p></div>';
    cartTotals.innerHTML = "";
    openCheckoutButton.disabled = true;
    return;
  }

  cartBody.innerHTML = state.cart
    .map(
      (item) => `
        <article class="cart-item">
          <div class="cart-thumb">
            ${item.artwork ? `<img src="${item.artwork}" alt="${item.name} artwork" />` : `<span>${item.name}</span>`}
          </div>
          <div>
            <h4>${item.name}</h4>
            <div class="cart-meta">
              Quantity: ${item.quantity}<br />
              ${item.artworkName ? `Artwork: ${item.artworkName}<br />` : ""}
              ${item.notes ? `Notes: ${item.notes}` : "No notes"}
            </div>
          </div>
          <div class="cart-side">
            <span>${formatCurrency(item.unitPrice * item.quantity)}</span>
            <div class="qty-mini">
              <button type="button" data-qty-down="${item.lineId}">−</button>
              <span>${item.quantity}</span>
              <button type="button" data-qty-up="${item.lineId}">+</button>
            </div>
            <button class="remove-item" type="button" data-remove-item="${item.lineId}">remove</button>
          </div>
        </article>
      `,
    )
    .join("");

  cartTotals.innerHTML = `
    <div class="row"><span>Subtotal</span><span>${formatCurrency(getCartSubtotal())}</span></div>
    <div class="row"><span>${getDeliveryLabel()}</span><span>${formatCurrency(getDeliveryFee())}</span></div>
    <div class="row total"><span>Total</span><span>${formatCurrency(getCartTotal())}</span></div>
  `;
  shipNote.textContent = `${getDeliveryLabel()} is ${formatCurrency(getDeliveryFee())} per order.`;
  openCheckoutButton.disabled = false;
}

function renderCheckoutTotals() {
  checkoutTotals.innerHTML = `
    <div class="row"><span>Subtotal</span><span>${formatCurrency(getCartSubtotal())}</span></div>
    <div class="row"><span>${getDeliveryLabel(checkoutDeliveryOption.value)}</span><span>${formatCurrency(getDeliveryFee(checkoutDeliveryOption.value))}</span></div>
    <div class="row total"><span>Total</span><span>${formatCurrency(getCartSubtotal() + getDeliveryFee(checkoutDeliveryOption.value))}</span></div>
  `;
}

function addActiveProductToCart() {
  const product = getProduct();
  if (!state.artwork) {
    showToast("Upload artwork before adding to cart.");
    return;
  }

  const item = {
    lineId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product.id,
    productName: product.name,
    name: product.name,
    unitPrice: product.price,
    quantity: state.quantity,
    artwork: state.artwork,
    artworkName: state.artworkName,
    imageName: state.artworkName,
    imageDataUrl: state.artwork,
    notes: itemNotesInput.value.trim(),
  };

  state.cart.push(item);
  renderCart();
  closeCustomizer();
  openCart();
  showToast(`${product.name} added to cart`);
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Choose an image file.");
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.artwork = reader.result;
    state.artworkName = file.name;
    const image = new Image();
    image.onload = () => {
      artworkImage = image;
      drawPreview();
    };
    image.src = reader.result;
    uploadThumb.src = reader.result;
    uploadName.textContent = file.name;
    uploadPreview.classList.add("shown");
  });
  reader.readAsDataURL(file);
}

function clearArtwork() {
  state.artwork = null;
  state.artworkName = "";
  artworkImage = null;
  fileInput.value = "";
  uploadPreview.classList.remove("shown");
  drawPreview();
}

function drawMugPreview() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (mugBlank.complete && mugBlank.naturalWidth) {
    const ratio = mugBlank.naturalWidth / mugBlank.naturalHeight;
    const drawH = h * 0.95;
    const drawW = drawH * ratio;
    const dx = (w - drawW) / 2;
    const dy = (h - drawH) / 2;
    ctx.drawImage(mugBlank, dx, dy, drawW, drawH);
  }

  const frontX = w * 0.26;
  const frontY = h * 0.28;
  const frontW = w * 0.34;
  const frontH = h * 0.44;
  ctx.save();
  ctx.beginPath();
  ctx.rect(frontX, frontY, frontW, frontH);
  ctx.clip();

  if (artworkImage) {
    const ar = artworkImage.width / artworkImage.height;
    let drawW = frontW * 0.9;
    let drawH = drawW / ar;
    if (drawH > frontH * 0.9) {
      drawH = frontH * 0.9;
      drawW = drawH * ar;
    }
    ctx.drawImage(
      artworkImage,
      frontX + frontW / 2 - drawW / 2,
      frontY + frontH / 2 - drawH / 2,
      drawW,
      drawH,
    );
  } else {
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText("YOUR ART", frontX + frontW / 2, frontY + frontH * 0.46);
    ctx.font = 'italic 400 14px Georgia, serif';
    ctx.fillText("upload to preview", frontX + frontW / 2, frontY + frontH * 0.58);
  }

  ctx.restore();
}

function drawWoodFramePreview() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (woodFrameBlank.complete && woodFrameBlank.naturalWidth) {
    const ratio = woodFrameBlank.naturalWidth / woodFrameBlank.naturalHeight;
    let drawW = w * 0.92;
    let drawH = drawW / ratio;
    if (drawH > h * 0.92) {
      drawH = h * 0.92;
      drawW = drawH * ratio;
    }
    const dx = (w - drawW) / 2;
    const dy = (h - drawH) / 2;
    ctx.drawImage(woodFrameBlank, dx, dy, drawW, drawH);
    const frontX = dx + drawW * 0.1;
    const frontY = dy + drawH * 0.13;
    const frontW = drawW * 0.8;
    const frontH = drawH * 0.74;

    ctx.save();
    ctx.beginPath();
    ctx.rect(frontX, frontY, frontW, frontH);
    ctx.clip();

    if (artworkImage) {
      const ar = artworkImage.width / artworkImage.height;
      let drawInnerW = frontW * 0.92;
      let drawInnerH = drawInnerW / ar;
      if (drawInnerH > frontH * 0.92) {
        drawInnerH = frontH * 0.92;
        drawInnerW = drawInnerH * ar;
      }
      ctx.drawImage(
        artworkImage,
        frontX + frontW / 2 - drawInnerW / 2,
        frontY + frontH / 2 - drawInnerH / 2,
        drawInnerW,
        drawInnerH,
      );
    } else {
      ctx.fillStyle = "rgba(110,80,40,.18)";
      ctx.fillRect(frontX, frontY, frontW, frontH);
      ctx.fillStyle = "rgba(60,40,20,.45)";
      ctx.font = '600 30px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText("YOUR PHOTO", frontX + frontW / 2, frontY + frontH * 0.46);
      ctx.font = 'italic 400 24px Georgia, serif';
      ctx.fillText("upload to preview", frontX + frontW / 2, frontY + frontH * 0.58);
    }

    ctx.restore();
  }
}

function drawSimplePreview(label) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#efe6d0";
  ctx.fillRect(w * 0.18, h * 0.16, w * 0.64, h * 0.68);
  ctx.strokeStyle = "#d9cdb0";
  ctx.lineWidth = 4;
  ctx.strokeRect(w * 0.18, h * 0.16, w * 0.64, h * 0.68);

  if (artworkImage) {
    const ar = artworkImage.width / artworkImage.height;
    const boxW = w * 0.48;
    const boxH = h * 0.46;
    let drawW = boxW;
    let drawH = drawW / ar;
    if (drawH > boxH) {
      drawH = boxH;
      drawW = drawH * ar;
    }
    ctx.drawImage(artworkImage, w / 2 - drawW / 2, h / 2 - drawH / 2, drawW, drawH);
  } else {
    ctx.fillStyle = "rgba(21,19,17,.45)";
    ctx.font = 'italic 400 28px Georgia, serif';
    ctx.textAlign = "center";
    ctx.fillText(label, w / 2, h / 2);
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText("upload to preview", w / 2, h / 2 + 36);
  }
}

function drawPreview() {
  const product = getProduct();
  if (product.render === "mug") {
    drawMugPreview();
    return;
  }
  if (product.render === "woodframe") {
    drawWoodFramePreview();
    return;
  }
  if (product.render === "frame") {
    drawSimplePreview("Frame preview");
    return;
  }
  if (product.render === "magnet") {
    drawSimplePreview("Magnet preview");
    return;
  }
  drawSimplePreview("Coaster preview");
}

async function placeOrder() {
  if (state.cart.length === 0) {
    showToast("Your cart is empty.");
    return;
  }

  const email = checkoutEmail.value.trim();
  const firstName = checkoutFirstName.value.trim();
  const lastName = checkoutLastName.value.trim();
  const deliveryOption = checkoutDeliveryOption.value;
  const address = checkoutAddress.value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast("Enter a valid email.");
    return;
  }

  if (!firstName || !lastName) {
    showToast("Enter first and last name.");
    return;
  }

  if (deliveryOption === "house" && !address) {
    showToast("Enter a delivery address.");
    return;
  }

  placeOrderButton.disabled = true;

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: state.cart.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          notes: item.notes,
          imageName: item.imageName,
          imageDataUrl: item.imageDataUrl,
          customerName: `${firstName} ${lastName}`.trim(),
          contactInfo: email,
          deliveryLabel: getDeliveryLabel(deliveryOption),
          address,
        })),
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not create checkout session.");
    }

    if (!payload.url) {
      throw new Error("Checkout URL missing.");
    }

    window.location.href = payload.url;
  } catch (error) {
    showToast(error.message || "Checkout failed.");
  } finally {
    placeOrderButton.disabled = false;
  }
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach((chip) => chip.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    renderGrid();
  });
});

document.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open-product], [data-open]");
  if (openButton) {
    openCustomizer(openButton.dataset.openProduct || openButton.dataset.open);
    return;
  }

  if (event.target.closest("[data-close-modal]")) {
    closeCustomizer();
    closeCheckout();
    return;
  }

  if (event.target.closest("[data-close-cart]")) {
    closeCart();
    return;
  }

  const removeButton = event.target.closest("[data-remove-item]");
  if (removeButton) {
    state.cart = state.cart.filter((item) => item.lineId !== removeButton.dataset.removeItem);
    renderCart();
    return;
  }

  const plusButton = event.target.closest("[data-qty-up]");
  if (plusButton) {
    const item = state.cart.find((cartItem) => cartItem.lineId === plusButton.dataset.qtyUp);
    if (item) {
      item.quantity = Math.min(99, item.quantity + 1);
      renderCart();
    }
    return;
  }

  const minusButton = event.target.closest("[data-qty-down]");
  if (minusButton) {
    const item = state.cart.find((cartItem) => cartItem.lineId === minusButton.dataset.qtyDown);
    if (item) {
      item.quantity -= 1;
      if (item.quantity <= 0) {
        state.cart = state.cart.filter((cartItem) => cartItem.lineId !== minusButton.dataset.qtyDown);
      }
      renderCart();
    }
  }
});

overlay.addEventListener("click", () => {
  closeCustomizer();
  closeCart();
  closeCheckout();
  overlay.classList.remove("open");
  setBodyLock(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCustomizer();
    closeCart();
    closeCheckout();
    overlay.classList.remove("open");
    setBodyLock(false);
  }
});

openCartButton.addEventListener("click", openCart);
openCheckoutButton.addEventListener("click", () => {
  closeCart();
  openCheckout();
});
addToCartButton.addEventListener("click", addActiveProductToCart);
placeOrderButton.addEventListener("click", placeOrder);

deliveryOptionSelect.addEventListener("change", () => {
  state.deliveryOption = deliveryOptionSelect.value;
  renderCart();
});

checkoutDeliveryOption.addEventListener("change", () => {
  state.deliveryOption = checkoutDeliveryOption.value;
  deliveryOptionSelect.value = state.deliveryOption;
  updateCheckoutDeliveryState();
  renderCart();
  renderCheckoutTotals();
});

qtyUp.addEventListener("click", () => {
  state.quantity = Math.min(99, state.quantity + 1);
  updateCustomizerPrice();
});
qtyDown.addEventListener("click", () => {
  state.quantity = Math.max(1, state.quantity - 1);
  updateCustomizerPrice();
});

itemNotesInput.addEventListener("input", () => {
  state.itemNotes = itemNotesInput.value;
});

uploadZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadZone.classList.add("dragover");
});
uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("dragover"));
uploadZone.addEventListener("drop", (event) => {
  event.preventDefault();
  uploadZone.classList.remove("dragover");
  if (event.dataTransfer.files[0]) {
    handleFile(event.dataTransfer.files[0]);
  }
});
fileInput.addEventListener("change", (event) => {
  if (event.target.files[0]) {
    handleFile(event.target.files[0]);
  }
});
uploadRemove.addEventListener("click", clearArtwork);

mugBlank.onload = drawPreview;
woodFrameBlank.onload = drawPreview;

renderGrid();
renderCart();
updateCustomizerPrice();
updateCheckoutDeliveryState();
drawPreview();
