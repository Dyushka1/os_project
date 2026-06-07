import IssueDesk from "./pages/IssueDesk";
import { useEffect } from "react";
import { Routes, Route, Navigate} from "react-router-dom";
import OrdersList from "./features/orders/OrdersList";
import OrderDetails from "./features/orders/OrderDetails";
import CreateOrder from "./features/orders/OrderCreate";
import Login from "./pages/Login";

import SessionControl from "./pages/SessionControl";
import ClientHome from "./pages/ClientHome";
import AdminHome from "./pages/AdminHome";
import StaffAdmin from "./pages/StaffAdmin";
import CatalogAdmin from "./pages/CatalogAdminDb";
import StatsAdmin from "./pages/StatsAdmin";
import AdminSessionOps from "./pages/AdminSessionOps";
import BrandingAdmin from "./pages/BrandingAdmin";
import ReceptionDesk from "./pages/ReceptionDesk";
import MasterPrint from "./pages/MasterPrint";
import MasterPrintTask from "./pages/MasterPrintTask";
import MasterPrinting from "./pages/MasterPrinting";
import Tablo from "./pages/Tablo";

import { useBranding } from "./features/branding/useBranding";

export default function App() {
  const branding = useBranding();

  useEffect(() => {
    const paletteColor = branding.getAsset("palette")?.color_value?.trim();
    if (paletteColor) {
      document.documentElement.style.setProperty("--brand-primary", paletteColor);
      document.body.style.backgroundColor = `${paletteColor}14`;
      return;
    }
    document.documentElement.style.removeProperty("--brand-primary");
    document.body.style.backgroundColor = "";
  }, [branding.data]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/client/register" element={<Navigate to="/client" replace />} />
      <Route path="/client/login" element={<Navigate to="/client" replace />} />
      <Route path="/client" element={<ClientHome />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/admin/staff" element={<StaffAdmin />} />
      <Route path="/admin/catalog" element={<CatalogAdmin />} />
      <Route path="/admin/stats" element={<StatsAdmin />} />
      <Route path="/admin/session-ops" element={<AdminSessionOps />} />
      <Route path="/admin/branding" element={<BrandingAdmin />} />
      <Route path="/reception" element={<ReceptionDesk />} />
      <Route path="/master/print" element={<MasterPrint />} />
      <Route path="/master/print/task" element={<MasterPrintTask />} />
      <Route path="/master/printing" element={<MasterPrinting />} />
      <Route path="/tablo" element={<Tablo />} />
      <Route path="/board" element={<Tablo />} />
      <Route path="/issue" element={<IssueDesk />} />
      <Route path="/orders" element={<OrdersList />} />
      <Route path="/orders/new" element={<CreateOrder />} />
      <Route path="/orders/:id" element={<OrderDetails />} />
      <Route path="/session" element={<SessionControl />} />
      <Route path="/" element={<Navigate to="/client" replace />}/>
      <Route path="*" element={<div>404 Not Found</div>}/>
    </Routes>
  );
}