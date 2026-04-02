import api from "../../api/axios";

export type OrdersSearchParams = { q?: string; status?: string; limit?: number };

export async function fetchOrders(params: OrdersSearchParams = {}) {
  const res = await api.get("/orders/search", { params });
  return res.data;
}

export async function fetchOrderById(id: number) {
  const res = await api.get(`/orders/${id}`);
  return res.data;
}