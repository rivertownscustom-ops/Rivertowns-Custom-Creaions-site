require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const PORT = Number(process.env.PORT || 3000);
const BASE_MUG_PRICE = 20;
const SLICES_PICKUP_FEE = 1;
const HOUSE_DELIVERY_FEE = 5;
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "http://localhost:8000";
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

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    stripeConfigured: Boolean(stripe),
    supabaseConfigured: Boolean(supabase),
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
      const updateData = {
        payment_status: "paid",
        stripe_payment_intent_id: session.payment_intent || null,
      };

      await supabase
        .from("orders")
        .update(updateData)
        .eq("stripe_checkout_session_id", session.id);
    }

    response.json({ received: true });
  },
);

app.use(express.json({ limit: "10mb" }));

function getOrderDelivery(item) {
  const deliveryOption = item.deliveryLabel === "Delivery to house" ? "house" : "slices";
  const deliveryFee = deliveryOption === "house" ? HOUSE_DELIVERY_FEE : SLICES_PICKUP_FEE;

  return {
    deliveryOption,
    deliveryFee,
    address: deliveryOption === "house" ? String(item.address || "").trim() || null : null,
  };
}

function calculateOrder(item, orderDelivery) {
  const quantity = Math.max(1, Number(item.quantity || 1));
  const totalAmount = BASE_MUG_PRICE * quantity + orderDelivery.deliveryFee;

  return {
    customer_name: String(item.customerName || "").trim(),
    contact_info: String(item.contactInfo || "").trim(),
    quantity,
    delivery_option: orderDelivery.deliveryOption,
    delivery_fee: orderDelivery.deliveryFee,
    total_amount: totalAmount,
    address: orderDelivery.address,
    notes: String(item.notes || "").trim() || null,
    image_name: String(item.imageName || "").trim() || null,
  };
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
    const normalizedItems = items.map((item) => calculateOrder(item, orderDelivery));
    const firstOrder = normalizedItems[0];

    if (!firstOrder.customer_name || !firstOrder.contact_info) {
      response.status(400).json({ error: "Customer name and email are required." });
      return;
    }

    const lineItems = [];

    for (const item of normalizedItems) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Custom Mug",
            description: item.notes || "Custom mug order",
          },
          unit_amount: BASE_MUG_PRICE * 100,
        },
        quantity: item.quantity,
      });

    }

    if (firstOrder.delivery_fee > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: firstOrder.delivery_option === "house" ? "Delivery to house" : "Pick up at Slices",
          },
          unit_amount: firstOrder.delivery_fee * 100,
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
      const rows = normalizedItems.map((item) => ({
        ...item,
        stripe_checkout_session_id: session.id,
        payment_status: "pending",
      }));

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
