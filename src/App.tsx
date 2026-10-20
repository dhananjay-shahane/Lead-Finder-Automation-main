import React from "react";
import { LeadFinderProvider, useLeadFinder } from "./context/LeadFinderContext";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import DashboardView from "./views/DashboardView";
import FinderView from "./views/FinderView";
import LeadsView from "./views/LeadsView";
import SettingsView from "./views/SettingsView";
import OutreachView from "./views/OutreachView";
import LeadOutreachModal from "./components/shared/LeadOutreachModal";

const AppContent: React.FC = () => {
  const { activeTab } = useLeadFinder();

  return (
    <div className="flex h-screen bg-[#030712] text-slate-100 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Sticky Header */}
        <Header />

        {/* Dynamic Active Tab View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeTab === "dashboard" && <DashboardView />}
          {activeTab === "finder" && <FinderView />}
          {activeTab === "leads" && <LeadsView />}
          {activeTab === "outreach" && <OutreachView />}
          {activeTab === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Global Modals */}
      <LeadOutreachModal />
    </div>
  );
};

export function App() {
  return (
    <LeadFinderProvider>
      <AppContent />
    </LeadFinderProvider>
  );
}

export default App;
