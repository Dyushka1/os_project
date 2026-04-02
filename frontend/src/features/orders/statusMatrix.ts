export type Role = "ADMIN" | "RECEPTION" | "PRINT" | "NANESENIE" | "ISSUE";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "printing"
  | "printed"
  | "nanesenie"
  | "nanesenie_done"
  | "delivering"
  | "issued"
  | "cancel_requested"
  | "canceled";

export type Action =
  | "confirm"
  | "take_print"
  | "finish_print"
  | "take_nanesenie"
  | "finish_nanesenie"
  | "start_delivery"
  | "issue"
  | "cancel_request"
  | "cancel_approve"
  | "cancel_reject";

export const STATUS_ACTIONS: Record<OrderStatus, Record<Role, Action[]>> = {
  new: {
    ADMIN: ["confirm", "cancel_request"],
    RECEPTION: ["confirm", "cancel_request"],
    PRINT: [],
    NANESENIE: [],
    ISSUE: [],
  },
  confirmed: {
    ADMIN: ["take_print", "cancel_request"],
    RECEPTION: ["cancel_request"],
    PRINT: ["take_print"],
    NANESENIE: [],
    ISSUE: [],
  },
  printing: {
    ADMIN: ["finish_print", "cancel_request"],
    RECEPTION: ["cancel_request"],
    PRINT: ["finish_print"],
    NANESENIE: [],
    ISSUE: [],
  },
  printed: {
    ADMIN: ["take_nanesenie", "cancel_request"],
    RECEPTION: ["cancel_request"],
    PRINT: [],
    NANESENIE: ["take_nanesenie"],
    ISSUE: [],
  },
  nanesenie: {
    ADMIN: ["finish_nanesenie", "cancel_request"],
    RECEPTION: ["cancel_request"],
    PRINT: [],
    NANESENIE: ["finish_nanesenie"],
    ISSUE: [],
  },
  nanesenie_done: {
    ADMIN: ["start_delivery", "cancel_request"],
    RECEPTION: ["cancel_request"],
    PRINT: [],
    NANESENIE: [],
    ISSUE: ["start_delivery"],
  },
  delivering: {
    ADMIN: ["issue", "cancel_request"],
    RECEPTION: ["cancel_request"],
    PRINT: [],
    NANESENIE: [],
    ISSUE: ["issue"],
  },
  issued: {
    ADMIN: [],
    RECEPTION: [],
    PRINT: [],
    NANESENIE: [],
    ISSUE: [],
  },
  cancel_requested: {
    ADMIN: ["cancel_approve", "cancel_reject"],
    RECEPTION: ["cancel_approve", "cancel_reject"],
    PRINT: [],
    NANESENIE: [],
    ISSUE: [],
  },
  canceled: {
    ADMIN: [],
    RECEPTION: [],
    PRINT: [],
    NANESENIE: [],
    ISSUE: [],
  },
};
