import type { ErpOrder } from "./types";

const ORDER_PREFIX = "order:";

export async function saveOrder(kv: KVNamespace, order: ErpOrder): Promise<void> {
  const key = `${ORDER_PREFIX}${order.trackingNumber}`;
  await kv.put(key, JSON.stringify(order));
}

export async function getOrder(kv: KVNamespace, trackingNumber: string): Promise<ErpOrder | null> {
  const key = `${ORDER_PREFIX}${trackingNumber}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as ErpOrder;
}

export async function listOrders(
  kv: KVNamespace,
  options?: { status?: string; cursor?: string; limit?: number }
): Promise<{ orders: ErpOrder[]; cursor?: string }> {
  const list = await kv.list({ prefix: ORDER_PREFIX, cursor: options?.cursor, limit: options?.limit ?? 100 });
  const orders: ErpOrder[] = [];

  for (const key of list.keys) {
    const raw = await kv.get(key.name);
    if (!raw) continue;
    const order = JSON.parse(raw) as ErpOrder;
    if (options?.status && order.status !== options.status) continue;
    orders.push(order);
  }

  return { orders, cursor: list.list_complete ? undefined : list.cursor };
}

export async function deleteOrder(kv: KVNamespace, trackingNumber: string): Promise<boolean> {
  const key = `${ORDER_PREFIX}${trackingNumber}`;
  const existing = await kv.get(key);
  if (!existing) return false;
  await kv.delete(key);
  return true;
}

export async function saveBatch(kv: KVNamespace, orders: ErpOrder[]): Promise<void> {
  await Promise.all(
    orders.map((order) => kv.put(`${ORDER_PREFIX}${order.trackingNumber}`, JSON.stringify(order)))
  );
}
