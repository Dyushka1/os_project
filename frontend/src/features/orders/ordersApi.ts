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
  notify_contact?: string;
  print_text?: string;
  print_font?: string;
  print_side?: "front" | "back";
  print_x?: number;
  print_y?: number;
  print_angle?: number;
  print_scale?: number;
};

export async function createOrder(payload: CreateOrderPayload) {
  const res = await api.post("/orders/", payload);
  return res.data;
}

export async function updateOrderStatus(orderId: number, status: string) {
  const res = await api.put(`/orders/${orderId}`, { status });
  return res.data;
}

export async function takePrint(orderId: number) {
  const res = await api.post(`/orders/${orderId}/take_print`);
  return res.data;
}

export async function finishPrint(orderId: number) {
  const res = await api.post(`/orders/${orderId}/finish_printing`);
  return res.data;
}

export async function startDelivery(orderId: number) {
  const res = await api.post(`/orders/${orderId}/start_delivery`);
  return res.data;
}

export async function issueOrder(orderId: number) {
  const res = await api.post(`/orders/${orderId}/issue`);
  return res.data;
}

export async function fetchBoardStatus() {
  const res = await api.get("/orders/board/status");
  return res.data;
}

export async function fetchMyOrders(limit = 50) {
  const res = await api.get("/orders/my", { params: { limit } });
  return res.data;
}