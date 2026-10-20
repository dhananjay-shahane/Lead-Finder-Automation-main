import React, { useEffect } from "react";
import { Map } from "lucide-react";
import { useLeadFinder } from "../context/LeadFinderContext";
import { MAP_TILE_CONFIGS } from "../types";

export default function DashboardView() {
  const {
    totalProcessed,
    hotLeads,
    warmLeads,
    coldLeads,
    failedLeads,
    handleRetryFailed,
    isRetryingFailed,
    processedLeads,
    overviewMapLayer,
    switchOverviewTileLayer,
    overviewMapInstance,
    overviewMarkers,
    overviewTileLayer,
    scorePoor,
    scoreNeedsWork,
    scoreGood,
    scoreExcellent,
    maxScoreCount,
    lat,
    lng
  } = useLeadFinder();

  // Leaflet map setup for Dashboard Overview
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !document.getElementById("overview-map")) {
      if (overviewMapInstance.current) {
        overviewMapInstance.current.remove();
        overviewMapInstance.current = null;
        overviewTileLayer.current = null;
        overviewMarkers.current = [];
      }
      return;
    }

    if (overviewMapInstance.current) {
      overviewMarkers.current.forEach((m) => m.remove());
      overviewMarkers.current = [];
    } else {
      const firstValid = processedLeads.find((l) => l.lat && l.lng);
      const centerLat = firstValid?.lat || lat || 18.5590;
      const centerLng = firstValid?.lng || lng || 73.7868;

      const map = L.map("overview-map").setView([centerLat, centerLng], 12);
      overviewMapInstance.current = map;

      const cfg = MAP_TILE_CONFIGS[overviewMapLayer || "satellite"] || MAP_TILE_CONFIGS.satellite;
      const tileLayer = L.tileLayer(cfg.url, cfg.options).addTo(map);
      overviewTileLayer.current = tileLayer;
    }

    processedLeads.forEach((lead) => {
      if (lead.lat && lead.lng) {
        const color =
          lead.leadPriority === "HOT" ? "#ef4444" : lead.leadPriority === "WARM" ? "#f59e0b" : "#64748b";
        const marker = L.circleMarker([lead.lat, lead.lng], {
          radius: 8,
          fillColor: color,
          color: "#ffffff",
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(overviewMapInstance.current);

        marker.bindPopup(`
          <div class="text-slate-900 font-sans p-1">
            <h4 class="font-bold text-xs border-b pb-1 mb-1">${lead.businessName}</h4>
            <p class="text-[10px] my-0.5"><b>Category:</b> ${lead.category || "N/A"}</p>
            <p class="text-[10px] my-0.5"><b>Rating:</b> ${lead.rating} ⭐ (${lead.reviews} reviews)</p>
            <p class="text-[10px] my-0.5"><b>Lead Score:</b> <span class="font-bold text-indigo-600">${lead.leadScore}</span> (${lead.leadPriority})</p>
            <p class="text-[9px] text-slate-500 mt-1 truncate">${lead.address}</p>
          </div>
        `);
        overviewMarkers.current.push(marker);
      }
    });

    return () => {
      if (overviewMapInstance.current) {
        overviewMapInstance.current.remove();
        overviewMapInstance.current = null;
        overviewTileLayer.current = null;
        overviewMarkers.current = [];
      }
    };
  }, [processedLeads, overviewMapLayer]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-[#111827] border border-[#1e293b] rounded-2xl p-5 hover:border-indigo-500/20 transition-all shadow-md relative group overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all"></div>
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase">
            Total Harvested
          </span>
          <div className="my-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-white font-mono tracking-tight">{totalProcessed}</span>
            <span className="text-xs text-slate-400 font-mono">leads</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">Retained in local database</span>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-[#111827] border border-[#ef4444]/20 rounded-2xl p-5 hover:border-ef4444/30 transition-all shadow-md relative group overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 bg-rose-500/5 rounded-full blur-xl group-hover:bg-rose-500/10 transition-all"></div>
          <span className="text-[10px] font-bold text-rose-400 font-mono tracking-widest uppercase">
            Hot Candidates
          </span>
          <div className="my-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-rose-500 font-mono tracking-tight">{hotLeads}</span>
            <span className="text-xs text-rose-400/80 font-mono">HOT</span>
          </div>
          <span className="text-[10px] text-rose-400/60 font-mono">Critical digital presence gaps</span>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-[#111827] border border-amber-500/20 rounded-2xl p-5 hover:border-amber-500/30 transition-all shadow-md relative group overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
          <span className="text-[10px] font-bold text-amber-400 font-mono tracking-widest uppercase">
            Warm Opportunities
          </span>
          <div className="my-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-amber-500 font-mono tracking-tight">{warmLeads}</span>
            <span className="text-xs text-amber-400/80 font-mono">WARM</span>
          </div>
          <span className="text-[10px] text-amber-400/60 font-mono">Partial social or tracking gaps</span>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-[#111827] border border-[#1e293b] rounded-2xl p-5 hover:border-slate-500/20 transition-all shadow-md relative group overflow-hidden">
          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 bg-slate-500/5 rounded-full blur-xl group-hover:bg-slate-500/10 transition-all"></div>
          <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase">
            Pending Sync Queue
          </span>
          <div className="my-2 flex items-baseline gap-1">
            <span
              className={`text-3xl font-black font-mono tracking-tight ${
                failedLeads.length > 0 ? "text-amber-500" : "text-emerald-400"
              }`}
            >
              {failedLeads.length}
            </span>
            <span className="text-xs text-slate-400 font-mono">leads</span>
          </div>
          {failedLeads.length > 0 ? (
            <button
              onClick={handleRetryFailed}
              disabled={isRetryingFailed}
              className="text-[10px] text-amber-400 hover:text-amber-300 font-mono underline cursor-pointer border-0 bg-transparent p-0 block"
            >
              {isRetryingFailed ? "Syncing..." : "Click to flush failed webhook list"}
            </button>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">Google sheet data synchronized</span>
          )}
        </div>
      </div>

      {/* Map & Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Leads Interactive Map */}
        <div className="md:col-span-8 bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 flex flex-col justify-between min-h-[460px]">
          <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-[#1e293b]/60 gap-2">
            <div className="flex items-center gap-2">
              <Map className="h-4.5 w-4.5 text-emerald-400" />
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">
                Harvested Leads Geolocations
              </h3>
              <span className="text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono font-bold uppercase">
                {overviewMapLayer}
              </span>
            </div>

            {/* Layer Switcher */}
            <div className="flex items-center gap-1 bg-[#030712] p-1 rounded-xl border border-[#1e293b]">
              <button
                type="button"
                onClick={() => switchOverviewTileLayer("satellite")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  overviewMapLayer === "satellite" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                🛰️ Satellite (India)
              </button>
              <button
                type="button"
                onClick={() => switchOverviewTileLayer("dark")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  overviewMapLayer === "dark" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                🌑 Dark
              </button>
              <button
                type="button"
                onClick={() => switchOverviewTileLayer("street")}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  overviewMapLayer === "street" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                🗺️ Street
              </button>
            </div>
          </div>

          <div className="relative flex-grow rounded-xl overflow-hidden border border-[#1e293b] z-0 h-[380px]">
            <div id="overview-map" className="w-full h-full"></div>
            {processedLeads.length === 0 && (
              <div className="absolute top-3 left-3 z-[400] bg-slate-950/85 backdrop-blur-md border border-[#1e293b] rounded-xl px-3 py-2 text-[11px] font-mono text-slate-300 shadow-xl flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Satellite Map Active (India) · Ready to plot scraped leads</span>
              </div>
            )}
          </div>
        </div>

        {/* SVG Visual Statistics */}
        <div className="md:col-span-4 space-y-6">
          {/* Lead Priority Distribution */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 flex flex-col justify-between h-fit">
            <div className="pb-3 border-b border-[#1e293b]/60 mb-5">
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">
                Priority Distribution
              </h3>
            </div>

            <div className="space-y-4">
              {/* HOT bar */}
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-rose-400 font-bold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span> HOT ({hotLeads})
                  </span>
                  <span className="text-slate-400">
                    {totalProcessed > 0 ? ((hotLeads / totalProcessed) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-rose-500 transition-all duration-1000 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                    style={{ width: `${totalProcessed > 0 ? (hotLeads / totalProcessed) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* WARM bar */}
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span> WARM ({warmLeads})
                  </span>
                  <span className="text-slate-400">
                    {totalProcessed > 0 ? ((warmLeads / totalProcessed) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-amber-500 transition-all duration-1000 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                    style={{ width: `${totalProcessed > 0 ? (warmLeads / totalProcessed) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>

              {/* COLD bar */}
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-slate-400 font-bold flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-500"></span> COLD ({coldLeads})
                  </span>
                  <span className="text-slate-400">
                    {totalProcessed > 0 ? ((coldLeads / totalProcessed) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-slate-500 transition-all duration-1000"
                    style={{ width: `${totalProcessed > 0 ? (coldLeads / totalProcessed) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Digital Presence Score Distribution */}
          <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6">
            <div className="pb-3 border-b border-[#1e293b]/60 mb-5">
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">
                Score Distribution
              </h3>
            </div>

            <div className="flex items-end justify-between h-[180px] pt-4 font-mono text-[9px] text-slate-400 border-b border-slate-800 pb-2">
              {/* Bar 1: Poor */}
              <div className="flex flex-col items-center gap-2 w-1/4">
                <span className="text-slate-300 font-bold">{scorePoor}</span>
                <div className="w-8 bg-slate-900 border border-slate-800 rounded-t-md relative h-[120px] flex items-end">
                  <div
                    className="w-full bg-[#64748b] rounded-t-sm hover:brightness-110 transition-all"
                    style={{ height: `${(scorePoor / maxScoreCount) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[8px] truncate max-w-full">0-50</span>
              </div>

              {/* Bar 2: Needs Work */}
              <div className="flex flex-col items-center gap-2 w-1/4">
                <span className="text-slate-300 font-bold">{scoreNeedsWork}</span>
                <div className="w-8 bg-slate-900 border border-slate-800 rounded-t-md relative h-[120px] flex items-end">
                  <div
                    className="w-full bg-amber-500/70 rounded-t-sm hover:brightness-110 transition-all"
                    style={{ height: `${(scoreNeedsWork / maxScoreCount) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[8px] truncate max-w-full">51-100</span>
              </div>

              {/* Bar 3: Good */}
              <div className="flex flex-col items-center gap-2 w-1/4">
                <span className="text-slate-300 font-bold">{scoreGood}</span>
                <div className="w-8 bg-slate-900 border border-slate-800 rounded-t-md relative h-[120px] flex items-end">
                  <div
                    className="w-full bg-indigo-500/70 rounded-t-sm hover:brightness-110 transition-all"
                    style={{ height: `${(scoreGood / maxScoreCount) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[8px] truncate max-w-full">101-150</span>
              </div>

              {/* Bar 4: Excellent */}
              <div className="flex flex-col items-center gap-2 w-1/4">
                <span className="text-slate-300 font-bold">{scoreExcellent}</span>
                <div className="w-8 bg-slate-900 border border-slate-800 rounded-t-md relative h-[120px] flex items-end">
                  <div
                    className="w-full bg-emerald-500/80 rounded-t-sm hover:brightness-110 transition-all"
                    style={{ height: `${(scoreExcellent / maxScoreCount) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[8px] truncate max-w-full">151-200</span>
              </div>
            </div>
            <div className="text-center mt-3 text-[9px] text-slate-500 font-mono">
              Digital Presence Score Ranges (out of 200)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
