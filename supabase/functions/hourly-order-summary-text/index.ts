import { createClient } from "npm:@supabase/supabase-js@2";

type OrderRow = {
  id: number;
  customer_name: string;
  contact_info: string;
  quantity: number;
  delivery_option: string;
  total_amount: number;
  address: string | null;
  notes: string | null;
  payment_status: string;
  stripe_checkout_session_id: string;
  created_at: string;
  image_public_url: string | null;
  product_name: string | null;
  unit_price: number | null;
};

type QueueRow = {
  stripe_checkout_session_id: string;
  customer_name: string;
  contact_info: string;
  internal_subject: string;
  internal_message: string;
  customer_message: string;
  delivery_target: string;
  delivery_status: "pending" | "sent" | "failed";
  delivery_attempt_count: number;
};

const ELI_NOTIFICATION_EMAIL =
  Deno.env.get("ELI_NOTIFICATION_EMAIL") || "rivertownscustom@gmail.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type MailConfig = {
  resend_api_key: string | null;
  resend_from_email: string | null;
  eli_notification_email: string | null;
};

type InvocationBody = {
  sessionId?: string;
  retryOnly?: boolean;
};

function formatCurrencyFromCents(amount: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number(amount || 0)) / 100);
}

function formatDeliveryOption(option: string | null | undefined) {
  if (option === "eli") return "Delivery in person by Eli";
  if (option === "zev") return "Delivery in person by Zev";
  if (option === "house") return "Delivery to house";
  return option || "Pick up at Slices";
}

function formatPlacedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function extractEmailAddress(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim() || null;
}

function formatProductName(value: string | null | undefined, fallbackLabel: string) {
  if (!value) return fallbackLabel;
  if (value === "Travel Mug") return "Custom Travel Mug";
  return value;
}

function getRequestApiKey(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return (
    bearerMatch?.[1]?.trim() ||
    request.headers.get("apikey")?.trim() ||
    null
  );
}

function isAuthorizedRequest(request: Request) {
  const requestApiKey = getRequestApiKey(request);
  return Boolean(
    requestApiKey &&
      SUPABASE_SERVICE_ROLE_KEY &&
      requestApiKey === SUPABASE_SERVICE_ROLE_KEY,
  );
}

function getCurrentHourStartInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date());

  const readPart = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  const timeZoneName = readPart("timeZoneName");
  const offsetMatch = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  const sign = offsetMatch?.[1] === "-" ? "-" : "+";
  const hourOffset = (offsetMatch?.[2] || "0").padStart(2, "0");
  const minuteOffset = (offsetMatch?.[3] || "00").padStart(2, "0");
  const offset = `${sign}${hourOffset}:${minuteOffset}`;

  return new Date(
    `${readPart("year")}-${readPart("month")}-${readPart("day")}T${readPart("hour")}:00:00${offset}`,
  );
}

function groupOrdersBySession(orders: OrderRow[]) {
  const grouped = new Map<string, OrderRow[]>();

  for (const order of orders) {
    if (!order.stripe_checkout_session_id) continue;
    const group = grouped.get(order.stripe_checkout_session_id) || [];
    group.push(order);
    grouped.set(order.stripe_checkout_session_id, group);
  }

  return grouped;
}

function buildInternalMessage(sessionId: string, orders: OrderRow[]) {
  const firstOrder = orders[0];
  const totalPaid = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0,
  );
  const lines = [
    "Hi Eli,",
    "",
    "A new paid order came in.",
    "",
    `Customer: ${firstOrder.customer_name}`,
    `Contact: ${firstOrder.contact_info}`,
    `Delivery: ${formatDeliveryOption(firstOrder.delivery_option)}`,
  ];

  if (firstOrder.address) {
    lines.push(`Address: ${firstOrder.address}`);
  }

  lines.push(`Total: ${formatCurrencyFromCents(totalPaid)}`);
  lines.push(`Stripe session: ${sessionId}`);
  lines.push(`Paid status: ${firstOrder.payment_status}`);
  lines.push(`Placed: ${formatPlacedAt(firstOrder.created_at)}`);
  lines.push("");
  lines.push("Items:");

  orders.forEach((order, index) => {
    const productName = formatProductName(
      order.product_name,
      `Item ${index + 1}`,
    );
    lines.push(
      `- ${order.quantity} x ${productName} - ${formatCurrencyFromCents(order.unit_price)}`,
    );

    if (order.notes) {
      lines.push(`  Notes: ${order.notes}`);
    }

    if (order.image_public_url) {
      lines.push(`  Image: ${order.image_public_url}`);
    }
  });

  return lines.join("\n");
}

