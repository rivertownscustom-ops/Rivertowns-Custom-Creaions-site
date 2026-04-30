require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const PORT = Number(process.env.PORT || 3000);
const SLICES_PICKUP_FEE = 1;
const HOUSE_DELIVERY_FEE = 5;
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "http://localhost:8000";
const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || "mug-images";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "";
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO || "";

const PRODUCT_CATALOG = {
  "sig-mug": { name: "Custom Photo Mug", unitPrice: 16.99 },
  "wood-frame": { name: "Wood Frame", unitPrice: 25 },
  "metal-frame": { name: "Metal Print Frame", unitPrice: 48 },
  "fridge-magnet": { name: "Fridge Magnets", unitPrice: 10 },
  "cork-coast": { name: "Custom Coaster", unitPrice: 7 },
};

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

const app = express();

app.use(
  cors({
    origin: true,
  }),
);

app.get("/", (_request, response) => {
  response.type("text/plain").send("Rivertowns Custom Creations backend is running.");
});

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    stripeConfigured: Boolean(stripe),
    supabaseConfigured: Boolean(supabase),
    emailConfigured: Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL),
  });
});

app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      response.status(500).json({ error: "Stripe webhook is not configured yet." });
      return;
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        request.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (error) {
      response.status(400).send(`Webhook signature check failed: ${error.message}`);
      return;
    }

    if (event.type === "checkout.session.completed" && supabase) {
      const session = event.data.object;
      await supabase
        .from("orders")
        .update({
          payment_status: "paid",
          stripe_payment_intent_id: session.payment_intent || null,
        })
        .eq("stripe_checkout_session_id", session.id);

      try {
        await sendConfirmationEmailForSession(session);
      } catch (error) {
        console.error("Confirmation email failed", error);
      }
    }

    response.json({ received: true });
  },
);

app.use(express.json({ limit: "25mb" }));

function getProductDefinition(productId) {
  return PRODUCT_CATALOG[String(productId || "").trim()] || null;
}

function getOrderDelivery(item) {
  const deliveryOption = item.deliveryLabel === "Delivery to house" ? "house" : "slices";
  return {
    deliveryOption,
    deliveryFee: deliveryOption === "house" ? HOUSE_DELIVERY_FEE : SLICES_PICKUP_FEE,
    address: deliveryOption === "house" ? String(item.address || "").trim() || null : null,
  };
}

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function buildNormalizedOrder(rawItem, orderDelivery, itemIndex) {
  const product = getProductDefinition(rawItem.productId);

  if (!product) {
    throw new Error(`Unknown product: ${rawItem.productId || "missing"}`);
  }

  const quantity = Math.max(1, Number(rawItem.quantity || 1));
  const unitPriceCents = toCents(product.unitPrice);
  const deliveryFeeCents = itemIndex === 0 ? toCents(orderDelivery.deliveryFee) : 0;
  const itemSubtotalCents = unitPriceCents * quantity;

  return {
    product_id: String(rawItem.productId).trim(),
    product_name: product.name,
    unit_price: unitPriceCents,
    customer_name: String(rawItem.customerName || "").trim(),
    contact_info: String(rawItem.contactInfo || "").trim(),
    quantity,
    delivery_option: orderDelivery.deliveryOption,
    delivery_fee: deliveryFeeCents,
    total_amount: itemSubtotalCents + deliveryFeeCents,
    address: itemIndex === 0 ? orderDelivery.address : null,
    notes: String(rawItem.notes || "").trim() || null,
    image_name: String(rawItem.imageName || "").trim() || null,
    image_data_url: null,
    image_storage_path: null,
    image_public_url: null,
  };
}

