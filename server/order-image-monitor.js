require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const PROJECT_REF = "ejoyopfapvulkegsqfxb";
const SUPABASE_URL =
  process.env.SUPABASE_URL || `https://${PROJECT_REF}.supabase.co`;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_IMAGE_BUCKET = "mug images";

const STATE_FILE = "/Users/elireuter/Documents/fortnite/rivertowns_order_monitor_state.json";
const DOWNLOAD_DIR = "/Users/elireuter/Documents/fortnite/rivertowns custom photos";
const RECIPIENT_EMAIL = "rivertownscustom@gmail.com";

const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;
const SMTP_USER = process.env.GMAIL_SMTP_USER || "";
const SMTP_PASS = process.env.GMAIL_SMTP_APP_PASSWORD || "";
const SMTP_FROM = process.env.GMAIL_SMTP_FROM || SMTP_USER;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

function resolveStateDir() {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const lastOrderId = Number(parsed.lastOrderId);
    if (Number.isFinite(lastOrderId)) {
      return lastOrderId;
    }
  } catch (error) {
    return null;
  }

  return null;
}

function writeState(lastOrderId) {
  const payload = {
    lastOrderId: Number(lastOrderId),
    updatedAt: new Date().toISOString(),
    projectRef: PROJECT_REF,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), "utf8");
}

function sanitizeFileName(fileName) {
  return String(fileName || "image")
    .replace(/[\\/?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    return null;
  }

  const [, mimeType, base64Payload] = match;
  return { mimeType, buffer: Buffer.from(base64Payload, "base64") };
}

function extensionFromNameOrType(name, mimeType) {
  const fromName = String(name || "").split(".").pop();

  if (fromName && fromName !== name) {
    const clean = fromName.replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length <= 6 && clean.length >= 2) {
      return clean.toLowerCase();
    }
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "png";
}

function buildOutputPath(orderId, imageName, fallbackExt = "png") {
  const baseName = imageName ? sanitizeFileName(imageName) : `order-${orderId}-image`;
  const ext = path.extname(baseName) ? "" : `.${fallbackExt}`;
  const finalName = `${orderId}-${baseName}${ext}`;
  return path.join(DOWNLOAD_DIR, finalName);
}

async function queryMaxOrderId(supabase) {
  const { data, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: false })
    .order("id", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to read max order id: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0 || data[0].id === null) {
    return 0;
  }

  return Number(data[0].id) || 0;
}

async function queryNewOrders(supabase, lastOrderId) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,created_at,customer_name,product_id,product_name,image_name,image_storage_path,image_public_url,image_data_url,address,delivery_option,payment_status",
    )
    .gt("id", lastOrderId)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Failed to read orders: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

async function findStoragePathByImageName(supabase, imageName) {
  if (!imageName) {
    return null;
  }

  const { data, error } = await supabase
    .from("storage.objects")
    .select("name")
    .eq("bucket_id", SUPABASE_IMAGE_BUCKET)
    .eq("name", imageName)
    .limit(1);

  if (error) {
    throw new Error(`Storage object lookup failed for ${imageName}: ${error.message}`);
  }

  return data && data.length > 0 ? data[0].name : null;
}

