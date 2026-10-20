import React, { useEffect } from "react";
import {
  MapPin,
  Layers,
  Search,
  Loader2,
  Sliders,
  Building2,
  Smartphone,
  RefreshCw,
  Info,
  Play,
  X,
  Globe,
  Terminal as TerminalIcon,
  CheckCircle2,
  ArrowRight,
  Mail,
  FileSpreadsheet,
  Sparkles,
  Clock,
  Copy,
  Check
} from "lucide-react";
import { useLeadFinder } from "../context/LeadFinderContext";
import { MAP_TILE_CONFIGS } from "../types";

export default function FinderView() {
  const {
    switchTileLayer,
    mapLayer,
    handleSearchAreaGeocode,
    mapSearchText,
    setMapSearchText,
    isGeocoding,
    isRunning,
    setIsRunning,
    setActiveTab,
    setSelectedFolderId,
    fetchFolders,
    fetchData,
    lat,
    setLat,
    lng,
    setLng,
    radius,
    setRadius,
    reverseGeocode,
    finderMapInstance,
    finderMarker,
    finderCircle,
    finderTileLayer,
    finderMode,
    setFinderMode,
    isSavingConfig,
    businessType,
    setBusinessType,
    location,
    setLocation,
    maxResults,
    setMaxResults,
    headless,
    setHeadless,
    scrapeWebsite,
    setScrapeWebsite,
    scrapeSocialMedia,
    setScrapeSocialMedia,
    handleSaveConfig,
    configSuccess,
    handleStopScraper,
    isStopping,
    handleStartScraper,
    autoScrollLogs,
    setAutoScrollLogs,
    terminalContainerRef,
    terminalLogs
  } = useLeadFinder();

  const [scraperStatus, setScraperStatus] = React.useState<{
    isRunning: boolean;
    phase: "maps" | "email" | "idle";
    mapsProgress: { status: string };
    emailProgress: { current: number; total: number; emailsFound?: number; status: string };
    outputFile: string;
  }>({
    isRunning: false,
    phase: "idle",
    mapsProgress: { status: "Idle" },
    emailProgress: { current: 0, total: 0, emailsFound: 0, status: "Idle" },
    outputFile: ""
  });

  const [copiedPath, setCopiedPath] = React.useState(false);
  const [dismissBanner, setDismissBanner] = React.useState(false);
  const prevRunningRef = React.useRef(false);

  // Poll maps scraper 2-phase status continuously
  useEffect(() => {
    let timer: any;
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/maps-scraper/status");
        if (res.ok) {
          const data = await res.json();
          setScraperStatus(data);

          // Detect transition from running to complete -> auto-clear running state & reload data
          if (prevRunningRef.current && !data.isRunning) {
            setIsRunning(false);
            setDismissBanner(false);
            fetchFolders();
            fetchData();
          } else if (!data.isRunning && data.phase === "idle" && isRunning) {
            setIsRunning(false);
          }
          prevRunningRef.current = Boolean(data.isRunning);
        }
      } catch {}
    };

    checkStatus();
    const isBusy = isRunning || scraperStatus.isRunning || scraperStatus.phase !== "idle";
    timer = setInterval(checkStatus, isBusy ? 1000 : 3000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, scraperStatus.isRunning, scraperStatus.phase]);

  // Terminal logs auto-scroll effect
  useEffect(() => {
    if (autoScrollLogs && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [terminalLogs, autoScrollLogs]);

  const isAgentActive = isRunning || scraperStatus.isRunning || scraperStatus.phase !== "idle";

  // Leaflet map setup for Geo Lead Finder tab
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !document.getElementById("finder-map")) {
      if (finderMapInstance.current) {
        finderMapInstance.current.remove();
        finderMapInstance.current = null;
        finderMarker.current = null;
        finderCircle.current = null;
        finderTileLayer.current = null;
      }
      return;
    }

    if (finderMapInstance.current) return;

    const initialLat = lat || 19.9975;
    const initialLng = lng || 73.7898;

    const map = L.map("finder-map").setView([initialLat, initialLng], 12);
    finderMapInstance.current = map;

    const activeKey = (localStorage.getItem("leadfinder_map_layer") as any) || "satellite";
    const cfg = MAP_TILE_CONFIGS[activeKey as keyof typeof MAP_TILE_CONFIGS] || MAP_TILE_CONFIGS.satellite;
    const tileLayer = L.tileLayer(cfg.url, cfg.options).addTo(map);
    finderTileLayer.current = tileLayer;

    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
    finderMarker.current = marker;

    const circle = L.circle([initialLat, initialLng], {
      color: "#38bdf8",
      fillColor: "#38bdf8",
      fillOpacity: 0.22,
      weight: 2.5,
      radius: radius * 1000
    }).addTo(map);
    finderCircle.current = circle;

    marker.on("dragend", async () => {
      const pos = marker.getLatLng();
      setLat(pos.lat);
      setLng(pos.lng);
      circle.setLatLng(pos);
      await reverseGeocode(pos.lat, pos.lng);
    });

    map.on("click", async (e: any) => {
      const pos = e.latlng;
      marker.setLatLng(pos);
      circle.setLatLng(pos);
      setLat(pos.lat);
      setLng(pos.lng);
      await reverseGeocode(pos.lat, pos.lng);
    });

    return () => {
      if (finderMapInstance.current) {
        finderMapInstance.current.remove();
        finderMapInstance.current = null;
        finderMarker.current = null;
        finderCircle.current = null;
        finderTileLayer.current = null;
      }
    };
  }, []);

  // Update circle radius on slider change
  useEffect(() => {
    if (finderCircle.current) {
      finderCircle.current.setRadius(radius * 1000);
    }
  }, [radius]);

  // Sync map center, marker, and circle when coordinates change
  useEffect(() => {
    if (finderMapInstance.current && lat && lng) {
      const currentCenter = finderMapInstance.current.getCenter();
      if (Math.abs(currentCenter.lat - lat) > 0.0001 || Math.abs(currentCenter.lng - lng) > 0.0001) {
        finderMapInstance.current.setView([lat, lng]);
      }
      if (finderMarker.current) {
        finderMarker.current.setLatLng([lat, lng]);
      }
      if (finderCircle.current) {
        finderCircle.current.setLatLng([lat, lng]);
      }
    }
  }, [lat, lng]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Area selector Map */}
        <div className="md:col-span-7 bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 flex flex-col justify-between min-h-[460px]">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-[#1e293b]/60 gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4.5 w-4.5 text-indigo-400" />
                <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">
                  Select Target Locality
                </h3>
              </div>

              {/* Map Layer Switcher */}
              <div className="flex items-center gap-1 bg-[#030712] border border-[#1e293b] p-0.5 rounded-lg self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => switchTileLayer("satellite")}
                  className={`px-2 py-1 text-[10px] font-mono rounded flex items-center gap-1 transition-all cursor-pointer ${
                    mapLayer === "satellite"
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Satellite Imagery with India Roads & City Labels"
                >
                  <Layers className="h-3 w-3" />
                  <span>🛰️ Satellite (India)</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchTileLayer("dark")}
                  className={`px-2 py-1 text-[10px] font-mono rounded flex items-center gap-1 transition-all cursor-pointer ${
                    mapLayer === "dark"
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Dark Gray Canvas Map"
                >
                  <span>🌑 Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchTileLayer("street")}
                  className={`px-2 py-1 text-[10px] font-mono rounded flex items-center gap-1 transition-all cursor-pointer ${
                    mapLayer === "street"
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="OpenStreetMap Street Layer"
                >
                  <span>🗺️ Street</span>
                </button>
              </div>
            </div>

            {/* Geocoding Input Bar */}
            <form onSubmit={handleSearchAreaGeocode} className="flex gap-2 mb-4">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search neighborhood (e.g. Gangapur Road, Nashik)"
                  value={mapSearchText}
                  onChange={(e) => setMapSearchText(e.target.value)}
                  className="w-full text-xs bg-[#030712] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isGeocoding || isRunning}
                className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/25 text-xs font-mono font-bold rounded-lg cursor-pointer flex items-center gap-1.5 transition-all"
              >
                {isGeocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Center Map"}
              </button>
            </form>
          </div>

          {/* Leaflet instance element */}
          <div id="finder-map" className="flex-grow rounded-xl overflow-hidden border border-[#1e293b] z-0 h-[280px]"></div>

          {/* Lat Lng display */}
          <div className="mt-3 font-mono text-[10px] text-slate-400 flex items-center justify-between bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-indigo-400" /> Coordinates:
            </span>
            <span>
              Lat: {lat?.toFixed(6) || "N/A"} | Lng: {lng?.toFixed(6) || "N/A"}
            </span>
          </div>
        </div>

        {/* Right Form settings parameters */}
        <div className="md:col-span-5 bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#1e293b]/60">
              <Sliders className="h-4.5 w-4.5 text-indigo-400" />
              <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">Scan Parameters</h3>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              {/* Lead Finder Search Mode */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1.5 font-mono">
                  Target Opportunity Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2.5">
                  {/* Mode 1: All */}
                  <button
                    type="button"
                    onClick={() => setFinderMode("all")}
                    disabled={isRunning || isSavingConfig}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      finderMode === "all"
                        ? "bg-indigo-950/40 border-indigo-500/80 shadow-md shadow-indigo-500/10"
                        : "bg-[#030712] border-[#1e293b] hover:border-slate-700"
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Building2
                        className={`h-3.5 w-3.5 ${finderMode === "all" ? "text-indigo-400" : "text-slate-500"}`}
                      />
                      {finderMode === "all" && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>}
                    </div>
                    <div
                      className={`text-[11px] font-bold leading-tight ${
                        finderMode === "all" ? "text-white" : "text-slate-300"
                      }`}
                    >
                      All Businesses
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-snug">
                      Standard local business sweep
                    </div>
                  </button>

                  {/* Mode 2: No Website */}
                  <button
                    type="button"
                    onClick={() => setFinderMode("noWebsite")}
                    disabled={isRunning || isSavingConfig}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      finderMode === "noWebsite"
                        ? "bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-500/10"
                        : "bg-[#030712] border-[#1e293b] hover:border-slate-700"
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Smartphone
                        className={`h-3.5 w-3.5 ${finderMode === "noWebsite" ? "text-emerald-400" : "text-slate-500"}`}
                      />
                      {finderMode === "noWebsite" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] font-bold leading-tight ${
                        finderMode === "noWebsite" ? "text-white" : "text-slate-300"
                      }`}
                    >
                      No Website
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-snug">Active biz with 0 web presence</div>
                  </button>

                  {/* Mode 3: Outdated Website */}
                  <button
                    type="button"
                    onClick={() => setFinderMode("outdatedWebsite")}
                    disabled={isRunning || isSavingConfig}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      finderMode === "outdatedWebsite"
                        ? "bg-amber-950/40 border-amber-500/80 shadow-md shadow-amber-500/10"
                        : "bg-[#030712] border-[#1e293b] hover:border-slate-700"
                    } disabled:opacity-50`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          finderMode === "outdatedWebsite" ? "text-amber-400" : "text-slate-500"
                        }`}
                      />
                      {finderMode === "outdatedWebsite" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] font-bold leading-tight ${
                        finderMode === "outdatedWebsite" ? "text-white" : "text-slate-300"
                      }`}
                    >
                      Outdated Site
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 leading-snug">Broken / slow UX / old design</div>
                  </button>
                </div>

                {/* Mode Description Banner */}
                <div className="bg-[#030712]/70 border border-[#1e293b]/70 rounded-lg p-2.5 mb-1 text-[10px] font-mono flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    {finderMode === "all" && (
                      <span className="text-slate-300">
                        Scrapes all matched businesses in area, analyzing websites and social channels.
                      </span>
                    )}
                    {finderMode === "noWebsite" && (
                      <span className="text-emerald-300">
                        🎯 <strong>Web Dev Pitch Mode:</strong> Automatically filters out companies with working websites. Targets active businesses needing a first website built.
                      </span>
                    )}
                    {finderMode === "outdatedWebsite" && (
                      <span className="text-amber-300">
                        🔄 <strong>Redesign Pitch Mode:</strong> Isolates businesses with outdated copyright (3+ yrs old), broken sites, or non-responsive designs.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1 font-mono">
                  Business Type
                </label>
                <input
                  type="text"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="e.g. Dental Clinic"
                  disabled={isRunning || isSavingConfig}
                  className="w-full text-xs bg-[#030712] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1 font-mono">
                  Area Locality Name
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onBlur={async () => {
                    if (!location.trim()) return;
                    try {
                      const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(location)}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data && data.length > 0) {
                          const item = data[0];
                          const newLat = parseFloat(item.lat);
                          const newLng = parseFloat(item.lon);
                          setLat(newLat);
                          setLng(newLng);
                          if (finderMapInstance.current) {
                            finderMapInstance.current.setView([newLat, newLng], 12);
                          }
                          if (finderMarker.current) {
                            finderMarker.current.setLatLng([newLat, newLng]);
                          }
                          if (finderCircle.current) {
                            finderCircle.current.setLatLng([newLat, newLng]);
                          }
                        }
                      }
                    } catch (e) {
                      console.error("Auto-geocoding error:", e);
                    }
                  }}
                  placeholder="e.g. Gangapur Road, Nashik"
                  disabled={isRunning || isSavingConfig}
                  className="w-full text-xs bg-[#030712] border border-[#1e293b] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                  required
                />
              </div>

              {/* Search Radius Limit */}
              <div>
                <div className="flex justify-between text-[9px] font-bold text-slate-400 tracking-wider uppercase mb-1 font-mono">
                  <span>Search Radius Limit</span>
                  <span className="text-indigo-400 text-xs font-black lowercase">{radius}km radius</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={radius > 100 ? 100 : radius}
                    onChange={(e) => setRadius(parseInt(e.target.value) || 5)}
                    disabled={isRunning || isSavingConfig}
                    className="flex-grow h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value) || 5)}
                    disabled={isRunning || isSavingConfig}
                    className="w-16 text-center text-xs bg-[#030712] border border-[#1e293b] rounded-lg px-2 py-1 text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                    title="Type custom radius in km"
                  />
                </div>
              </div>

              {/* Data Row Limits Presets + Custom Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 tracking-wider uppercase font-mono">
                  <span>Target Leads Limit</span>
                  <span className="text-indigo-400 font-black">{maxResults} leads</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[100, 500, 1000, 2000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMaxResults(preset)}
                      disabled={isRunning || isSavingConfig}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer border ${
                        maxResults === preset
                          ? "bg-indigo-600/30 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/20"
                          : "bg-[#030712] border-[#1e293b] text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      } disabled:opacity-50`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">Custom Count:</span>
                  <input
                    type="number"
                    min="1"
                    max="5000"
                    value={maxResults}
                    onChange={(e) => setMaxResults(parseInt(e.target.value, 10) || 1)}
                    disabled={isRunning || isSavingConfig}
                    className="flex-grow text-xs bg-[#030712] border border-[#1e293b] rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer select-none font-mono">
                  <input
                    type="checkbox"
                    checked={headless}
                    onChange={(e) => setHeadless(e.target.checked)}
                    disabled={isAgentActive || isSavingConfig}
                    className="rounded border-[#1e293b] bg-[#030712] text-indigo-600 focus:ring-indigo-500/20"
                  />
                  <span>Headless browser</span>
                </label>
                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Google Maps Live Engine
                </span>
              </div>

              {/* Scraper Options */}
              <div className="space-y-2.5 pt-2 border-t border-[#1e293b]/40">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Scrape Options</p>
                  <span className="text-[9px] font-mono text-slate-500">
                    {scrapeWebsite ? "⚡ Deep Web Scraping" : "⚡ Fast Maps Mode"}
                  </span>
                </div>

                {/* Scrape Website Option (Unchecked by default) */}
                <label
                  className={`flex items-start gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none font-mono ${
                    scrapeWebsite
                      ? "bg-indigo-950/30 border-indigo-500/50 text-indigo-300"
                      : "bg-[#030712] border-[#1e293b] text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={scrapeWebsite}
                    onChange={(e) => setScrapeWebsite(e.target.checked)}
                    disabled={isRunning || isSavingConfig}
                    className="mt-0.5 rounded border-[#1e293b] bg-[#030712] text-indigo-600 focus:ring-indigo-500/20 h-4 w-4"
                  />
                  <div className="flex-grow">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 text-indigo-400" />
                        Scrape website for emails
                      </span>
                      {scrapeWebsite ? (
                        <span className="text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold">
                          Finds Emails
                        </span>
                      ) : (
                        <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                          Unchecked (Fast)
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-500 mt-0.5">
                      {scrapeWebsite
                        ? "Visits each business website with Playwright to extract email IDs, contact forms, WhatsApp widgets, and tech stack."
                        : "Skips visiting external websites. Blazing-fast Google Maps sweep with name, address, phone & rating."}
                    </p>
                  </div>
                </label>

                {/* Scrape Social Media Option */}
                <label
                  className={`flex items-center gap-2 text-[10px] cursor-pointer select-none font-mono px-1 ${
                    scrapeSocialMedia ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={scrapeSocialMedia}
                    onChange={(e) => setScrapeSocialMedia(e.target.checked)}
                    disabled={isRunning || isSavingConfig}
                    className="rounded border-[#1e293b] bg-[#030712] text-emerald-500 focus:ring-emerald-500/20 h-3.5 w-3.5"
                  />
                  <span>
                    Scrape social media
                    <span className="ml-1 text-[8px] text-slate-600 font-sans">(IG · FB · LinkedIn)</span>
                  </span>
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isAgentActive || isSavingConfig}
                  className="flex-grow text-xs font-semibold font-mono py-2 rounded-lg border border-indigo-500/30 text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 focus:outline-none transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingConfig ? "Saving..." : configSuccess ? "Config Written ✅" : "Save parameters"}
                </button>
              </div>
            </form>
          </div>

          {/* Execution Action */}
          <div className="mt-5 pt-4 border-t border-[#1e293b]/70">
            {isAgentActive ? (
              <button
                type="button"
                onClick={handleStopScraper}
                disabled={isStopping}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 focus:outline-none transition-all disabled:opacity-50 cursor-pointer animate-pulse"
              >
                {isStopping ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    Stopping Agent...
                  </>
                ) : (
                  <>
                    <X className="h-4.5 w-4.5 stroke-[2.5]" />
                    Stop LeadFinder Agent
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartScraper}
                disabled={isSavingConfig}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 focus:outline-none transition-all disabled:opacity-50 cursor-pointer"
              >
                <Play className="h-4.5 w-4.5 fill-white" />
                Run LeadFinder Agent
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two-Phase Automation Pipeline Status */}
      <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1e293b]/70">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
              2-Phase Automatic Discovery & Enrichment
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            One button • Zero manual steps
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Phase 1: Maps Scraping */}
          <div
            className={`p-4 rounded-xl border font-mono transition-all ${
              scraperStatus.phase === "maps"
                ? "bg-indigo-950/30 border-indigo-500/60 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950/30"
                : scraperStatus.phase === "email" || (scraperStatus.phase === "idle" && scraperStatus.outputFile)
                ? "bg-emerald-950/15 border-emerald-500/30 text-emerald-300"
                : "bg-[#030712] border-[#1e293b] text-slate-400"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Phase 1
              </span>
              {scraperStatus.phase === "maps" ? (
                <span className="flex items-center gap-1.5 text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                  <Loader2 className="h-3 w-3 animate-spin" /> Scraping Google Maps
                </span>
              ) : scraperStatus.phase === "email" || (scraperStatus.phase === "idle" && scraperStatus.outputFile) ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Phase 1 Complete
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">Ready</span>
              )}
            </div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-indigo-400" /> Google Maps Lead Scraper
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-1 leading-relaxed">
              Finds business names, phone numbers, ratings, reviews, and website URLs in the map radius.
            </p>
          </div>

          {/* Phase 2: Email Enrichment */}
          <div
            className={`p-4 rounded-xl border font-mono transition-all ${
              scraperStatus.phase === "email"
                ? "bg-emerald-950/30 border-emerald-500/60 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/30 animate-pulse"
                : scraperStatus.phase === "idle" && scraperStatus.outputFile
                ? "bg-emerald-950/15 border-emerald-500/30 text-emerald-300"
                : "bg-[#030712] border-[#1e293b] text-slate-400"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Phase 2
              </span>
              {scraperStatus.phase === "maps" ? (
                <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono bg-slate-800/40 px-2 py-0.5 rounded-full border border-slate-700/30">
                  <Clock className="h-3 w-3" /> Waiting for Maps
                </span>
              ) : scraperStatus.phase === "email" ? (
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <Loader2 className="h-3 w-3 animate-spin" /> Visiting Websites ({scraperStatus.emailProgress.current}/{scraperStatus.emailProgress.total}) • {scraperStatus.emailProgress.emailsFound || 0} emails
                </span>
              ) : scraperStatus.phase === "idle" && scraperStatus.outputFile ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  <CheckCircle2 className="h-3 w-3" /> Phase 2 Complete ({scraperStatus.emailProgress.emailsFound || 0} emails found)
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">Auto Triggered</span>
              )}
            </div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-400" /> Website Email Enricher
            </div>
            <p className="text-[11px] text-slate-400 font-sans mt-1 leading-relaxed">
              Visits each discovered website to scrape corporate and decision-maker email addresses.
            </p>
          </div>
        </div>

        {/* Completed Output Banner */}
        {!dismissBanner && scraperStatus.phase === "idle" && scraperStatus.outputFile && (
          <div className="p-4.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs font-mono text-emerald-200 shadow-lg shadow-emerald-950/40 animate-in fade-in">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5 border border-emerald-500/30">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="font-bold text-white flex flex-wrap items-center gap-2">
                  <span className="text-sm">Enriched Leads Ready!</span>
                  <span className="text-[10px] font-normal bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    {scraperStatus.emailProgress.emailsFound || 0} emails discovered
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300 font-sans">
                  <span className="text-emerald-400 font-semibold font-mono text-xs">Saved File Location:</span>
                  <code className="bg-[#030712] border border-emerald-500/30 text-emerald-300 px-2.5 py-1 rounded-md text-[11px] font-mono select-all truncate max-w-md">
                    {scraperStatus.outputFile}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(scraperStatus.outputFile);
                      setCopiedPath(true);
                      setTimeout(() => setCopiedPath(false), 2000);
                    }}
                    className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 border border-slate-700"
                    title="Copy CSV file path to clipboard"
                  >
                    {copiedPath ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Path Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Path</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  fetchFolders();
                  fetchData();
                  const fname = scraperStatus.outputFile.replace(/^data\//, "");
                  setSelectedFolderId(fname);
                  setActiveTab("leads");
                }}
                className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30 transition-all text-xs"
              >
                Open in Leads Database <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDismissBanner(true)}
                className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer border border-slate-700/50"
                title="Dismiss banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Log Terminal underneath */}
      <div className="bg-[#090d16] border border-[#1e293b] rounded-2xl p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e293b]/60 mb-4">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white font-mono uppercase tracking-widest">
              Execution logs console
            </h3>
          </div>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScrollLogs}
              onChange={(e) => setAutoScrollLogs(e.target.checked)}
              className="rounded border-[#1e293b] bg-[#030712]"
            />
            <span>Auto-scroll</span>
          </label>
        </div>

        <div
          ref={terminalContainerRef}
          className="w-full h-60 bg-black/90 border border-slate-900 rounded-lg p-4 font-mono text-xs overflow-y-auto leading-relaxed text-[#10b981] whitespace-pre-wrap select-text scrollbar-thin"
        >
          {terminalLogs}
        </div>
      </div>
    </div>
  );
}