function buildCustomerMessage(orders: OrderRow[]) {
  const firstOrder = orders[0];
  const totalPaid = orders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0,
  );
  const hasAnyNotes = orders.some((order) => Boolean(order.notes));
  const hasAnyImage = orders.some((order) => Boolean(order.image_public_url));
  const lines = [
    `Hi ${firstOrder.customer_name}, thanks so much for your Rivertowns Custom Creations order! We received your payment and your order is confirmed.`,
    "",
    "Order summary:",
  ];

  orders.forEach((order, index) => {
    lines.push(
      `- ${order.quantity} x ${formatProductName(order.product_name, `Item ${index + 1}`)}`,
    );
    if (order.notes) {
      lines.push(`Notes: ${order.notes}`);
    }
  });

  lines.push("");
  lines.push(`Delivery: ${formatDeliveryOption(firstOrder.delivery_option)}`);

  if (firstOrder.address) {
    lines.push(`Address: ${firstOrder.address}`);
  }

  lines.push(`Total paid: ${formatCurrencyFromCents(totalPaid)}`);
  lines.push("");

  if (hasAnyNotes && hasAnyImage) {
    lines.push("We received your custom details and uploaded image. You should receive your order within 2 weeks.");
  } else if (hasAnyNotes) {
    lines.push("We received your custom details. You should receive your order within 2 weeks.");
  } else if (hasAnyImage) {
    lines.push("We received your uploaded image. You should receive your order within 2 weeks.");
  } else {
    lines.push("You should receive your order within 2 weeks.");
  }

  return lines.join("\n");
}

async function enqueueOrders(orders: OrderRow[], metadata: Record<string, unknown>) {
  const mailConfig = await getMailConfig();
  const deliveryTarget =
    mailConfig.eli_notification_email || ELI_NOTIFICATION_EMAIL;

  const groupedOrders = groupOrdersBySession(orders);
  const sessionIds = [...groupedOrders.keys()];

  if (sessionIds.length === 0) {
    return {
      queuedSessions: [] as string[],
      queuedCount: 0,
      ...metadata,
    };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("hourly_order_summary_queue")
    .select("stripe_checkout_session_id")
    .in("stripe_checkout_session_id", sessionIds);

  if (existingError) {
    throw new Error(`Queue lookup failed: ${existingError.message}`);
  }

  const existingSessionIds = new Set(
    (existingRows || []).map((row: { stripe_checkout_session_id: string }) =>
      row.stripe_checkout_session_id
    ),
  );

  const inserts = sessionIds
    .filter((sessionId) => !existingSessionIds.has(sessionId))
    .map((sessionId) => {
      const grouped = groupedOrders.get(sessionId)!;
      const firstOrder = grouped[0];

      return {
        stripe_checkout_session_id: sessionId,
        customer_name: firstOrder.customer_name,
        contact_info: firstOrder.contact_info,
        delivery_option: formatDeliveryOption(firstOrder.delivery_option),
        address: firstOrder.address,
        total_amount: grouped.reduce(
          (sum, order) => sum + Number(order.total_amount || 0),
          0,
        ),
        payment_status: firstOrder.payment_status,
        placed_at: firstOrder.created_at,
        internal_subject: `New Rivertowns Custom Creations order - ${firstOrder.customer_name}`,
        internal_message: buildInternalMessage(sessionId, grouped),
        customer_message: buildCustomerMessage(grouped),
        delivery_target: deliveryTarget,
        delivery_status: "pending",
      };
    });

  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from("hourly_order_summary_queue")
      .insert(inserts);

    if (insertError) {
      throw new Error(`Queue insert failed: ${insertError.message}`);
    }
  }

  return {
    queuedSessions: inserts.map((entry) => entry.stripe_checkout_session_id),
    queuedCount: inserts.length,
    ...metadata,
  };
}

