const BASE_MUG_PRICE = 20;
const SLICES_PICKUP_FEE = 1;
const HOUSE_DELIVERY_FEE = 5;
const DEFAULT_SUMMARY_TEXT = "Fill out the form and the finished order details will appear here.";
const BACKEND_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://zevs-custom-creations-backend.onrender.com";

const cart = [];

const customMugProduct = document.getElementById("customMugProduct");
const openCartButton = document.getElementById("openCartButton");
const cartCount = document.getElementById("cartCount");
const cartModal = document.getElementById("cartModal");
const closeCartModalButton = document.getElementById("closeCartModal");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const payButton = document.getElementById("payButton");
const shopModal = document.getElementById("shopModal");
const closeShopModalButton = document.getElementById("closeShopModal");
const orderForm = document.getElementById("orderForm");
const imageUpload = document.getElementById("imageUpload");
const mugPreviewImage = document.getElementById("mugPreviewImage");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const quantityInput = document.getElementById("quantity");
const cartDeliveryOption = document.getElementById("cartDeliveryOption");
const cartAddressField = document.getElementById("cartAddressField");
const cartAddressInput = document.getElementById("cartAddress");
const customerNameInput = document.getElementById("customerName");
const contactInfoInput = document.getElementById("contactInfo");
const orderNotesInput = document.getElementById("orderNotes");

const mugImageArea = document.querySelector(".mug-image-area");
const totalPrice = document.getElementById("totalPrice");
const quantityLabel = document.getElementById("quantityLabel");
const orderSummaryOutput = document.getElementById("orderSummaryOutput");

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getQuantity() {
  const parsed = Number(quantityInput.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getCartDeliveryFee() {
  if (cartDeliveryOption.value === "house") {
    return HOUSE_DELIVERY_FEE;
  }

  return SLICES_PICKUP_FEE;
}

function getCartDeliveryLabel() {
  if (cartDeliveryOption.value === "house") {
    return "Delivery to house";
  }
  return "Pick up at Slices";
}

function getCurrentTotal() {
  return BASE_MUG_PRICE * getQuantity();
}

function updatePricing() {
  const quantity = getQuantity();
  const total = getCurrentTotal();

  totalPrice.textContent = formatCurrency(total);
  quantityLabel.textContent = String(quantity);
}

function updateCartDeliveryState() {
  const needsAddress = cartDeliveryOption.value === "house";
  cartAddressField.classList.toggle("is-hidden", !needsAddress);
  cartAddressInput.required = needsAddress;
  cartAddressInput.disabled = !needsAddress;

  if (!needsAddress) {
    cartAddressInput.value = "";
  }
}

function setPageLock(isLocked) {
  document.body.style.overflow = isLocked ? "hidden" : "";
}

function openCustomizer() {
  shopModal.classList.remove("is-hidden");
  shopModal.setAttribute("aria-hidden", "false");
  customMugProduct.setAttribute("aria-expanded", "true");
  setPageLock(true);
}

function closeCustomizer() {
  shopModal.classList.add("is-hidden");
  shopModal.setAttribute("aria-hidden", "true");
  customMugProduct.setAttribute("aria-expanded", "false");
  if (cartModal.classList.contains("is-hidden")) {
    setPageLock(false);
  }
  customMugProduct.focus();
}

function openCart() {
  cartModal.classList.remove("is-hidden");
  cartModal.setAttribute("aria-hidden", "false");
  openCartButton.setAttribute("aria-expanded", "true");
  setPageLock(true);
}

function closeCart() {
  cartModal.classList.add("is-hidden");
  cartModal.setAttribute("aria-hidden", "true");
  openCartButton.setAttribute("aria-expanded", "false");
  if (shopModal.classList.contains("is-hidden")) {
    setPageLock(false);
  }
  openCartButton.focus();
}

function setPreviewDimensions(width, height) {
  if (!width || !height) {
    mugPreviewImage.style.removeProperty("--preview-width");
    mugPreviewImage.style.removeProperty("--preview-height");
    return;
  }

  const aspectRatio = width / height;

  if (aspectRatio >= 1) {
    mugPreviewImage.style.setProperty("--preview-width", "92%");
    mugPreviewImage.style.setProperty("--preview-height", `${Math.min(84, 92 / aspectRatio)}%`);
    return;
  }

  mugPreviewImage.style.setProperty("--preview-width", `${Math.min(78, aspectRatio * 88)}%`);
  mugPreviewImage.style.setProperty("--preview-height", "92%");
}

function loadPreviewImage(file) {
  if (!file) {
    mugPreviewImage.removeAttribute("src");
    mugImageArea.classList.remove("has-image");
    previewPlaceholder.textContent = "Your uploaded image will appear here.";
    setPreviewDimensions();
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    mugPreviewImage.src = reader.result;
    mugImageArea.classList.add("has-image");
  });
  reader.readAsDataURL(file);
}

mugPreviewImage.addEventListener("load", () => {
  setPreviewDimensions(mugPreviewImage.naturalWidth, mugPreviewImage.naturalHeight);
});

function buildOrderSummary(item) {
  const lines = [
    `Customer: ${item.customerName}`,
    `Contact: ${item.contactInfo}`,
    `Product: ${item.productName}`,
    `Quantity: ${item.quantity}`,
    `Base price: ${formatCurrency(BASE_MUG_PRICE)} each`,
    `Delivery option: ${item.deliveryLabel}`,
    `Delivery fee: ${formatCurrency(item.deliveryFee)}`,
    `Total: ${formatCurrency(item.total)}`,
  ];

  if (item.deliveryLabel === "Delivery to house" && item.address) {
    lines.push(`Delivery address: ${item.address}`);
  }

  if (item.notes) {
    lines.push(`Notes: ${item.notes}`);
  }

  lines.push("Image uploaded: Yes");

  return lines.join("\n");
}

function renderCart() {
  cartCount.textContent = String(cart.length);
  payButton.disabled = cart.length === 0;

  if (cart.length === 0) {
    cartItems.textContent = "Your cart is empty.";
    cartTotal.textContent = formatCurrency(0);
    return;
  }

  const currentDeliveryLabel = getCartDeliveryLabel();
  const currentAddress = cartAddressInput.value.trim();

  const markup = cart
    .map((item, index) => {
      const addressLine = currentDeliveryLabel === "Delivery to house" && currentAddress ? `<p><strong>Address:</strong> ${currentAddress}</p>` : "";
      const notesLine = item.notes ? `<p><strong>Notes:</strong> ${item.notes}</p>` : "";
      const previewMarkup = item.previewImageSrc
        ? `<div class="cart-item-preview"><img src="${item.previewImageSrc}" alt="Preview of customized mug image" /></div>`
        : "";
      return `
        <article class="cart-item">
          ${previewMarkup}
          <div class="cart-item-copy">
            <h3>${index + 1}. ${item.productName}</h3>
            <p><strong>Customer:</strong> ${item.customerName}</p>
            <p><strong>Contact:</strong> ${item.contactInfo}</p>
            <p><strong>Quantity:</strong> ${item.quantity}</p>
            <p><strong>Delivery:</strong> ${currentDeliveryLabel}</p>
            ${addressLine}
            ${notesLine}
            <p><strong>Item total:</strong> ${formatCurrency(item.total)}</p>
          </div>
        </article>
      `;
    })
    .join("");

  cartItems.innerHTML = markup;
  const itemsTotal = cart.reduce((sum, item) => sum + item.total, 0);
  cartTotal.textContent = formatCurrency(itemsTotal + getCartDeliveryFee());
}

function resetCustomizerForm() {
  orderForm.reset();
  quantityInput.value = "1";
  updatePricing();
  loadPreviewImage(null);
  orderSummaryOutput.textContent = DEFAULT_SUMMARY_TEXT;
}

imageUpload.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  loadPreviewImage(file);
});

