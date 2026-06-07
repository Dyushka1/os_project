import api from "../../api/axios";

export type ClientRegisterPayload = {
  username: string;
  password: string;
};

export async function registerClient(payload: ClientRegisterPayload) {
  const res = await api.post("/users/register", {
    ...payload,
    role: "user",
  });
  return res.data;
}

export async function loginClient(payload: { username: string; password: string }) {
  const res = await api.post("/login/", payload);
  return res.data;
}
