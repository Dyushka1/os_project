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

export type CreateOrderPayload = {
  client: {
    name?: string;
    phone?: string;
    email?: string;
  };
  color_id?: number;
  model_id: number;
  size_id: number;
  print_id?: number;
  promo_code?: string;
  notify_method?: string;
  notify_contract?: string;
};

export async function createOrder(payload: CreateOrderPayload) {
  const res = await api.post("/orders/", payload);
  return res.data;
}