async function fetchPaidOrdersForPreviousHour() {
  const currentHourStart = getCurrentHourStartInTimeZone("America/New_York");
  const previousHourStart = new Date(currentHourStart.getTime() - 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,customer_name,contact_info,quantity,delivery_option,total_amount,address,notes,payment_status,stripe_checkout_session_id,created_at,image_public_url,product_name,unit_price",
    )
    .eq("payment_status", "paid")
    .gte("created_at", previousHourStart.toISOString())
    .lt("created_at", currentHourStart.toISOString())
    .not("stripe_checkout_session_id", "is", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Order lookup failed: ${error.message}`);
  }

  return {
    orders: (data || []) as OrderRow[],
    metadata: {
      previousHourStart: previousHourStart.toISOString(),
      currentHourStart: currentHourStart.toISOString(),
    },
  };
}

async function enqueuePreviousHourOrders() {
  const { orders, metadata } = await fetchPaidOrdersForPreviousHour();
  return enqueueOrders(orders, metadata);
}

async function enqueueSpecificSession(sessionId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,customer_name,contact_info,quantity,delivery_option,total_amount,address,notes,payment_status,stripe_checkout_session_id,created_at,image_public_url,product_name,unit_price",
    )
    .eq("payment_status", "paid")
    .eq("stripe_checkout_session_id", sessionId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Session order lookup failed: ${error.message}`);
  }

  return enqueueOrders((data || []) as OrderRow[], { sessionId });
}

async function sendPlainTextEmail(to: string, subject: string, text: string) {
  const mailConfig = await getMailConfig();
  const resendApiKey = mailConfig.resend_api_key || Deno.env.get("RESEND_API_KEY") || "";
  const resendFromEmail =
    mailConfig.resend_from_email || Deno.env.get("RESEND_FROM_EMAIL") || "";

  if (!resendApiKey || !resendFromEmail) {
    throw new Error(
      "Missing Resend configuration. Set resend_api_key and resend_from_email for the hosted order summary.",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend email failed: ${await response.text()}`);
  }
}

async function getMailConfig(): Promise<MailConfig> {
  const { data, error } = await supabase.rpc("get_hourly_order_summary_mail_config");

  if (error) {
    throw new Error(`Mail config lookup failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    resend_api_key: row?.resend_api_key || null,
    resend_from_email: row?.resend_from_email || null,
    eli_notification_email: row?.eli_notification_email || null,
  };
}

async function attemptQueuedDeliveries() {
  const { data, error } = await supabase
    .from("hourly_order_summary_queue")
    .select(
      "stripe_checkout_session_id,customer_name,contact_info,internal_subject,internal_message,customer_message,delivery_target,delivery_status,delivery_attempt_count",
    )
    .in("delivery_status", ["pending", "failed"])
    .order("placed_at", { ascending: true });

  if (error) {
    throw new Error(`Queue read failed: ${error.message}`);
  }

  const queuedRows = (data || []) as QueueRow[];
  const sentSessions: string[] = [];
  const failedSessions: { sessionId: string; error: string }[] = [];

  for (const row of queuedRows) {
    try {
      await sendPlainTextEmail(
        row.delivery_target,
        row.internal_subject,
        row.internal_message,
      );

      const customerEmail = extractEmailAddress(row.contact_info);

      if (customerEmail) {
        await sendPlainTextEmail(
          customerEmail,
          "Your Rivertowns Custom order is confirmed",
          row.customer_message,
        );
      }

      const { error: updateError } = await supabase
        .from("hourly_order_summary_queue")
        .update({
          delivery_status: "sent",
          delivery_attempt_count: Number(row.delivery_attempt_count || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: null,
          sent_at: new Date().toISOString(),
        })
        .eq("stripe_checkout_session_id", row.stripe_checkout_session_id);

      if (updateError) {
        throw new Error(`Queue sent-state update failed: ${updateError.message}`);
      }

      sentSessions.push(row.stripe_checkout_session_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await supabase
        .from("hourly_order_summary_queue")
        .update({
          delivery_status: "failed",
          delivery_attempt_count: Number(row.delivery_attempt_count || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: message,
        })
        .eq("stripe_checkout_session_id", row.stripe_checkout_session_id);

      failedSessions.push({
        sessionId: row.stripe_checkout_session_id,
        error: message,
      });
    }
  }

  return {
    queuedRows: queuedRows.length,
    sentSessions,
    failedSessions,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  if (!isAuthorizedRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = request.headers.get("Content-Type")?.includes("application/json")
      ? await request.json().catch(() => ({} as InvocationBody))
      : ({} as InvocationBody);
    const enqueueResult = body.sessionId
      ? await enqueueSpecificSession(body.sessionId)
      : body.retryOnly
        ? { queuedSessions: [] as string[], queuedCount: 0, retryOnly: true }
        : await enqueuePreviousHourOrders();
    const deliveryResult = await attemptQueuedDeliveries();

    return Response.json({
      ok: true,
      ...enqueueResult,
      ...deliveryResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
});