function getFileExtension(fileName, mimeType) {
  const fileExtension = String(fileName || "").split(".").pop();

  if (fileExtension && fileExtension !== fileName) {
    return fileExtension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  }

  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function uploadOrderImage(rawItem, sessionId, itemIndex) {
  if (!supabase) {
    return {};
  }

  const parsedImage = parseImageDataUrl(rawItem.imageDataUrl);

  if (!parsedImage) {
    return {};
  }

  const extension = getFileExtension(rawItem.imageName, parsedImage.mimeType);
  const productSlug = String(rawItem.productId || `item-${itemIndex + 1}`)
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
  const filePath = `${sessionId}/${productSlug}-${itemIndex + 1}.${extension}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(filePath, parsedImage.buffer, {
    contentType: parsedImage.mimeType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase image upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(filePath);

  return {
    image_storage_path: filePath,
    image_public_url: data.publicUrl || null,
  };
}

function formatCurrencyFromCents(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((amount || 0) / 100);
}

function formatDeliveryOption(option) {
  return option === "house" ? "Delivery to house" : "Pick up at Slices";
}

function buildOrderEmailHtml(session, orders) {
  const firstOrder = orders[0];
  const itemRows = orders
    .map((order, index) => {
      const imageLink = order.image_public_url
        ? `<p><a href="${order.image_public_url}">View uploaded image</a></p>`
        : "";

      return `
        <li>
          <strong>${order.product_name || `Item ${index + 1}`}</strong><br />
          Quantity: ${order.quantity}<br />
          ${order.notes ? `Notes: ${order.notes}<br />` : ""}
          ${imageLink}
        </li>
      `;
    })
    .join("");

  const addressLine = firstOrder.address
    ? `<p><strong>Address:</strong> ${firstOrder.address}</p>`
    : "";

  return `
    <h1>Thanks for your order!</h1>
    <p>We received your Rivertowns Custom Creations order.</p>
    <p><strong>Customer:</strong> ${firstOrder.customer_name}</p>
    <p><strong>Delivery:</strong> ${formatDeliveryOption(firstOrder.delivery_option)}</p>
    ${addressLine}
    <p><strong>Total paid:</strong> ${formatCurrencyFromCents(session.amount_total)}</p>
    <h2>Items</h2>
    <ul>${itemRows}</ul>
  `;
}

function buildOrderEmailText(session, orders) {
  const firstOrder = orders[0];
  const lines = [
    "Thanks for your order!",
    "We received your Rivertowns Custom Creations order.",
    `Customer: ${firstOrder.customer_name}`,
    `Delivery: ${formatDeliveryOption(firstOrder.delivery_option)}`,
  ];

  if (firstOrder.address) {
    lines.push(`Address: ${firstOrder.address}`);
  }

  lines.push(`Total paid: ${formatCurrencyFromCents(session.amount_total)}`);
  lines.push("Items:");

  orders.forEach((order) => {
    lines.push(`${order.product_name}`);
    lines.push(`Quantity: ${order.quantity}`);

    if (order.notes) {
      lines.push(`Notes: ${order.notes}`);
    }

    if (order.image_public_url) {
      lines.push(`Uploaded image: ${order.image_public_url}`);
    }
  });

  return lines.join("\n");
}

async function sendConfirmationEmailForSession(session) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !supabase) {
    return;
  }

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("stripe_checkout_session_id", session.id)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Supabase order lookup failed: ${error.message}`);
  }

  if (!orders || orders.length === 0 || orders[0].confirmation_email_sent_at) {
    return;
  }

  const toEmail = session.customer_email || orders[0].contact_info;

  if (!toEmail) {
    return;
  }

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [toEmail],
      reply_to: RESEND_REPLY_TO || undefined,
      subject: "Your Rivertowns Custom Creations order",
      html: buildOrderEmailHtml(session, orders),
      text: buildOrderEmailText(session, orders),
    }),
  });

  if (!emailResponse.ok) {
    throw new Error(`Resend email failed: ${await emailResponse.text()}`);
  }

  await supabase
    .from("orders")
    .update({ confirmation_email_sent_at: new Date().toISOString() })
    .eq("stripe_checkout_session_id", session.id);
}

app.post("/api/create-checkout-session", async (request, response) => {
  try {
    if (!stripe) {
      response.status(500).json({ error: "Stripe is not configured yet." });
      return;
    }

    const items = Array.isArray(request.body.items) ? request.body.items : [];

    if (items.length === 0) {
      response.status(400).json({ error: "Cart is empty." });
      return;
    }

    const orderDelivery = getOrderDelivery(items[0]);
    const normalizedItems = items.map((item, index) => buildNormalizedOrder(item, orderDelivery, index));
    const firstOrder = normalizedItems[0];

    if (!firstOrder.customer_name || !firstOrder.contact_info) {
      response.status(400).json({ error: "Customer name and email are required." });
      return;
    }

    const lineItems = normalizedItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: item.product_name,
          description: item.notes || `${item.product_name} order`,
        },
        unit_amount: item.unit_price,
      },
      quantity: item.quantity,
    }));

    const orderDeliveryFeeCents = toCents(orderDelivery.deliveryFee);

    if (orderDeliveryFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: orderDelivery.deliveryOption === "house" ? "Delivery to house" : "Pick up at Slices",
          },
          unit_amount: orderDeliveryFeeCents,
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${PUBLIC_SITE_URL}/success.html`,
      cancel_url: `${PUBLIC_SITE_URL}/cancel.html`,
      customer_email: firstOrder.contact_info,
      metadata: {
        customer_name: firstOrder.customer_name,
        contact_info: firstOrder.contact_info,
      },
    });

    if (supabase) {
      const rows = [];
      for (const [index, item] of normalizedItems.entries()) {
        const imageFields = await uploadOrderImage(items[index], session.id, index);
        rows.push({
          ...item,
          ...imageFields,
          stripe_checkout_session_id: session.id,
          payment_status: "pending",
        });
      }

      const { error } = await supabase.from("orders").insert(rows);
      if (error) {
        throw new Error(`Supabase insert failed: ${error.message}`);
      }
    }

    response.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session error", error);
    response.status(500).json({ error: error.message || "Could not create checkout session." });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
