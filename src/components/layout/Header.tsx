import React from "react";
import {
  LayoutDashboard,
  MapPin,
  Database,
  Send,
  Settings,
  RefreshCw
} from "lucide-react";
import { useLeadFinder } from "../../context/LeadFinderContext";

export default function Header() {
  const { activeTab, fetchData } = useLeadFinder();

  return (
    <header className="h-16 bg-[#090d16]/70 border-b border-[#1e293b]/60 px-8 flex items-center justify-between z-10 backdrop-blur-md shrink-0">
      <div className="flex items-center gap-2.5">
        {activeTab === "dashboard" && <LayoutDashboard className="h-5 w-5 text-indigo-400" />}
        {activeTab === "finder" && <MapPin className="h-5 w-5 text-indigo-400" />}
        {activeTab === "leads" && <Database className="h-5 w-5 text-indigo-400" />}
        {activeTab === "outreach" && <Send className="h-5 w-5 text-indigo-400" />}
        {activeTab === "settings" && <Settings className="h-5 w-5 text-indigo-400" />}
        <span className="text-sm font-bold text-white font-mono uppercase tracking-wider">
          {activeTab === "dashboard" && "Dashboard Overview"}
          {activeTab === "finder" && "Geo Lead Finder"}
          {activeTab === "leads" && "Leads Database console"}
          {activeTab === "outreach" && "Outreach Campaign Panel"}
          {activeTab === "settings" && "Outreach & Integrations"}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full font-mono font-bold tracking-widest uppercase border border-indigo-500/20">
          V2.0 Production Active
        </span>
        <button
          onClick={fetchData}
          className="p-1.5 rounded-lg border border-[#1e293b] hover:bg-slate-800/50 text-slate-400 hover:text-white transition-all cursor-pointer"
          title="Reload Statuses"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
