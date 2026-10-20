import React from "react";
import {
  Compass,
  LayoutDashboard,
  MapPin,
  Database,
  Send,
  Settings,
  ChevronRight
} from "lucide-react";
import { useLeadFinder } from "../../context/LeadFinderContext";

export default function Sidebar() {
  const {
    activeTab,
    setActiveTab,
    setActiveCampaignType,
    totalProcessed,
    isRunning,
    campaignRunning,
    whatsappStatus,
    webhookConfigured
  } = useLeadFinder();

  return (
    <aside className="w-64 bg-[#090d16] border-r border-[#1e293b] flex flex-col justify-between h-full z-20 shrink-0 select-none">
      <div>
        {/* Logo Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-[#1e293b]/60">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-md shadow-indigo-600/30">
            <Compass className="h-5 w-5 text-white animate-spin-slow" />
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 -top-0.5 -right-0.5 animate-pulse"></span>
          </div>
          <div>
            <h1 className="text-sm font-black text-white font-mono tracking-wider">LEADFINDER AI</h1>
            <span className="text-[9px] text-indigo-400 font-mono tracking-widest uppercase">Maps Outreach</span>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="p-4 space-y-1">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <LayoutDashboard className="h-4.5 w-4.5" /> Dashboard Overview
            </span>
            <ChevronRight className="h-3 w-3 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab("finder")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              activeTab === "finder"
                ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <MapPin className="h-4.5 w-4.5" /> Geo Lead Finder
            </span>
            {isRunning && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
            {!isRunning && <ChevronRight className="h-3 w-3 opacity-60" />}
          </button>

          <button
            onClick={() => setActiveTab("leads")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              activeTab === "leads"
                ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Database className="h-4.5 w-4.5" /> Leads Database
            </span>
            <span className="text-[10px] bg-[#1e293b] text-slate-300 px-2 py-0.5 rounded-full font-sans">
              {totalProcessed}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("outreach");
              setActiveCampaignType("outreach");
            }}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              activeTab === "outreach"
                ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Send className="h-4.5 w-4.5" /> Outreach Campaign
            </span>
            {campaignRunning && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>}
            {!campaignRunning && <ChevronRight className="h-3 w-3 opacity-60" />}
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              activeTab === "settings"
                ? "bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 font-bold"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Settings className="h-4.5 w-4.5" /> Integrations
            </span>
            <ChevronRight className="h-3 w-3 opacity-60" />
          </button>
        </nav>
      </div>

      {/* Sidebar Status Footer */}
      <div className="p-4 border-t border-[#1e293b]/60 font-mono text-[9px] text-slate-500 space-y-2">
        <div className="flex items-center justify-between">
          <span>WhatsApp Connection:</span>
          <span
            className={`font-bold flex items-center gap-1 ${
              whatsappStatus.status === "CONNECTED" ? "text-emerald-400" : "text-amber-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                whatsappStatus.status === "CONNECTED" ? "bg-emerald-400" : "bg-amber-500"
              }`}
            ></span>
            {whatsappStatus.status === "CONNECTED" ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Webhook delivery:</span>
          <span className={webhookConfigured ? "text-emerald-400 font-bold" : "text-slate-500"}>
            {webhookConfigured ? "Active" : "Not Set"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Autobulk Campaign:</span>
          <span className={campaignRunning ? "text-emerald-400 font-bold animate-pulse" : "text-slate-500"}>
            {campaignRunning ? "Running" : "Idle"}
          </span>
        </div>
      </div>
    </aside>
  );
}
