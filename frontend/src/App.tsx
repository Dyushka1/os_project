import { Routes, Route, Navigate } from "react-router-dom";
import OrdersList from "./features/orders/OrdersList";
import OrderDetails from "./features/orders/OrderDetails";
import Login from "./pages/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/orders" element={<OrdersList />} />
      <Route path="/orders/:id" element={<OrderDetails />} />
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  );
}