cartDeliveryOption.addEventListener("change", () => {
  updateCartDeliveryState();
  renderCart();
});

cartAddressInput.addEventListener("input", renderCart);
quantityInput.addEventListener("input", updatePricing);

orderForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!imageUpload.files || imageUpload.files.length === 0) {
    orderSummaryOutput.textContent = "Upload an image before adding this mug to the cart.";
    return;
  }

  const item = {
    productName: "Custom Mug",
    customerName: customerNameInput.value.trim(),
    contactInfo: contactInfoInput.value.trim(),
    quantity: getQuantity(),
    deliveryLabel: "Choose at cart",
    deliveryFee: 0,
    total: getCurrentTotal(),
    address: "",
    notes: orderNotesInput.value.trim(),
    imageName: imageUpload.files[0].name,
    imageDataUrl: mugPreviewImage.getAttribute("src") || "",
    previewImageSrc: mugPreviewImage.getAttribute("src") || "",
  };

  orderSummaryOutput.textContent = buildOrderSummary(item);
  cart.push(item);
  renderCart();
  closeCustomizer();
  openCart();
  resetCustomizerForm();
});

customMugProduct.addEventListener("click", openCustomizer);
customMugProduct.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openCustomizer();
  }
});

openCartButton.addEventListener("click", openCart);
closeShopModalButton.addEventListener("click", closeCustomizer);
closeCartModalButton.addEventListener("click", closeCart);

shopModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeModal === "true") {
    closeCustomizer();
  }
});

cartModal.addEventListener("click", (event) => {
  if (event.target.dataset.closeCart === "true") {
    closeCart();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (!shopModal.classList.contains("is-hidden")) {
    closeCustomizer();
    return;
  }

  if (!cartModal.classList.contains("is-hidden")) {
    closeCart();
  }
});

updateCartDeliveryState();
updatePricing();
renderCart();
orderSummaryOutput.textContent = DEFAULT_SUMMARY_TEXT;


payButton.addEventListener("click", async () => {
  if (cart.length === 0) {
    cartItems.textContent = "Your cart is empty.";
    return;
  }

  if (cartDeliveryOption.value === "house" && !cartAddressInput.value.trim()) {
    cartItems.textContent = "Enter a delivery address before paying.";
    return;
  }

  if (BACKEND_BASE_URL.includes("replace-with-your-render-backend")) {
    cartItems.textContent =
      "Set your Render backend URL in zevs-custom-creations.js before using Pay.";
    return;
  }

  payButton.disabled = true;

  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/create-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: cart.map((item) => ({
          ...item,
          deliveryLabel: getCartDeliveryLabel(),
          deliveryFee: getCartDeliveryFee(),
          address: cartAddressInput.value.trim(),
          total: item.total + getCartDeliveryFee(),
          imageName: item.imageName || "uploaded-image",
          imageDataUrl: item.imageDataUrl || "",
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.url) {
      throw new Error(data.error || "Could not create checkout session.");
    }

    window.location.href = data.url;
  } catch (error) {
    cartItems.textContent = error.message;
    payButton.disabled = false;
  }
});
