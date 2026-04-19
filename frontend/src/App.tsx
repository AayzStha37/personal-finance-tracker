import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { AppProvider } from "./state/AppContext";
import DashboardPage from "./pages/DashboardPage";
import MonthsPage from "./pages/MonthsPage";
import MonthDetailPage from "./pages/MonthDetailPage";
import AccountsPage from "./pages/AccountsPage";
import InvestmentsPage from "./pages/InvestmentsPage";
import EmiPage from "./pages/EmiPage";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="months" element={<MonthsPage />} />
            <Route path="months/:id" element={<MonthDetailPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="investments" element={<InvestmentsPage />} />
            <Route path="emi" element={<EmiPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