async function downloadFromBucket(supabase, objectPath) {
  const { data, error } = await supabase.storage.from(SUPABASE_IMAGE_BUCKET).download(objectPath);

  if (error) {
    throw new Error(`Download failed for path ${objectPath}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Download returned no data for path ${objectPath}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

async function downloadFromPublicUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Public URL download failed (${response.status}): ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function downloadImageForOrder(supabase, order) {
  const reasons = [];
  const outputDir = DOWNLOAD_DIR;
  fs.mkdirSync(outputDir, { recursive: true });

  const preferredExt = extensionFromNameOrType(order.image_name, null);
  const outputPath = buildOutputPath(order.id, order.image_name, preferredExt);

  if (order.image_storage_path) {
    try {
      const buffer = await downloadFromBucket(supabase, order.image_storage_path);
      fs.writeFileSync(outputPath, buffer);
      return { ok: true, path: outputPath, reason: null };
    } catch (error) {
      reasons.push(`image_storage_path failed: ${error.message}`);
    }
  } else {
    reasons.push("image_storage_path missing");
  }

  if (!order.image_storage_path && order.image_name) {
    try {
      const storagePath = await findStoragePathByImageName(supabase, order.image_name);
      if (storagePath) {
        const buffer = await downloadFromBucket(supabase, storagePath);
        fs.writeFileSync(outputPath, buffer);
        return { ok: true, path: outputPath, reason: null };
      }
      reasons.push("storage.objects lookup by image_name found no match");
    } catch (error) {
      reasons.push(`storage.objects lookup failed: ${error.message}`);
    }
  } else if (!order.image_name) {
    reasons.push("image_name missing for storage.objects fallback");
  }

  if (order.image_public_url) {
    try {
      const buffer = await downloadFromPublicUrl(order.image_public_url);
      fs.writeFileSync(outputPath, buffer);
      return { ok: true, path: outputPath, reason: null };
    } catch (error) {
      reasons.push(`image_public_url failed: ${error.message}`);
    }
  } else {
    reasons.push("image_public_url missing");
  }

  if (!order.image_public_url && order.image_data_url) {
    const decoded = decodeDataUrl(order.image_data_url);
    if (decoded) {
      fs.writeFileSync(outputPath, decoded.buffer);
      return { ok: true, path: outputPath, reason: null };
    }
    reasons.push("image_data_url present but malformed");
  } else if (!order.image_data_url) {
    reasons.push("image_data_url missing");
  }

  return { ok: false, path: null, reason: reasons.join(" | ") };
}

async function sendGmailNotification(ordersWithResults) {
  const hasGmailConfig = Boolean(SMTP_USER && SMTP_PASS && SMTP_FROM);
  const nodemailerModule = hasGmailConfig ? await import("nodemailer") : null;
  const nodemailer = nodemailerModule?.default || nodemailerModule;

  const isSingle = ordersWithResults.length === 1;
  const firstId = ordersWithResults[0]?.id;
  const subject = isSingle
    ? `New Rivertowns order #${firstId}`
    : "New Rivertowns orders";

  const lines = [];
  for (const item of ordersWithResults) {
    const imageName = item.image_name || "Unavailable";
    const localOrReason = item.imageResult?.ok
      ? item.imageResult.path
      : `Download failed: ${item.imageResult?.reason || "No image fields available"}`;

    lines.push(`Order ID: ${item.id}`);
    lines.push(`Created at: ${item.created_at || "Unavailable"}`);
    lines.push(`Image name: ${imageName}`);
    lines.push(`Image path / download status: ${localOrReason}`);
    lines.push(`Product: ${item.product_name || "Unknown"} (${item.product_id || "Unknown"})`);
    lines.push(`Address: ${item.address || "Unavailable"}`);
    lines.push(`Customer: ${item.customer_name || "Unavailable"}`);
    lines.push(`Delivery option: ${item.delivery_option || "Unavailable"}`);
    lines.push(`Payment status: ${item.payment_status || "Unavailable"}`);
    lines.push("");
  }

  if (!hasGmailConfig || !nodemailer) {
    throw new Error(
      "Missing Gmail SMTP credentials. Set GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD (or nodemailer unavailable).",
    );
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const attachments = ordersWithResults
    .filter((item) => item.imageResult?.ok && item.imageResult.path)
    .map((item) => ({
      filename: path.basename(item.imageResult.path),
      path: item.imageResult.path,
    }));

  await transporter.sendMail({
    from: SMTP_FROM,
    to: RECIPIENT_EMAIL,
    subject,
    text: lines.join("\n"),
    attachments,
  });
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  resolveStateDir();

  const lastOrderId = readState();
  if (lastOrderId === null) {
    const maxOrderId = await queryMaxOrderId(supabase);
    writeState(maxOrderId);
    console.log(
      `Initialized monitor state at order id ${maxOrderId}. Monitoring is now initialized; no email sent for historical orders.`,
    );
    return;
  }

  const orders = await queryNewOrders(supabase, lastOrderId);

  if (!orders.length) {
    return;
  }

  const processedOrders = [];
  for (const order of orders) {
    const imageResult = await downloadImageForOrder(supabase, order);
    processedOrders.push({ ...order, imageResult });
  }

  try {
    await sendGmailNotification(processedOrders);
    console.log(`Sent notification for ${processedOrders.length} new order(s).`);
  } catch (error) {
    console.error(`Email send failed: ${error.message}`);
  }

  const maxProcessedId = Math.max(...processedOrders.map((order) => Number(order.id)));
  writeState(maxProcessedId);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
