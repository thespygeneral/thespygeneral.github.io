import { useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router";
import { HideContext } from "./lib/hide";
import { numbersHidden, setNumbersHidden } from "./lib/format";
import { Loader2 } from "lucide-react";
import { JournalProvider, useJournal } from "./lib/journal";
import { Layout } from "./components/Layout";
import { Welcome, LockScreen } from "./pages/Gates";
import { Dashboard, Trades, Calendar } from "./pages/Views";
import { TradeForm } from "./pages/TradeForm";
import { TradeDetail } from "./pages/TradeDetail";
import { Protect } from "./pages/Protect";

function Gate() {
  const { phase, error } = useJournal();
  if (phase === "loading") return <div className="flex min-h-dvh items-center justify-center"><Loader2 className="animate-spin text-text-muted" /></div>;
  if (phase === "error")
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-lg font-semibold">This browser can't open the journal</h1>
        <p className="mt-2 text-sm text-text-muted">
          It may be in private/incognito mode, or site storage is turned off. Open this page in a normal window of Chrome, Edge, Safari or Firefox.
        </p>
        <p className="mt-4 text-xs text-text-muted">{error}</p>
      </div>
    );
  if (phase === "locked") return <LockScreen />;
  if (phase === "welcome") return <Welcome />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="trades" element={<Trades />} />
        <Route path="trades/new" element={<TradeForm key="new" />} />
        <Route path="trades/:id" element={<TradeDetail />} />
        <Route path="trades/:id/edit" element={<TradeForm />} />
        <Route path="protect" element={<Protect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  // Held at the very top so flipping it redraws every screen (forms keep what's typed).
  const [hidden, setHidden] = useState(numbersHidden());
  const toggle = () => {
    setNumbersHidden(!hidden);
    setHidden(!hidden);
  };
  return (
    <HashRouter>
      <HideContext.Provider value={{ hidden, toggle }}>
        <JournalProvider>
          <Gate />
        </JournalProvider>
      </HideContext.Provider>
    </HashRouter>
  );
}
