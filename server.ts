/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { CONFIG } from "./src/config";
import { Lead, parseCSV, serializeCSV } from "./src/types";
import { runScraper, requestStopScraping } from "./src/mapsScraper";
import { enrichLeadsWithEmails, emailEnricherState } from "./src/emailEnricher";
import { logger, campaignLogger } from "./src/logger";
import { duplicateChecker } from "./src/duplicateChecker";
import { loadFailedLeads, retryFailedLeads, sendLeadToWebhook, fetchLeadsFromGoogleSheet, fetchSheetNamesFromGoogleSheet } from "./src/googleSheetsWebhook";
import {
  getWhatsAppStatus,
  initializeWhatsApp,
  disconnectWhatsApp,
  sendEmailOutreach,
  sendWhatsAppMessage,
  sendWhatsAppTestMessage
} from "./src/outreachService";
import { 
  generateOutreachCopy, 
  renderOutreachTemplate, 
  PitchTemplateConfig 
} from "./src/outreachCopy";
import { loadPitchTemplates, savePitchTemplates } from "./src/templateStorage";
import { generateAICopy } from "./src/aiCopyGenerator";

dotenv.config();

// Protect server process from unhandled background rejections (e.g. Puppeteer navigation race conditions)
process.on("unhandledRejection", (reason: any) => {
  logger.warn(`Unhandled Promise Rejection: ${reason?.message || String(reason)}`);
});

process.on("uncaughtException", (error: any) => {
  logger.error(`Uncaught Exception: ${error?.message || String(error)}`);
});

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Scraper runtime state
let isScrapingRunning = false;
let scraperResult: any = null;

// CORS headers for local debugging
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// API Routes
app.get("/api/config", (req, res) => {
  try {
    // Read directly from file to be updated on client changes
    const configPath = path.join(process.cwd(), "src/config.ts");
    if (fs.existsSync(configPath)) {
      // Merge in-memory CONFIG with flags from scraper-filters.json
      const filtersPath = path.join(process.cwd(), "scraper-filters.json");
      let scrapeWeb = false;
      let scrapeSocial = true;
      let finderMode: string = "all";
      try {
        if (fs.existsSync(filtersPath)) {
          const raw = JSON.parse(fs.readFileSync(filtersPath, "utf8"));
          scrapeWeb = raw.scrapeWebsite === true;
          scrapeSocial = raw.scrapeSocialMedia !== false;
          finderMode = raw.finderMode || "all";
        }
      } catch (e) { /* use default */ }
      res.json({ ...CONFIG, scrapeWebsite: scrapeWeb, scrapeSocialMedia: scrapeSocial, finderMode });
    } else {
      res.json({ businessType: "Dental Clinic", location: "Baner Pune", maxResults: 10, scrapeWebsite: false, scrapeSocialMedia: true });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to load config." });
  }
});

app.post("/api/config", (req, res) => {
  try {
    const { businessType, location, maxResults, enableSimulation, headless, lat, lng, radius, scrapeWebsite, scrapeSocialMedia, finderMode } = req.body;
    if (!businessType || !location || maxResults === undefined) {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    // Resolve flags — scrapeWebsite defaults to false, scrapeSocialMedia defaults to true
    const web = Boolean(scrapeWebsite);
    const social = scrapeSocialMedia !== undefined ? Boolean(scrapeSocialMedia) : true;
    const mode = ["all", "noWebsite", "outdatedWebsite"].includes(finderMode) ? finderMode : "all";

    const configPath = path.join(process.cwd(), "src/config.ts");
    const newContent = `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from "./types";

export const CONFIG: Config = {
  businessType: ${JSON.stringify(businessType)},
  location: ${JSON.stringify(location)},
  maxResults: ${parseInt(maxResults, 10)},
  enableSimulation: ${Boolean(enableSimulation)},
  headless: ${Boolean(headless)},
  lat: ${lat !== undefined && lat !== null ? parseFloat(lat) : "undefined"},
  lng: ${lng !== undefined && lng !== null ? parseFloat(lng) : "undefined"},
  radius: ${radius !== undefined && radius !== null ? parseFloat(radius) : "undefined"},
  scrapeWebsite: ${web},
  scrapeSocialMedia: ${social},
  finderMode: ${JSON.stringify(mode)},
};
`;
    fs.writeFileSync(configPath, newContent, "utf8");

    // Also update current memory instance
    CONFIG.businessType = businessType;
    CONFIG.location = location;
    CONFIG.maxResults = parseInt(maxResults, 10);
    CONFIG.enableSimulation = Boolean(enableSimulation);
    CONFIG.headless = Boolean(headless);
    CONFIG.lat = lat !== undefined && lat !== null ? parseFloat(lat) : undefined;
    CONFIG.lng = lng !== undefined && lng !== null ? parseFloat(lng) : undefined;
    CONFIG.radius = radius !== undefined && radius !== null ? parseFloat(radius) : undefined;
    CONFIG.scrapeWebsite = web;
    CONFIG.scrapeSocialMedia = social;
    CONFIG.finderMode = mode as any;

    // Write flags to scraper-filters.json so scraper reads it
    // fresh at run time without needing a server restart
    const filtersPath = path.join(process.cwd(), "scraper-filters.json");
    fs.writeFileSync(filtersPath, JSON.stringify({
      scrapeWebsite: web,
      scrapeSocialMedia: social,
      finderMode: mode,
    }, null, 2), "utf8");

    logger.info(`Configuration updated: ${businessType} in ${location} (max: ${maxResults}, coords: ${lat},${lng}, radius: ${radius}km, web=${web}, social=${social}, mode=${mode})`);
    res.json({ success: true, config: CONFIG });
  } catch (error) {
    res.status(500).json({ error: "Failed to write configuration file." });
  }
});

app.get("/api/processed", (req, res) => {
  let leads = duplicateChecker.loadLeads();
  if (!leads || leads.length === 0) {
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (fs.existsSync(dataDir)) {
        const files = fs.readdirSync(dataDir).filter(f => f.toLowerCase().endsWith(".csv"));
        const allLeads: Lead[] = [];
        const seen = new Set<string>();
        for (const file of files) {
          const fullPath = path.join(dataDir, file);
          const content = fs.readFileSync(fullPath, "utf8");
          const parsed = parseCsvToLeads(content);
          for (const l of parsed) {
            const key = `${l.businessName}_${l.address}`;
            if (!seen.has(key)) {
              seen.add(key);
              allLeads.push(l);
            }
          }
        }
        leads = allLeads;
      }
    } catch (e) {
      logger.error(`Error loading leads from data/ for /api/processed: ${e}`);
    }
  }
  res.json(leads || []);
});

app.post("/api/load-sample-leads", (req, res) => {
  const sampleLeads: Lead[] = [
    {
      businessName: "Elite Multi-Specialty Dental Clinic",
      phone: "+91 98231 45678",
      address: "College Road, Near Circle, Nashik, MH",
      rating: 4.8,
      reviews: 184,
      website: "http://elitedentalnashik.com",
      mapsUrl: "https://maps.google.com/?cid=elite_dental",
      category: "Dental Clinic",
      websiteMissing: false,
      leadScore: 168,
      leadPriority: "HOT",
      websiteStatus: "OUTDATED",
      outdatedReason: "Copyright 2019, non-responsive desktop layout, missing SSL, and no online appointment booking.",
      redesignOpportunity: "HIGH",
      instagramUrl: "https://instagram.com/elitedentalnashik",
      instagramStatus: "INACTIVE",
      instagramLastPost: "2025-06-12",
      facebookUrl: "https://facebook.com/elitedentalnashik",
      facebookStatus: "ACTIVE",
      facebookLastPost: "2026-04-10",
      whatsappPresent: false,
      appointmentSystem: false,
      emails: ["info@elitedentalnashik.com", "dr.patil@elitedental.com"],
      linkedinUrl: "",
      linkedinStatus: "NOT_FOUND",
      googleAnalyticsPresent: false,
      metaPixelPresent: false,
      aiInsight: "Active dental practice with 180+ reviews but losing mobile patients due to outdated 2019 website. High redesign value with online booking and WhatsApp lead capture.",
      dateAdded: new Date().toISOString().split("T")[0]
    },
    {
      businessName: "Apex Orthopedic & Joint Care Hospital",
      phone: "+91 94222 33445",
      address: "Gangapur Road, Beside City Center, Nashik, MH",
      rating: 4.6,
      reviews: 240,
      website: "",
      mapsUrl: "https://maps.google.com/?cid=apex_ortho",
      category: "Orthopedic Hospital",
      websiteMissing: true,
      leadScore: 185,
      leadPriority: "HOT",
      websiteStatus: "MISSING",
      outdatedReason: "No website exists. Operating solely via Google Maps and direct patient walk-ins.",
      redesignOpportunity: "HIGH",
      instagramUrl: "",
      instagramStatus: "NOT_FOUND",
      instagramLastPost: "",
      facebookUrl: "https://facebook.com/apexorthohospital",
      facebookStatus: "INACTIVE",
      facebookLastPost: "2025-09-20",
      whatsappPresent: false,
      appointmentSystem: false,
      emails: ["contact@apexortho.in"],
      linkedinUrl: "",
      linkedinStatus: "NOT_FOUND",
      googleAnalyticsPresent: false,
      metaPixelPresent: false,
      aiInsight: "High-volume hospital with 240 reviews but 0 web presence. Pitch a modern medical portal with doctor profiles and appointment scheduling.",
      dateAdded: new Date().toISOString().split("T")[0]
    },
    {
      businessName: "CloudTech Software Solutions",
      phone: "+91 20 6789 0123",
      address: "Baner Highway Junction, Pune, MH",
      rating: 4.4,
      reviews: 62,
      website: "https://cloudtechsolutions.in",
      mapsUrl: "https://maps.google.com/?cid=cloudtech_pune",
      category: "Software Company",
      websiteMissing: false,
      leadScore: 92,
      leadPriority: "WARM",
      websiteStatus: "WORKING",
      outdatedReason: "Website is mobile-responsive with modern UI.",
      redesignOpportunity: "LOW",
      instagramUrl: "https://instagram.com/cloudtech_pune",
      instagramStatus: "ACTIVE",
      instagramLastPost: "2026-08-15",
      facebookUrl: "https://facebook.com/cloudtechsolutions",
      facebookStatus: "ACTIVE",
      facebookLastPost: "2026-08-20",
      whatsappPresent: true,
      appointmentSystem: true,
      emails: ["careers@cloudtechsolutions.in", "sales@cloudtechsolutions.in"],
      linkedinUrl: "https://linkedin.com/company/cloudtech-solutions",
      linkedinStatus: "ACTIVE",
      googleAnalyticsPresent: true,
      metaPixelPresent: true,
      aiInsight: "Well-established IT company with modern website and active social channels. Opportunity for outsourcing dev talent and AI agent automation.",
      dateAdded: new Date().toISOString().split("T")[0]
    },
    {
      businessName: "Siddheshwar Ayurvedic Wellness Center",
      phone: "+91 98811 22334",
      address: "MG Road, Sharanpur, Nashik, MH",
      rating: 4.9,
      reviews: 98,
      website: "http://siddheshwar-ayurveda.org",
      mapsUrl: "https://maps.google.com/?cid=siddheshwar_ayur",
      category: "Ayurvedic Clinic",
      websiteMissing: false,
      leadScore: 174,
      leadPriority: "HOT",
      websiteStatus: "OUTDATED",
      outdatedReason: "Old table-based layout from 2017, no mobile responsiveness, broken image links, missing WhatsApp chat.",
      redesignOpportunity: "HIGH",
      instagramUrl: "",
      instagramStatus: "NOT_FOUND",
      instagramLastPost: "",
      facebookUrl: "",
      facebookStatus: "NOT_FOUND",
      facebookLastPost: "",
      whatsappPresent: false,
      appointmentSystem: false,
      emails: ["info@siddheshwar-ayurveda.org"],
      linkedinUrl: "",
      linkedinStatus: "NOT_FOUND",
      googleAnalyticsPresent: false,
      metaPixelPresent: false,
      aiInsight: "Top-rated 4.9★ wellness center whose online image is hurt by a 2017 broken web design. Great target for wellness branding overhaul.",
      dateAdded: new Date().toISOString().split("T")[0]
    },
    {
      businessName: "Kalyan Diagnostic & Pathology Lab",
      phone: "+91 253 234 5678",
      address: "Canada Corner, Sharanpur Road, Nashik, MH",
      rating: 4.3,
      reviews: 145,
      website: "http://kalyanpathology.com",
      mapsUrl: "https://maps.google.com/?cid=kalyan_diag",
      category: "Diagnostic Center",
      websiteMissing: false,
      leadScore: 156,
      leadPriority: "HOT",
      websiteStatus: "BROKEN",
      outdatedReason: "Domain server connection timed out / HTTP 500 error. Website is down.",
      redesignOpportunity: "HIGH",
      instagramUrl: "",
      instagramStatus: "NOT_FOUND",
      instagramLastPost: "",
      facebookUrl: "https://facebook.com/kalyanlab",
      facebookStatus: "INACTIVE",
      facebookLastPost: "2025-01-10",
      whatsappPresent: false,
      appointmentSystem: false,
      emails: ["reports@kalyanpathology.com"],
      linkedinUrl: "",
      linkedinStatus: "NOT_FOUND",
      googleAnalyticsPresent: false,
      metaPixelPresent: false,
      aiInsight: "Busy pathology lab whose website is currently broken and unreachable. Urgent pitch to restore patient report portal and home collection booking.",
      dateAdded: new Date().toISOString().split("T")[0]
    }
  ];

  for (const lead of sampleLeads) {
    duplicateChecker.saveLead(lead);
  }

  res.json({ success: true, count: sampleLeads.length, leads: duplicateChecker.loadLeads() });
});

app.post("/api/sync-google-sheet", async (req, res) => {
  try {
    const sheetNames = await fetchSheetNamesFromGoogleSheet();
    let totalSynced = 0;
    const namesToFetch = sheetNames.length > 0 ? sheetNames : ["All_Leads"];
    for (const name of namesToFetch) {
      const sheetLeads = await fetchLeadsFromGoogleSheet(name);
      if (Array.isArray(sheetLeads)) {
        for (const lead of sheetLeads) {
          if (lead && lead.businessName) {
            duplicateChecker.saveLead(lead);
            totalSynced++;
          }
        }
      }
    }
    const all = duplicateChecker.loadLeads();
    res.json({ success: true, totalSynced, totalLeads: all.length, leads: all });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to sync sheet leads" });
  }
});

app.get("/api/failed", (req, res) => {
  const leads = loadFailedLeads();
  res.json(leads);
});

app.get("/api/logs", (req, res) => {
  const logs = logger.readLogs();
  res.json({ logs });
});

app.get("/api/campaign/logs", (req, res) => {
  const logs = campaignLogger.readLogs();
  res.json({ logs });
});

app.post("/api/campaign/logs/clear", (req, res) => {
  campaignLogger.clear();
  res.json({ success: true, message: "Campaign logs cleared." });
});


// ─── Scraper phase tracker ─────────────────────────────────────────────────
// "maps" = Google Maps scraping, "email" = email enrichment, "idle" = done
let scraperPhase: "maps" | "email" | "idle" = "idle";
let scraperOutputFile = "";

app.post("/api/run-scraper", async (req, res) => {
  if (isScrapingRunning || emailEnricherState.isRunning) {
    return res.status(400).json({ error: "Scraping session is already active." });
  }

  isScrapingRunning = true;
  scraperPhase = "maps";
  scraperOutputFile = "";
  res.json({ success: true, message: "Scraper launched in background." });

  try {
    logger.clear();
    const result = await runScraper();
    scraperResult = result;

    // ── Phase 2: auto email enrichment ────────────────────────────────────
    const leads = duplicateChecker.loadLeads();
    const leadsWithSite = leads.filter(l => l.website && l.website.trim() !== "");
    if (leadsWithSite.length > 0 && !emailEnricherState.cancelRequested) {
      scraperPhase = "email";
      logger.info(`Email enricher: starting auto-enrichment for ${leadsWithSite.length} leads…`);
      const enriched = await enrichLeadsWithEmails(leads, 3, 3);
      duplicateChecker.saveAll(enriched);

      // Save enriched CSV to data/ and data/<location>/email/
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}`;
      const cleanCat = CONFIG.businessType.toLowerCase().replace(/[^a-z0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"") || "business";
      const cleanLoc = CONFIG.location.toLowerCase().replace(/[^a-z0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"") || "general";
      const csvFilename = `${cleanCat}_${cleanLoc}_${ts}_emails.csv`;
      
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const locationEmailDir = path.join(dataDir, cleanLoc, "email");
      if (!fs.existsSync(locationEmailDir)) fs.mkdirSync(locationEmailDir, { recursive: true });

      const csvPath = path.join(dataDir, csvFilename);
      const locationEmailCsvPath = path.join(locationEmailDir, csvFilename);

      // Build CSV content
      const headers = ["Business Name","Phone","Address","Rating","Reviews","Website","Category","Lead Score","Lead Priority","Emails","Instagram","Facebook","LinkedIn","AI Insight","Date Added"];
      const rows = enriched.map(l => [
        l.businessName, l.phone, l.address, l.rating, l.reviews, l.website, l.category,
        l.leadScore, l.leadPriority, (l.emails||[]).join(";"),
        l.instagramUrl||"", l.facebookUrl||"", l.linkedinUrl||"",
        (l.aiInsight||"").replace(/\n/g," "), l.dateAdded
      ]);
      const csvLines = [headers, ...rows].map(row =>
        row.map(v => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")
      ).join("\n");
      fs.writeFileSync(csvPath, csvLines, "utf8");
      fs.writeFileSync(locationEmailCsvPath, csvLines, "utf8");
      scraperOutputFile = `data/${cleanLoc}/email/${csvFilename}`;
      logger.success(`Enriched CSV saved to data/${csvFilename}`);
      logger.success(`Location email copy saved to ${scraperOutputFile}`);
    }
  } catch (error: any) {
    logger.error("Scraper crash in server-runner execution thread", error);
  } finally {
    isScrapingRunning = false;
    emailEnricherState.isRunning = false;
    scraperPhase = "idle";
  }
});

// ─── New clean scraper API routes ─────────────────────────────────────────────
app.post("/api/maps-scraper/start", async (req, res) => {
  // Delegates to /api/run-scraper logic — same behaviour, cleaner name
  if (isScrapingRunning || emailEnricherState.isRunning) {
    return res.status(400).json({ error: "Scraping session is already active." });
  }
  isScrapingRunning = true;
  scraperPhase = "maps";
  scraperOutputFile = "";
  res.json({ success: true, message: "Scraper launched in background." });

  try {
    logger.clear();
    const result = await runScraper();
    scraperResult = result;
    const leads = duplicateChecker.loadLeads();
    const leadsWithSite = leads.filter(l => l.website && l.website.trim() !== "");
    if (leadsWithSite.length > 0 && !emailEnricherState.cancelRequested) {
      scraperPhase = "email";
      const enriched = await enrichLeadsWithEmails(leads, 3, 3);
      duplicateChecker.saveAll(enriched);
      const now = new Date();
      const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}`;
      const cleanCat = CONFIG.businessType.toLowerCase().replace(/[^a-z0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"") || "business";
      const cleanLoc = CONFIG.location.toLowerCase().replace(/[^a-z0-9]/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"") || "general";
      const csvFilename = `${cleanCat}_${cleanLoc}_${ts}_emails.csv`;

      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const locationEmailDir = path.join(dataDir, cleanLoc, "email");
      if (!fs.existsSync(locationEmailDir)) fs.mkdirSync(locationEmailDir, { recursive: true });

      const csvPath = path.join(dataDir, csvFilename);
      const locationEmailCsvPath = path.join(locationEmailDir, csvFilename);

      const headers = ["Business Name","Phone","Address","Rating","Reviews","Website","Category","Lead Score","Lead Priority","Emails","Instagram","Facebook","LinkedIn","AI Insight","Date Added"];
      const rows = enriched.map(l => [l.businessName,l.phone,l.address,l.rating,l.reviews,l.website,l.category,l.leadScore,l.leadPriority,(l.emails||[]).join(";"),l.instagramUrl||"",l.facebookUrl||"",l.linkedinUrl||"",(l.aiInsight||"").replace(/\n/g," "),l.dateAdded]);
      const csvLines = [headers,...rows].map(row=>row.map(v=>{const s=String(v??"");return s.includes(",")||s.includes('"')||s.includes("\n")?`"${s.replace(/"/g,'""')}"`   :s;}).join(",")).join("\n");
      fs.writeFileSync(csvPath, csvLines, "utf8");
      fs.writeFileSync(locationEmailCsvPath, csvLines, "utf8");
      scraperOutputFile = `data/${cleanLoc}/email/${csvFilename}`;
      logger.success(`Enriched CSV saved to data/${csvFilename}`);
      logger.success(`Location email copy saved to ${scraperOutputFile}`);
    }
  } catch (error: any) {
    logger.error("maps-scraper/start crash", error);
  } finally {
    isScrapingRunning = false;
    emailEnricherState.isRunning = false;
    scraperPhase = "idle";
  }
});

app.get("/api/maps-scraper/status", (req, res) => {
  const emailProg = emailEnricherState;
  res.json({
    isRunning: isScrapingRunning || emailEnricherState.isRunning,
    phase: scraperPhase,
    mapsProgress: {
      status: scraperPhase === "maps" ? "Scraping Google Maps…" : scraperPhase === "email" ? "Maps complete" : "Idle",
    },
    emailProgress: {
      current: emailProg.current,
      total: emailProg.total,
      emailsFound: emailProg.emailsFound || 0,
      status: emailProg.status,
    },
    outputFile: scraperOutputFile,
  });
});

app.post("/api/maps-scraper/stop", (req, res) => {
  requestStopScraping();
  emailEnricherState.cancelRequested = true;
  res.json({ success: true, message: "Stop requested for scraper and email enricher." });
});

// ─── Email enricher standalone routes ────────────────────────────────────────
app.post("/api/email-scraper/start", async (req, res) => {
  if (emailEnricherState.isRunning) {
    return res.status(400).json({ error: "Email enricher is already running." });
  }
  const { inputFile, parallelism } = req.body;
  if (!inputFile) {
    return res.status(400).json({ error: "inputFile is required (e.g. 'data/leads.csv')" });
  }

  const safeRel = path.normalize(String(inputFile)).replace(/^(\.\.[\/\\])+/, "");
  const fullPath = path.join(process.cwd(), safeRel.startsWith("data/") ? safeRel : `data/${safeRel}`);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: `File not found: ${safeRel}` });
  }

  res.json({ success: true, message: "Email enricher started in background.", inputFile: safeRel });

  try {
    const content = fs.readFileSync(fullPath, "utf8");
    const { rows } = parseCSV(content);
    if (!rows || rows.length === 0) {
      logger.warn("Email enricher: no rows found in input file.");
      return;
    }

    // Convert rows to minimal Lead objects for enrichment
    const getField = (row: Record<string,string>, ...candidates: string[]) => {
      for (const c of candidates) {
        for (const [k, v] of Object.entries(row)) {
          if (k.trim().toLowerCase() === c.toLowerCase()) return (v||"").trim();
        }
      }
      return "";
    };

    const leads: Lead[] = rows.map((row, idx) => ({
      businessName: getField(row,"Business Name","Name","Company") || `Lead #${idx+1}`,
      phone: getField(row,"Phone","Mobile","Contact"),
      address: getField(row,"Address","Location","City"),
      website: getField(row,"Website","URL","Domain","website"),
      category: getField(row,"Category","Industry","Type") || "General",
      emails: getField(row,"Emails","Email","E-mail").split(/[;,|]/).map(e=>e.trim()).filter(Boolean),
      rating: parseFloat(getField(row,"Rating","Stars")||"0")||0,
      reviews: parseInt(getField(row,"Reviews","Review Count")||"0",10)||0,
      leadScore: parseInt(getField(row,"Lead Score","Score")||"50",10)||50,
      leadPriority: (getField(row,"Lead Priority","Priority")||"COLD") as any,
      websiteStatus: "MISSING" as any, websiteMissing: !getField(row,"Website","URL","Domain"),
      instagramUrl:"", instagramStatus:"NOT_FOUND" as any, instagramLastPost:"",
      facebookUrl:"", facebookStatus:"NOT_FOUND" as any, facebookLastPost:"",
      linkedinUrl:"", linkedinStatus:"NOT_FOUND" as any,
      whatsappPresent:false, appointmentSystem:false,
      googleAnalyticsPresent:false, metaPixelPresent:false,
      aiInsight:"", mapsUrl:"", dateAdded: new Date().toISOString().split("T")[0],
    } as Lead));

    const enriched = await enrichLeadsWithEmails(leads, parallelism || 3, 3);

    // Save result CSV
    const baseName = path.basename(fullPath, ".csv");
    const outName = baseName.endsWith("_emails") ? baseName : `${baseName}_emails`;
    const outPath = path.join(path.dirname(fullPath), `${outName}.csv`);
    const headers = Object.keys(rows[0] || {});
    if (!headers.includes("Emails")) headers.push("Emails");
    const csvLines = [
      headers.join(","),
      ...enriched.map(l => {
        const orig = rows.find(r => {
          const gf = (candidates: string[]) => { for (const c of candidates) { for (const [k,v] of Object.entries(r)) { if (k.trim().toLowerCase()===c.toLowerCase()) return (v||"").trim(); } } return ""; };
          return gf(["Business Name","Name","Company"]) === l.businessName;
        }) || {};
        return headers.map(h => {
          const v = h === "Emails" ? (l.emails||[]).join(";") : (orig as any)[h] || "";
          const s = String(v??"");
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g,'""')}"` : s;
        }).join(",");
      })
    ].join("\n");
    fs.writeFileSync(outPath, csvLines, "utf8");
    emailEnricherState.outputFile = `data/${path.basename(outPath)}`;
    logger.success(`Email enricher complete. Output: ${emailEnricherState.outputFile}`);
  } catch (err: any) {
    logger.error(`Email enricher crashed: ${err?.message || err}`);
    emailEnricherState.isRunning = false;
  }
});

app.get("/api/email-scraper/status", (req, res) => {
  res.json({
    isRunning: emailEnricherState.isRunning,
    progress: {
      current: emailEnricherState.current,
      total: emailEnricherState.total,
      status: emailEnricherState.status,
      processed: emailEnricherState.current,
      failed: 0,
    },
    outputFile: emailEnricherState.outputFile,
  });
});

app.post("/api/email-scraper/stop", (req, res) => {
  emailEnricherState.cancelRequested = true;
  emailEnricherState.isRunning = false;
  emailEnricherState.status = "Cancelled by user";
  res.json({ success: true, message: "Email enricher stop requested." });
});

app.post("/api/stop-scraper", (req, res) => {
  if (!isScrapingRunning && !emailEnricherState.isRunning) {
    return res.status(400).json({ error: "Scraping session is not active." });
  }
  requestStopScraping();
  emailEnricherState.cancelRequested = true;
  res.json({ success: true, message: "Stop requested." });
});

app.post("/api/retry-failed", async (req, res) => {
  try {
    const result = await retryFailedLeads();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: "Failed to retry delivery." });
  }
});

app.post("/api/test-webhook", async (req, res) => {
  try {
    const testLead: Lead = {
      businessName: "Test Lead (LeadFinder Verification)",
      phone: "+1 (555) 019-2831",
      address: "123 Diagnostic Lane, Silicon Valley, CA",
      rating: 4.9,
      reviews: 42,
      website: "",
      mapsUrl: "https://google.com/maps/test",
      category: "Software Testing",
      websiteMissing: true,
      leadScore: 95,
      dateAdded: new Date().toISOString(),
      websiteStatus: "MISSING",
      instagramUrl: "",
      instagramStatus: "NOT_FOUND",
      instagramLastPost: "",
      facebookUrl: "",
      facebookStatus: "NOT_FOUND",
      facebookLastPost: "",
      whatsappPresent: false,
      appointmentSystem: false,
      leadPriority: "HOT",
      aiInsight: "Excellent candidate for website creation and social presence.",
      emails: [],
      linkedinUrl: "",
      linkedinStatus: "NOT_FOUND",
      googleAnalyticsPresent: false,
      metaPixelPresent: false
    };

    const success = await sendLeadToWebhook(testLead);
    if (success) {
      res.json({ success: true, message: "Webhook ping successful! Check your sheet for the test line." });
    } else {
      res.json({ success: false, error: "Authentication or setup error (status code 403 or server unreachable)." });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to issue test webhook call." });
  }
});

app.post("/api/clear-leads", (req, res) => {
  try {
    duplicateChecker.saveAll([]);
    const failedPath = path.join(process.cwd(), "failed-leads.json");

    fs.writeFileSync(failedPath, JSON.stringify([], null, 2), "utf8");
    logger.clear();
    logger.success("Processed, Data folder (data/leads.json, data/leads.csv), and Failed Lead Caches have been successfully reset!");

    res.json({ success: true, message: "Lead caches cleared successfully." });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset lead caches." });
  }
});

// Delete single or multiple leads
app.post("/api/leads/delete", (req, res) => {
  try {
    const { businessName, address, mapsUrl, items } = req.body;
    if (Array.isArray(items) && items.length > 0) {
      const remaining = duplicateChecker.deleteLeads(items);
      return res.json({ success: true, count: remaining.length, leads: remaining });
    }
    if (!businessName && !mapsUrl) {
      return res.status(400).json({ error: "Missing businessName or mapsUrl for deletion" });
    }
    const remaining = duplicateChecker.deleteLead(businessName, address, mapsUrl);
    res.json({ success: true, count: remaining.length, leads: remaining });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete lead" });
  }
});

// Download data folder CSV or JSON
app.get("/api/download/csv", (req, res) => {
  const csvPath = path.join(process.cwd(), "data/leads.csv");
  if (fs.existsSync(csvPath)) {
    res.download(csvPath, "leadfinder-leads.csv");
  } else {
    const all = duplicateChecker.loadLeads();
    duplicateChecker.saveAll(all);
    res.download(csvPath, "leadfinder-leads.csv");
  }
});

app.get("/api/download/json", (req, res) => {
  const jsonPath = path.join(process.cwd(), "data/leads.json");
  if (fs.existsSync(jsonPath)) {
    res.download(jsonPath, "leadfinder-leads.json");
  } else {
    const all = duplicateChecker.loadLeads();
    duplicateChecker.saveAll(all);
    res.download(jsonPath, "leadfinder-leads.json");
  }
});

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function parseCsvToLeads(csvText: string): Lead[] {
  const { rows } = parseCSV(csvText);
  if (!rows || rows.length === 0) return [];

  const getField = (row: Record<string, string>, ...candidates: string[]): string => {
    for (const c of candidates) {
      for (const [k, v] of Object.entries(row)) {
        if (k.trim().toLowerCase() === c.toLowerCase()) return (v || "").trim();
      }
    }
    return "";
  };

  return rows.map((row, idx) => {
    const businessName = getField(row, "Business Name", "Name", "Company", "Business", "Lead Name", "Title") || `Lead #${idx + 1}`;
    const phone = getField(row, "Phone", "Phone Number", "Mobile", "Contact", "Telephone");
    const address = getField(row, "Address", "Full Address", "Location", "Street", "City");
    const website = getField(row, "Website", "Website URL", "URL", "Domain");
    const category = getField(row, "Category", "Niche", "Industry", "Type") || "General Business";
    const ratingStr = getField(row, "Rating", "Stars", "Score Rating");
    const rating = ratingStr ? parseFloat(ratingStr) : undefined;
    const reviewsStr = getField(row, "Reviews", "Review Count", "Total Reviews");
    const reviews = reviewsStr ? parseInt(reviewsStr, 10) : undefined;
    const emailsRaw = getField(row, "Emails", "Email", "E-mail");
    const emails = emailsRaw ? emailsRaw.split(/[;,|]/).map(e => e.trim()).filter(Boolean) : [];
    const instagramUrl = getField(row, "Instagram", "Instagram URL", "IG");
    const facebookUrl = getField(row, "Facebook", "Facebook URL", "FB");
    const linkedinUrl = getField(row, "LinkedIn", "LinkedIn URL");
    const mapsUrl = getField(row, "Google Maps URL", "Maps URL", "Map Link");
    const leadScoreStr = getField(row, "Lead Score", "Score");
    let leadScore = leadScoreStr ? parseInt(leadScoreStr, 10) : 0;
    if (!leadScoreStr) {
      let calcScore = 35;
      if (emails.length > 0) calcScore += 45;
      if (phone) calcScore += 25;
      if (!website) calcScore += 40;
      if (rating && rating >= 4.0) calcScore += 20;
      if (instagramUrl || facebookUrl || linkedinUrl) calcScore += 15;
      leadScore = calcScore;
    }
    const priorityFromField = getField(row, "Lead Priority", "Priority");
    const leadPriority = (priorityFromField || (leadScore >= 120 ? "HOT" : leadScore >= 75 ? "WARM" : "COLD")).toUpperCase() as any;
    const websiteStatus = (getField(row, "Website Status", "Status") || (website ? "LIVE" : "MISSING")) as any;
    const aiInsight = getField(row, "AI Insight", "Insight", "Notes", "Description", "Outreach Pitch");
    const outdatedReason = getField(row, "Outdated Reason", "Audit Reason");
    const sheetName = getField(row, "Sheet Name", "Sheet", "Folder");
    const dateAdded = getField(row, "Date Added", "Date", "Created At") || new Date().toISOString();

    return {
      businessName,
      phone,
      address,
      website,
      websiteStatus,
      rating,
      reviews,
      category,
      leadScore,
      leadPriority,
      emails,
      aiInsight,
      outdatedReason,
      instagramUrl,
      facebookUrl,
      linkedinUrl,
      mapsUrl,
      sheetName,
      dateAdded
    } as Lead;
  });
}

// GET /api/folders - List all available CSV data files in data/
app.get("/api/folders", async (req, res) => {
  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const files = fs.readdirSync(dataDir);
    const csvFiles = files.filter(f => f.toLowerCase().endsWith(".csv"));

    const folders: any[] = [];

    // Process all CSV files directly in data/
    for (const file of csvFiles) {
      const fullPath = path.join(dataDir, file);
      try {
        const stats = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, "utf8");
        const leads = parseCsvToLeads(content);

        const categories = Array.from(new Set(leads.map(l => l.category).filter(Boolean)));
        const primaryCategory = categories.length === 1 ? categories[0] : `${categories.length} Categories`;

        folders.push({
          id: file,
          name: file,
          filename: file,
          filepath: `data/${file}`,
          type: "csv",
          fileSizeBytes: stats.size,
          fileSizeFormatted: formatBytes(stats.size),
          leadCount: leads.length,
          phoneCount: leads.filter(l => l.phone).length,
          emailCount: leads.filter(l => l.emails && l.emails.length > 0).length,
          hotCount: leads.filter(l => l.leadPriority === "HOT").length,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
          category: primaryCategory,
          description: `CSV file located in data/${file} (${formatBytes(stats.size)})`
        });
      } catch (fileErr) {
        logger.error(`Error processing CSV file ${file}:`, fileErr);
      }
    }

    // Process any CSV files located inside subdirectories of data/
    for (const item of files) {
      const subPath = path.join(dataDir, item);
      if (fs.existsSync(subPath) && fs.statSync(subPath).isDirectory()) {
        try {
          const subFiles = fs.readdirSync(subPath).filter(f => f.toLowerCase().endsWith(".csv"));
          for (const subFile of subFiles) {
            const subFull = path.join(subPath, subFile);
            const stats = fs.statSync(subFull);
            const content = fs.readFileSync(subFull, "utf8");
            const leads = parseCsvToLeads(content);
            const relPath = `${item}/${subFile}`;
            folders.push({
              id: relPath,
              name: subFile,
              filename: subFile,
              filepath: `data/${relPath}`,
              type: "csv",
              fileSizeBytes: stats.size,
              fileSizeFormatted: formatBytes(stats.size),
              leadCount: leads.length,
              phoneCount: leads.filter(l => l.phone).length,
              emailCount: leads.filter(l => l.emails && l.emails.length > 0).length,
              hotCount: leads.filter(l => l.leadPriority === "HOT").length,
              createdAt: stats.birthtime.toISOString(),
              updatedAt: stats.mtime.toISOString(),
              category: item,
              description: `Batch CSV in data/${relPath} (${formatBytes(stats.size)})`
            });
          }
        } catch (subErr) {
          logger.error(`Error reading sub-folder CSVs in ${item}:`, subErr);
        }
      }
    }

    res.json({ success: true, folders });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch CSV data files" });
  }
});

// GET /api/csv-data/:filename - Loads parsed leads from a specific CSV file in data/
app.get("/api/csv-data/:filename(*)", async (req, res) => {
  try {
    const rawFilename = req.params.filename;
    const safeRel = path.normalize(rawFilename).replace(/^(\.\.[\/\\])+/, "");
    const fullPath = path.join(process.cwd(), "data", safeRel);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: `CSV file "${safeRel}" not found in data/` });
    }

    const stats = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, "utf8");
    const leads = parseCsvToLeads(content);

    res.json({
      success: true,
      filename: safeRel,
      filepath: `data/${safeRel}`,
      fileSizeBytes: stats.size,
      fileSizeFormatted: formatBytes(stats.size),
      leads,
      total: leads.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to read CSV data file" });
  }
});

// POST /api/csv-data/upload - Uploads a new CSV file into data/
app.post("/api/csv-data/upload", async (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ error: "Filename and content are required" });
    }

    const cleanFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const finalFilename = cleanFilename.toLowerCase().endsWith(".csv") ? cleanFilename : `${cleanFilename}.csv`;
    const targetPath = path.join(process.cwd(), "data", finalFilename);

    fs.writeFileSync(targetPath, content, "utf8");
    logger.success(`Uploaded new CSV file to data/${finalFilename}`);

    const leads = parseCsvToLeads(content);

    res.json({
      success: true,
      filename: finalFilename,
      filepath: `data/${finalFilename}`,
      leadCount: leads.length
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to upload CSV file" });
  }
});

// DELETE /api/csv-data/:filename(*) - Delete a CSV file or directory inside data/
app.delete("/api/csv-data/:filename(*)", async (req, res) => {
  try {
    const rawParam = req.params.filename;
    const safeRel = path.normalize(rawParam).replace(/^(\.\.[\/\\])+/, "");
    const dataDir = path.resolve(process.cwd(), "data");
    const fullPath = path.resolve(dataDir, safeRel);

    if (!fullPath.startsWith(dataDir) || fullPath === dataDir) {
      return res.status(403).json({ error: "Access denied: cannot delete outside data directory" });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File or directory not found" });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      logger.info(`Deleted directory: data/${safeRel}`);
    } else {
      fs.unlinkSync(fullPath);
      logger.info(`Deleted file: data/${safeRel}`);
    }

    res.json({
      success: true,
      deleted: safeRel,
      type: stat.isDirectory() ? "directory" : "file"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete file or directory" });
  }
});

async function updateLeadOutreachStatus(businessName: string, channel: "email" | "whatsapp", status: "SENT" | "FAILED", mapsUrl?: string) {
  try {
    const leads = duplicateChecker.loadLeads();
    let targetLead: any = null;
    const updated = leads.map(lead => {
      if (lead.businessName === businessName || (mapsUrl && lead.mapsUrl === mapsUrl)) {
        targetLead = lead;
        if (channel === "email") {
          lead.emailStatus = status;
          lead.emailSentDate = new Date().toISOString().split("T")[0];
        } else if (channel === "whatsapp") {
          lead.whatsappStatus = status;
          lead.whatsappSentDate = new Date().toISOString().split("T")[0];
        }
      }
      return lead;
    });
    duplicateChecker.saveAll(updated);

    // Sync back to Google Sheet
    const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
    if (webhookUrl && webhookUrl.trim() !== "" && webhookUrl !== "YOUR_WEBHOOK_URL") {
      try {
        const payload = {
          action: "updateOutreach",
          businessName,
          mapsUrl: mapsUrl || (targetLead ? targetLead.mapsUrl : ""),
          emailStatus: channel === "email" ? status : undefined,
          emailSentDate: channel === "email" ? new Date().toISOString().split("T")[0] : undefined,
          whatsappStatus: channel === "whatsapp" ? status : undefined,
          whatsappSentDate: channel === "whatsapp" ? new Date().toISOString().split("T")[0] : undefined
        };
        const axios = (await import("axios")).default;
        const response = await axios.post(webhookUrl, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: 8000
        });

        let responseData = response.data;
        if (typeof responseData === "string") {
          try {
            responseData = JSON.parse(responseData);
          } catch (e) {
            // Ignore parse errors if it's not JSON
          }
        }
        if (responseData && typeof responseData === "object" && responseData.status === "error") {
          throw new Error(`Google Apps Script error: ${responseData.message}`);
        }

        logger.success(`Synchronized outreach status for '${businessName}' back to Google Sheet.`);
      } catch (err: any) {
        logger.warn(`Failed to sync outreach status back to Google Sheet: ${err.message || err}`);
      }
    }
  } catch (error) {
    console.error("Failed to update outreach status:", error);
  }
}

// SMTP configurations endpoints
app.get("/api/config/smtp", (req, res) => {
  res.json({
    host: process.env.SMTP_HOST || "",
    port: process.env.SMTP_PORT || "587",
    user: process.env.SMTP_USER || "",
    from: process.env.SMTP_FROM || "",
    hasPassword: !!process.env.SMTP_PASS
  });
});

app.post("/api/config/smtp", (req, res) => {
  try {
    const { host, port, user, pass, from } = req.body;
    const envPath = path.join(process.cwd(), ".env");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
    }

    const smtpKeys = {
      SMTP_HOST: host,
      SMTP_PORT: port,
      SMTP_USER: user,
      SMTP_PASS: pass,
      SMTP_FROM: from
    };

    for (const [key, val] of Object.entries(smtpKeys)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}="${val}"`);
      } else {
        envContent += `\n${key}="${val}"`;
      }
      process.env[key] = String(val);
    }

    fs.writeFileSync(envPath, envContent.trim() + "\n", "utf8");
    res.json({ success: true, message: "SMTP configuration updated successfully." });
  } catch (e) {
    res.status(500).json({ error: "Failed to write SMTP configurations." });
  }
});

// Pitch Templates endpoints
app.get("/api/config/templates", (req, res) => {
  try {
    const templates = loadPitchTemplates();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to load pitch templates: " + (err.message || err) });
  }
});

app.post("/api/config/templates", (req, res) => {
  try {
    const config: PitchTemplateConfig = req.body;
    savePitchTemplates(config);
    logger.success("Pitch message templates updated and saved to templates.json");
    res.json({ success: true, message: "Pitch templates updated successfully.", config });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save pitch templates: " + (err.message || err) });
  }
});

// WhatsApp endpoints
app.get("/api/whatsapp/status", (req, res) => {
  res.json(getWhatsAppStatus());
});

app.post("/api/whatsapp/initialize", (req, res) => {
  initializeWhatsApp();
  res.json({ success: true, message: "WhatsApp initialization launched." });
});

app.post("/api/whatsapp/disconnect", async (req, res) => {
  try {
    await disconnectWhatsApp();
    initializeWhatsApp();
    res.json({ success: true, message: "WhatsApp disconnected and re-initialized." });
  } catch (error: any) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

app.post("/api/whatsapp/send-test", async (req, res) => {
  try {
    const { phone } = req.body;
    const success = await sendWhatsAppTestMessage(phone);
    if (success) {
      res.json({ success: true, message: "Test message sent successfully." });
    } else {
      res.status(500).json({ error: "Failed to send test message." });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

// Geocoding Proxy endpoints
app.get("/api/geocode/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query parameter 'q'." });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(String(q))}&format=json&limit=5`, {
      headers: {
        "User-Agent": "LeadFinder-AI-Agent/1.0"
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.get("/api/geocode/reverse", async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: "Missing 'lat' or 'lon' parameters." });
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
      headers: {
        "User-Agent": "LeadFinder-AI-Agent/1.0"
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Data Reset endpoint
app.post("/api/reset-data", (req, res) => {
  try {
    const processedPath = path.join(process.cwd(), "processed-leads.json");
    const failedPath = path.join(process.cwd(), "failed-leads.json");
    const scraperLogPath = path.join(process.cwd(), "scraper-log.txt");

    fs.writeFileSync(processedPath, JSON.stringify([], null, 2), "utf8");
    fs.writeFileSync(failedPath, JSON.stringify([], null, 2), "utf8");
    fs.writeFileSync(scraperLogPath, "LeadFinder System reset successfully.\nReady.", "utf8");

    logger.clear();
    logger.success("Dashboard database has been completely wiped and reset!");

    // Also stop active campaign if running
    isCampaignRunning = false;
    campaignCancelRequested = true;

    res.json({ success: true, message: "System data completely reset." });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reset system data." });
  }
});

// ─── Attachment upload configuration ─────────────────────────────────────────
const ATTACHMENTS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });

// Outreach execution endpoints
app.post("/api/send-email", async (req, res) => {
  const { businessName, to, subject, body, attachmentFilename, attachmentPath } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ error: "Missing parameters (to, subject, body)" });
  }

  let resolvedAttachment: string | undefined;
  const candidateFile = attachmentFilename || attachmentPath;
  if (candidateFile) {
    const candidate = path.join(ATTACHMENTS_DIR, path.basename(candidateFile));
    if (fs.existsSync(candidate)) resolvedAttachment = candidate;
  }

  const success = await sendEmailOutreach(to, subject, body, resolvedAttachment);
  if (success) {
    await updateLeadOutreachStatus(businessName, "email", "SENT");
    res.json({ success: true, message: "Email sent successfully." });
  } else {
    await updateLeadOutreachStatus(businessName, "email", "FAILED");
    res.status(500).json({ error: "Failed to send email." });
  }
});

const attachmentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ATTACHMENTS_DIR),
  filename: (_req, file, cb) => {
    // Sanitize filename to prevent directory traversal / unsafe characters, keeping clean original name without starting random prefix
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment.pdf";
    cb(null, safe);
  }
});

const uploadMiddleware = multer({
  storage: attachmentStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg", "image/png", "image/webp"
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, WEBP`));
    }
  }
});

// Upload an attachment file — returns { filename, path, originalName, size }
app.post("/api/upload-attachment", (req, res) => {
  uploadMiddleware.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "File upload failed." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file received." });
    }
    logger.info(`Attachment uploaded: ${req.file.originalname} → ${req.file.filename} (${(req.file.size / 1024).toFixed(1)} KB)`);
    res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      size: req.file.size,
    });
  });
});

// Delete a previously uploaded attachment
app.delete("/api/delete-attachment/:filename", (req, res) => {
  const filename = path.basename(req.params.filename); // sanitize — no path traversal
  const filePath = path.join(ATTACHMENTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found." });
  }
  try {
    fs.unlinkSync(filePath);
    logger.info(`Attachment deleted: ${filename}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: `Failed to delete file: ${e.message}` });
  }
});

app.post("/api/send-whatsapp", async (req, res) => {
  const { businessName, phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "Missing parameters (phone, message)" });
  }
  const result = await sendWhatsAppMessage(phone, message);
  if (result === true) {
    await updateLeadOutreachStatus(businessName, "whatsapp", "SENT");
    res.json({ success: true, message: "WhatsApp message sent successfully." });
  } else if (result === "not_registered") {
    res.status(422).json({ error: "This number is not registered on WhatsApp." });
  } else {
    await updateLeadOutreachStatus(businessName, "whatsapp", "FAILED");
    res.status(500).json({ error: "Failed to send WhatsApp message." });
  }
});

app.post("/api/generate-copy", async (req, res) => {
  const { lead, config } = req.body;
  if (!lead) {
    return res.status(400).json({ error: "Missing lead parameter." });
  }
  try {
    const copy = await generateAICopy(lead, config);
    res.json(copy);
  } catch (error: any) {
    res.status(500).json({ error: error.message || String(error) });
  }
});

// Campaign variables
let isCampaignRunning = false;
let isCampaignPaused = false;
let campaignCancelRequested = false;
let activeCampaignMetadata: any = null;
let campaignProgress: {
  current: number;
  total: number;
  status: string;
  secondsRemaining: number;
  emailsSent: number;
  emailsFailed: number;
  whatsappSent: number;
  whatsappFailed: number;
  skipped: number;
  updatedRows?: any[];
  updatedHeaders?: string[];
} = {
  current: 0,
  total: 0,
  status: "Idle",
  secondsRemaining: 0,
  emailsSent: 0,
  emailsFailed: 0,
  whatsappSent: 0,
  whatsappFailed: 0,
  skipped: 0
};

// ─── Campaign History & Schedules Storage ─────────────────────────────────────
const CAMPAIGN_HISTORY_FILE = path.join(process.cwd(), "campaigns_history.json");
const CAMPAIGN_SCHEDULES_FILE = path.join(process.cwd(), "campaign_schedules.json");

function cleanBaseNameToTitle(rawName: string): string {
  if (!rawName) return "";
  let s = String(rawName).trim();
  s = s.replace(/\.[a-zA-Z0-9]+$/i, "");
  s = s.replace(/^local\s*file:\s*/i, "");
  // Remove date patterns like 2026-09-30_18-35 or 2026-09-30
  s = s.replace(/[\-_]?\d{4}[\-_]\d{2}[\-_]\d{2}(?:[\-_]\d{2}[\-_]\d{2}(?:[\-_]\d{2})?)?[\-_]?/gi, " ");
  // Remove trailing or isolated email / leads / enails tokens
  s = s.replace(/\b(emails?|enails?|leads?|data)\b/gi, " ");
  s = s.replace(/[\-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const words = s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return `${words.join(" ")} Campaign`;
}

function formatCampaignDisplayName(campaignName?: string, fileName?: string, rowCount?: number): string {
  if (campaignName && typeof campaignName === "string" && campaignName.trim()) {
    let clean = campaignName.trim();
    if (clean.toLowerCase().startsWith("local file:")) {
      clean = clean.replace(/^local file:\s*/i, "").trim();
    }
    if (!clean.toLowerCase().endsWith(".csv") && !clean.toLowerCase().includes(".csv")) {
      return clean;
    }
    const title = cleanBaseNameToTitle(clean);
    if (title) return title;
  }

  if (fileName && typeof fileName === "string") {
    const title = cleanBaseNameToTitle(path.basename(fileName));
    if (title) return title;
  }

  return `Outreach Campaign (${rowCount || 0} leads)`;
}

function loadCampaignHistory(): any[] {
  try {
    if (fs.existsSync(CAMPAIGN_HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(CAMPAIGN_HISTORY_FILE, "utf-8"));
      if (Array.isArray(data)) {
        return data.map(record => {
          if (!record || typeof record !== "object") return record;
          return {
            ...record,
            name: formatCampaignDisplayName(record.name, record.source, record.stats?.total || record.total)
          };
        });
      }
    }
  } catch (e) {
    logger.warn(`Failed to read campaign history: ${e}`);
  }
  return [];
}

function saveCampaignHistory(history: any[]) {
  try {
    fs.writeFileSync(CAMPAIGN_HISTORY_FILE, JSON.stringify(history, null, 2), "utf-8");
  } catch (e) {
    logger.error(`Failed to save campaign history: ${e}`);
  }
}

function recordCampaignCompleted(record: any) {
  const history = loadCampaignHistory();
  const idx = history.findIndex(h => h.id === record.id);
  if (idx >= 0) {
    history[idx] = { ...history[idx], ...record };
  } else {
    history.unshift(record);
  }
  if (history.length > 100) history.length = 100;
  saveCampaignHistory(history);
}

function loadCampaignSchedules(): any[] {
  try {
    if (fs.existsSync(CAMPAIGN_SCHEDULES_FILE)) {
      const data = JSON.parse(fs.readFileSync(CAMPAIGN_SCHEDULES_FILE, "utf-8"));
      return Array.isArray(data) ? data : [];
    }
  } catch (e) {
    logger.warn(`Failed to read campaign schedules: ${e}`);
  }
  return [];
}

function saveCampaignSchedules(schedules: any[]) {
  try {
    fs.writeFileSync(CAMPAIGN_SCHEDULES_FILE, JSON.stringify(schedules, null, 2), "utf-8");
  } catch (e) {
    logger.error(`Failed to save campaign schedules: ${e}`);
  }
}

async function runCampaignLoop(
  delaySeconds = 30,
  enableEmail = true,
  enableWhatsapp = true,
  dryRun = false,
  sheetName?: string,
  emailAttachmentPath?: string,
  campaignId?: string,
  campaignName?: string
) {
  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  const isSheetConfigured = webhookUrl && webhookUrl.trim() !== "" && webhookUrl !== "YOUR_WEBHOOK_URL";

  if (!isSheetConfigured) {
    campaignLogger.error("Outreach campaign aborted: GOOGLE_SHEET_WEBHOOK_URL is not configured. Campaigns can only run on leads stored in the Google Sheet.");
    campaignProgress.status = "Aborted: Google Sheet not configured";
    isCampaignRunning = false;
    isCampaignPaused = false;
    return;
  }

  const host = process.env.SMTP_HOST || "";
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const emailAvailable = !!(host && user && pass);

  const waStatusObj = getWhatsAppStatus();
  const whatsappAvailable = waStatusObj.status === "CONNECTED";


  if (!dryRun) {
    if (enableEmail && !emailAvailable) {
      campaignLogger.error("Outreach campaign aborted: Email outreach is active but SMTP is not configured in settings.");
      campaignProgress.status = "Aborted: SMTP not configured";
      isCampaignRunning = false;
      isCampaignPaused = false;
      return;
    }
    if (enableWhatsapp && !whatsappAvailable) {
      campaignLogger.error("Outreach campaign aborted: WhatsApp outreach is active but WhatsApp Gateway is inactive.");
      campaignProgress.status = "Aborted: WhatsApp not connected";
      isCampaignRunning = false;
      isCampaignPaused = false;
      return;
    }
    if (!enableEmail && !enableWhatsapp) {
      campaignLogger.error("Outreach campaign aborted: No delivery channel (Email or WhatsApp) is enabled.");
      campaignProgress.status = "Aborted: No channels active";
      isCampaignRunning = false;
      isCampaignPaused = false;
      return;
    }
  }

  const campId = campaignId || ("camp_" + Date.now());
  const campName = campaignName || (sheetName ? `Google Sheet: ${sheetName}` : "Google Sheet Outreach");
  activeCampaignMetadata = {
    id: campId,
    name: campName,
    type: "Google Sheet",
    source: sheetName || "Default Sheet",
    startTime: new Date().toISOString(),
    delaySeconds,
    channels: { email: enableEmail, whatsapp: enableWhatsapp },
    dryRun,
    status: "RUNNING"
  };

  campaignLogger.clear();
  campaignProgress.status = "Fetching leads from Google Sheet...";
  let leads = await fetchLeadsFromGoogleSheet(sheetName);

  if (!leads || leads.length === 0) {
    campaignLogger.error("Outreach campaign aborted: Failed to fetch leads from Google Sheet, or the sheet is empty.");
    campaignProgress.status = "Aborted: Failed to fetch leads from sheet";
    recordCampaignCompleted({
      ...activeCampaignMetadata,
      endTime: new Date().toISOString(),
      status: "Aborted",
      stats: { emailsSent: 0, emailsFailed: 0, whatsappSent: 0, whatsappFailed: 0, skipped: 0, total: 0 }
    });
    activeCampaignMetadata = null;
    isCampaignRunning = false;
    isCampaignPaused = false;
    return;
  }

  const targetLeads = leads.filter(lead => {
    const needsEmail = enableEmail && lead.emails && lead.emails.length > 0 && lead.emailStatus !== "SENT";
    const needsWhatsapp = enableWhatsapp && lead.phone && lead.whatsappStatus !== "SENT";
    return needsEmail || needsWhatsapp;
  });

  campaignProgress.total = targetLeads.length;
  campaignProgress.current = 0;
  campaignProgress.emailsSent = 0;
  campaignProgress.emailsFailed = 0;
  campaignProgress.whatsappSent = 0;
  campaignProgress.whatsappFailed = 0;
  campaignProgress.skipped = 0;

  if (targetLeads.length === 0) {
    campaignProgress.status = "Completed (No pending leads found)";
    campaignLogger.info("Outreach campaign completed: No pending leads found requiring outreach.");
    recordCampaignCompleted({
      ...activeCampaignMetadata,
      endTime: new Date().toISOString(),
      status: "Completed",
      stats: { emailsSent: 0, emailsFailed: 0, whatsappSent: 0, whatsappFailed: 0, skipped: 0, total: 0 }
    });
    activeCampaignMetadata = null;
    isCampaignRunning = false;
    isCampaignPaused = false;
    return;
  }

  campaignProgress.status = dryRun ? "Running (Simulation Mode)" : "Running";
  campaignLogger.info(`Starting automated outreach campaign (${dryRun ? "SIMULATION" : "LIVE"}) for ${targetLeads.length} leads...`);

  for (let i = 0; i < targetLeads.length; i++) {
    // Check if campaign is paused
    while (isCampaignPaused && !campaignCancelRequested) {
      campaignProgress.status = "Campaign Paused";
      if (activeCampaignMetadata) activeCampaignMetadata.status = "PAUSED";
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    if (campaignCancelRequested) {
      campaignLogger.warn("Outreach campaign cancelled by user.");
      campaignProgress.status = "Cancelled";
      break;
    }

    const lead = targetLeads[i];
    campaignProgress.current = i + 1;
    campaignProgress.status = `Processing lead ${i + 1}/${targetLeads.length}: ${lead.businessName}`;
    campaignLogger.info(`Campaign dispatching lead ${i + 1}/${targetLeads.length}: ${lead.businessName}`);

    const copy = await generateAICopy(lead);

    let skippedLead = true;

    // Send Email
    const recipient = lead.emails && lead.emails.length > 0 ? lead.emails[0] : "";
    if (enableEmail && recipient && lead.emailStatus !== "SENT") {
      skippedLead = false;
      if (dryRun) {
        campaignLogger.info(`[SIMULATION] Email would be sent to ${lead.businessName} (${recipient}) with subject: "${copy.emailSubject}"`);
        campaignProgress.emailsSent++;
      } else {
        if (emailAvailable) {
          campaignLogger.info(`Campaign sending email to ${lead.businessName} (${recipient})...`);
          const success = await sendEmailOutreach(recipient, copy.emailSubject, copy.emailBody, emailAttachmentPath);
          if (success) {
            await updateLeadOutreachStatus(lead.businessName, "email", "SENT", lead.mapsUrl);
            campaignProgress.emailsSent++;
            campaignLogger.success(`Email sent to ${lead.businessName} (${recipient})`);
          } else {
            await updateLeadOutreachStatus(lead.businessName, "email", "FAILED", lead.mapsUrl);
            campaignProgress.emailsFailed++;
            campaignLogger.error(`Email dispatch failed to ${lead.businessName} (${recipient})`);
          }
        } else {
          campaignLogger.warn(`Skipping Email for '${lead.businessName}': SMTP parameters are not configured in settings.`);
          await updateLeadOutreachStatus(lead.businessName, "email", "FAILED", lead.mapsUrl);
          campaignProgress.emailsFailed++;
        }
      }
    }

    // Send WhatsApp (Text-only, no attachments)
    if (enableWhatsapp && lead.phone && lead.whatsappStatus !== "SENT") {
      skippedLead = false;
      if (dryRun) {
        campaignLogger.info(`[SIMULATION] WhatsApp message would be sent to ${lead.businessName} (${lead.phone})`);
        campaignProgress.whatsappSent++;
      } else {
        if (whatsappAvailable) {
          campaignLogger.info(`Campaign sending WhatsApp to ${lead.businessName} (${lead.phone})...`);
          const waResult = await sendWhatsAppMessage(lead.phone, copy.whatsappMessage);
          if (waResult === true) {
            await updateLeadOutreachStatus(lead.businessName, "whatsapp", "SENT", lead.mapsUrl);
            campaignProgress.whatsappSent++;
            campaignLogger.success(`WhatsApp sent to ${lead.businessName} (${lead.phone})`);
          } else if (waResult === "not_registered") {
            campaignLogger.warn(`Campaign WhatsApp SKIPPED → ${lead.businessName} (${lead.phone}) — not on WhatsApp.`);
            campaignProgress.skipped++;
          } else {
            await updateLeadOutreachStatus(lead.businessName, "whatsapp", "FAILED", lead.mapsUrl);
            campaignProgress.whatsappFailed++;
            campaignLogger.error(`WhatsApp dispatch failed to ${lead.businessName} (${lead.phone})`);
          }
        } else {
          campaignLogger.warn(`Skipping WhatsApp for '${lead.businessName}': WhatsApp Web client is not connected.`);
          await updateLeadOutreachStatus(lead.businessName, "whatsapp", "FAILED", lead.mapsUrl);
          campaignProgress.whatsappFailed++;
        }
      }
    }

    
    if (skippedLead) {
      campaignProgress.skipped++;
    }

    // Inter-record delay
    if (i < targetLeads.length - 1 && !campaignCancelRequested) {
      campaignLogger.info(`Time gap: Waiting ${delaySeconds} seconds before dispatching next lead...`);
      for (let sec = delaySeconds; sec > 0; sec--) {
        while (isCampaignPaused && !campaignCancelRequested) {
          campaignProgress.status = "Campaign Paused (Waiting delay)";
          if (activeCampaignMetadata) activeCampaignMetadata.status = "PAUSED";
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        if (campaignCancelRequested) break;
        campaignProgress.secondsRemaining = sec;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      campaignProgress.secondsRemaining = 0;
    }
  }

  const finalStatus = campaignCancelRequested ? "Cancelled" : "Completed";
  if (!campaignCancelRequested) {
    campaignProgress.status = "Completed";
    campaignLogger.success(`Automated outreach campaign successfully completed! (${dryRun ? "Simulation" : "Live"})`);
  }

  recordCampaignCompleted({
    ...activeCampaignMetadata,
    endTime: new Date().toISOString(),
    status: finalStatus,
    stats: {
      emailsSent: campaignProgress.emailsSent,
      emailsFailed: campaignProgress.emailsFailed,
      whatsappSent: campaignProgress.whatsappSent,
      whatsappFailed: campaignProgress.whatsappFailed,
      skipped: campaignProgress.skipped,
      total: campaignProgress.total
    }
  });

  activeCampaignMetadata = null;
  isCampaignRunning = false;
  isCampaignPaused = false;
  campaignCancelRequested = false;
}

app.get("/api/campaign/status", (req, res) => {
  res.json({
    isRunning: isCampaignRunning,
    isPaused: isCampaignPaused,
    activeCampaign: activeCampaignMetadata,
    progress: campaignProgress
  });
});

app.get("/api/campaign/sheets", async (req, res) => {
  try {
    const sheets = await fetchSheetNamesFromGoogleSheet();
    res.json(sheets);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Google Sheet tabs list." });
  }
});

app.post("/api/campaign/start", (req, res) => {
  if (isCampaignRunning) {
    return res.status(400).json({ error: "Campaign is already running." });
  }

  const { delaySeconds, enableEmail, enableWhatsapp, dryRun, sheetName, attachmentFilename, emailAttachmentFilename } = req.body;
  const delaySec = parseInt(delaySeconds, 10) || 30;
  const mailActive = enableEmail !== undefined ? Boolean(enableEmail) : true;
  const waActive = enableWhatsapp !== undefined ? Boolean(enableWhatsapp) : true;
  const simulated = Boolean(dryRun);

  // Resolve email attachment path safely (clean original name without timestamps)
  let resolvedAttachment: string | undefined;
  const attachCandidate = attachmentFilename || emailAttachmentFilename;
  if (attachCandidate) {
    const candidate = path.join(ATTACHMENTS_DIR, path.basename(attachCandidate));
    if (fs.existsSync(candidate)) resolvedAttachment = candidate;
  }

  isCampaignRunning = true;
  isCampaignPaused = false;
  campaignCancelRequested = false;
  campaignProgress = {
    current: 0,
    total: 0,
    status: "Initializing",
    secondsRemaining: 0,
    emailsSent: 0,
    emailsFailed: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    skipped: 0
  };

  runCampaignLoop(delaySec, mailActive, waActive, simulated, sheetName, resolvedAttachment).catch(err => {
    campaignLogger.error(`Campaign crashed: ${err}`);
    isCampaignRunning = false;
    isCampaignPaused = false;
    campaignProgress.status = `Error: ${err.message || err}`;
  });

  res.json({ success: true, message: "Outreach campaign started in the background." });
});

app.post("/api/campaign/pause", (req, res) => {
  if (!isCampaignRunning) {
    return res.status(400).json({ error: "No campaign is currently running." });
  }
  isCampaignPaused = true;
  campaignProgress.status = "Campaign Paused";
  campaignLogger.info("Outreach campaign paused by user.");
  res.json({ success: true, message: "Campaign paused." });
});

app.post("/api/campaign/resume", (req, res) => {
  if (!isCampaignRunning) {
    return res.status(400).json({ error: "No campaign is currently running." });
  }
  isCampaignPaused = false;
  campaignProgress.status = "Resuming campaign...";
  campaignLogger.info("Outreach campaign resumed by user.");
  res.json({ success: true, message: "Campaign resumed." });
});

app.post("/api/campaign/stop", (req, res) => {
  if (!isCampaignRunning) {
    return res.status(400).json({ error: "No campaign currently active." });
  }
  campaignCancelRequested = true;
  isCampaignPaused = false;
  campaignProgress.status = "Cancelling...";
  res.json({ success: true, message: "Campaign cancellation requested." });
});

// ─── Local Data Campaign Execution Helper ────────────────────────────────────
interface LocalCampaignOptions {
  rows: Record<string, string>[];
  mapping?: Record<string, string>;
  headers?: string[];
  fileName?: string;
  emailSubject?: string;
  emailBody?: string;
  whatsappMessage?: string;
  delaySeconds?: number;
  enableEmail?: boolean;
  enableWhatsapp?: boolean;
  dryRun?: boolean;
  senderName?: string;
  senderCompany?: string;
  roleTitle?: string;
  skills?: string;
  portfolioUrl?: string;
  skipAlreadySent?: boolean;
  attachmentFilename?: string;
  emailAttachmentFilename?: string;
  campaignId?: string;
  campaignName?: string;
}

async function executeLocalDataCampaign(options: LocalCampaignOptions) {
  const {
    rows,
    mapping,
    headers: incomingHeaders,
    fileName,
    emailSubject,
    emailBody,
    whatsappMessage,
    delaySeconds,
    enableEmail,
    enableWhatsapp,
    dryRun,
    senderName,
    senderCompany,
    roleTitle,
    skills,
    portfolioUrl,
    skipAlreadySent = true,
    attachmentFilename,
    emailAttachmentFilename,
    campaignId,
    campaignName
  } = options;

  // Resolve email attachment path safely (clean original name, no timestamp prefixes)
  const attachedFile = attachmentFilename || emailAttachmentFilename;
  let localAttachmentPath: string | undefined;
  if (attachedFile) {
    const candidate = path.join(ATTACHMENTS_DIR, path.basename(attachedFile));
    if (fs.existsSync(candidate)) localAttachmentPath = candidate;
  }

  const delay = Math.max(5, Math.min(300, Number(delaySeconds) || 30));

  const csvHeaders: string[] = Array.isArray(incomingHeaders) && incomingHeaders.length > 0
    ? [...incomingHeaders]
    : Object.keys(rows[0] || {});

  const statusCols = ["Status", "Status Sent Date", "Email Status", "Email Sent Date", "WhatsApp Status", "WhatsApp Sent Date"];
  for (const col of statusCols) {
    if (!csvHeaders.includes(col)) {
      csvHeaders.push(col);
    }
  }

  const isValueSent = (val: any): boolean => {
    if (!val) return false;
    const s = String(val).trim().toUpperCase();
    return (
      s === "SENT" ||
      s === "MAIL SENT" ||
      s === "EMAIL SENT" ||
      s === "MESSAGE SENT" ||
      s === "SEND MESSAGE" ||
      s === "SENT MESSAGE" ||
      s === "ALREADY SENT" ||
      s === "DELIVERED" ||
      s === "COMPLETED" ||
      s === "TRUE" ||
      s === "YES"
    );
  };

  const isEmailSent = (row: Record<string, any>): boolean => {
    for (const [k, v] of Object.entries(row)) {
      const key = k.trim().toLowerCase();
      if ((key === "email status" || key === "email_status" || key === "mail status" || key === "email send status") && isValueSent(v)) return true;
    }
    const general = String(row["Status"] || row["status"] || "").trim().toUpperCase();
    if (general === "SENT" || general === "EMAIL SENT" || general === "MAIL SENT") return true;
    return false;
  };

  const isWhatsAppSent = (row: Record<string, any>): boolean => {
    for (const [k, v] of Object.entries(row)) {
      const key = k.trim().toLowerCase();
      if ((key === "whatsapp status" || key === "wa status" || key === "whatsapp_status") && isValueSent(v)) return true;
    }
    const general = String(row["Status"] || row["status"] || "").trim().toUpperCase();
    if (general === "WHATSAPP SENT" || general === "WA SENT") return true;
    return false;
  };

  const isOverallStatusSent = (row: Record<string, any>): boolean => {
    for (const [k, v] of Object.entries(row)) {
      if (/^(status|message\s*status|outreach\s*status|send\s*status)$/i.test(k.trim()) && isValueSent(v)) return true;
    }
    return false;
  };

  const setRowStatus = (row: Record<string, any>, statusValue: string) => {
    row["Status"] = statusValue;
    for (const col of Object.keys(row)) {
      if (/^(status|message\s*status|outreach\s*status|send\s*status)$/i.test(col.trim())) {
        row[col] = statusValue;
      }
    }
  };

  const setRowEmailStatus = (row: Record<string, any>, statusValue: string) => {
    row["Email Status"] = statusValue;
    for (const col of Object.keys(row)) {
      if (/^email\s*status$/i.test(col.trim())) {
        row[col] = statusValue;
      }
    }
  };

  const setRowWhatsAppStatus = (row: Record<string, any>, statusValue: string) => {
    row["WhatsApp Status"] = statusValue;
    for (const col of Object.keys(row)) {
      if (/^(whatsapp|wa)\s*status$/i.test(col.trim())) {
        row[col] = statusValue;
      }
    }
  };

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const findMatchingFiles = (dir: string, targetName: string): string[] => {
    const list: string[] = [];
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
          list.push(...findMatchingFiles(full, targetName));
        } else if (item.name.toLowerCase() === targetName.toLowerCase()) {
          list.push(full);
        }
      }
    } catch (e) {}
    return list;
  };

  const persistCampaignCsv = () => {
    try {
      const csvContent = serializeCSV(csvHeaders, rows);
      const latestPath = path.join(dataDir, "local-campaign-latest.csv");
      fs.writeFileSync(latestPath, csvContent, "utf8");

      if (fileName && typeof fileName === "string") {
        const base = path.basename(fileName);
        const writtenPaths = new Set<string>();

        const directPath = path.join(dataDir, base);
        fs.writeFileSync(directPath, csvContent, "utf8");
        writtenPaths.add(directPath);

        // Also update any matching file across data/ subdirectories (e.g. data/mumbai/email/...)
        const matchingFiles = findMatchingFiles(dataDir, base);
        for (const f of matchingFiles) {
          if (!writtenPaths.has(f)) {
            try {
              fs.writeFileSync(f, csvContent, "utf8");
              writtenPaths.add(f);
            } catch (err) {}
          }
        }
      }
    } catch (e: any) {
      campaignLogger.warn(`Could not persist campaign CSV to disk: ${e?.message || e}`);
    }
  };

  persistCampaignCsv();

  const reverseMap: Record<string, string> = {};
  if (mapping && typeof mapping === "object") {
    for (const [header, varKey] of Object.entries(mapping as Record<string, string>)) {
      if (varKey && varKey !== "(ignore)") {
        reverseMap[varKey] = header;
      }
    }
  }

  const resolveVar = (varKey: string, row: Record<string, any>): string => {
    if (!row || typeof row !== "object") return "";
    
    // 1. Check via reverseMap (e.g. reverseMap['{email}'] = 'emails' or 'Email')
    const header = reverseMap[varKey];
    if (header && row[header] !== undefined && row[header] !== null) {
      const val = row[header];
      if (Array.isArray(val)) return val.filter(Boolean).join(", ");
      return String(val);
    }

    // 2. Direct property lookup without braces (e.g. varKey '{businessName}' -> 'businessName' or 'email' -> 'emails')
    const rawKey = varKey.replace(/[{}]/g, "").trim();
    if (row[rawKey] !== undefined && row[rawKey] !== null) {
      const val = row[rawKey];
      if (Array.isArray(val)) return val.filter(Boolean).join(", ");
      return String(val);
    }

    // 3. Common alternative naming fallbacks in parsed Lead objects or CSV columns
    const aliases: Record<string, string[]> = {
      "{email}": ["emails", "email", "Email", "Emails", "E-mail"],
      "{phone}": ["phone", "Phone", "Phone Number", "Mobile", "Contact"],
      "{businessName}": ["businessName", "Business Name", "name", "Name", "company", "Company"],
      "{website}": ["website", "Website", "Website URL", "url", "URL"],
      "{address}": ["address", "Address", "Full Address", "Location"],
      "{category}": ["category", "Category", "Industry", "Niche"],
      "{rating}": ["rating", "Rating"],
      "{reviews}": ["reviews", "Reviews"],
      "{mapsUrl}": ["mapsUrl", "Google Maps URL", "Maps URL", "url"]
    };

    if (aliases[varKey]) {
      for (const alias of aliases[varKey]) {
        if (row[alias] !== undefined && row[alias] !== null) {
          const val = row[alias];
          if (Array.isArray(val)) return val.filter(Boolean).join(", ");
          return String(val);
        }
      }
    }

    // 4. Sender profile fallbacks
    const profileFallbacks: Record<string, string> = {
      "{senderName}":   senderName   || "",
      "{senderCompany}":senderCompany|| "",
      "{roleTitle}":    roleTitle    || "",
      "{skills}":       skills       || "",
      "{portfolioUrl}": portfolioUrl || "",
    };
    return profileFallbacks[varKey] ? String(profileFallbacks[varKey]) : "";
  };

  const interpolate = (template: string, row: Record<string, any>): string => {
    if (!template) return "";
    return template.replace(/\{(\w+)\}/g, (_, name) => resolveVar(`{${name}}`, row) || "");
  };

  const campId = campaignId || ("camp_" + Date.now());
  const campName = formatCampaignDisplayName(campaignName, fileName, rows.length);
  const campSource = fileName ? path.basename(fileName) : "CSV Import";
  activeCampaignMetadata = {
    id: campId,
    name: campName,
    type: "Local CSV",
    source: campSource,
    startTime: new Date().toISOString(),
    delaySeconds: delay,
    channels: { email: Boolean(enableEmail), whatsapp: Boolean(enableWhatsapp) },
    dryRun: Boolean(dryRun),
    status: "RUNNING"
  };

  isCampaignRunning = true;
  isCampaignPaused = false;
  campaignCancelRequested = false;
  campaignProgress = {
    current: 0,
    total: rows.length,
    status: "Starting Local Data Campaign...",
    secondsRemaining: 0,
    emailsSent: 0,
    emailsFailed: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    skipped: 0,
    updatedRows: rows,
    updatedHeaders: csvHeaders,
  } as any;

  try {
    campaignLogger.clear();
    campaignLogger.info(`Local Outreach Campaign started: "${campName}" (${rows.length} total records).`);
    campaignLogger.info(`Config: Delay=${delay}s, Email=${enableEmail}, WhatsApp=${enableWhatsapp}, DryRun=${dryRun}, SkipAlreadySent=${skipAlreadySent}`);

    for (let i = 0; i < rows.length; i++) {
      while (isCampaignPaused && !campaignCancelRequested) {
        campaignProgress.status = "Campaign Paused";
        if (activeCampaignMetadata) activeCampaignMetadata.status = "PAUSED";
        await new Promise(r => setTimeout(r, 800));
      }

      if (campaignCancelRequested) {
        campaignProgress.status = "Cancelled by user.";
        campaignLogger.warn("Local Data Campaign cancelled by user.");
        break;
      }

      const row = rows[i];
      campaignProgress.current = i + 1;
      const nameForLog = resolveVar("{businessName}", row) || `Record #${i + 1}`;
      const mapsUrl = resolveVar("{mapsUrl}", row);
      campaignProgress.status = `Processing: ${nameForLog} (${i + 1}/${rows.length})`;

      const rawEmail = resolveVar("{email}", row);
      const emailAddr = (rawEmail ? String(rawEmail).split(/[;,]/)[0].trim() : "");
      const rawPhone = resolveVar("{phone}", row);
      const phone = (rawPhone ? String(rawPhone).replace(/\D/g, "").replace(/^0+/, "") : "");
      const todayDate = new Date().toISOString().split("T")[0];

      const emailAlreadySent = isEmailSent(row);
      const waAlreadySent    = isWhatsAppSent(row);

      const wantEmail    = Boolean(enableEmail && emailAddr);
      const wantWhatsapp = Boolean(enableWhatsapp && phone);

      if (!wantEmail && !wantWhatsapp) {
        campaignLogger.warn(`Skipping lead: ${nameForLog} — no valid email or phone found.`);
        (campaignProgress as any).skipped = ((campaignProgress as any).skipped || 0) + 1;
        persistCampaignCsv();
        continue;
      }

      const shouldSendEmail    = wantEmail && (!skipAlreadySent || !emailAlreadySent);
      const shouldSendWhatsapp = wantWhatsapp && (!skipAlreadySent || !waAlreadySent);

      if (skipAlreadySent && !shouldSendEmail && !shouldSendWhatsapp) {
        campaignLogger.info(`Skipping lead: ${nameForLog} (${emailAddr || phone}) — message already sent previously (Status: SENT).`);
        (campaignProgress as any).skipped = ((campaignProgress as any).skipped || 0) + 1;
        campaignProgress.status = `Skipped (Already Sent): ${nameForLog} (${i + 1}/${rows.length})`;
        persistCampaignCsv();
        continue;
      }

      const interpolatedSubject = interpolate(emailSubject || "", row);
      const interpolatedBody    = interpolate(emailBody    || "", row);
      const interpolatedWa      = interpolate(whatsappMessage || "", row);

      let didDispatch = false;
      let anySuccess = false;

      // Email dispatch
      if (shouldSendEmail) {
        didDispatch = true;
        if (dryRun) {
          campaignLogger.info(`[SIMULATION] Email → ${emailAddr} | Subject: ${interpolatedSubject} ${localAttachmentPath ? `| Attachment: ${path.basename(localAttachmentPath)}` : ""}`);
          (campaignProgress as any).emailsSent = ((campaignProgress as any).emailsSent || 0) + 1;
          setRowEmailStatus(row, "SIMULATED");
          row["Email Sent Date"] = todayDate;
          anySuccess = true;
        } else {
          const ok = await sendEmailOutreach(emailAddr, interpolatedSubject, interpolatedBody, localAttachmentPath);
          if (ok) {
            (campaignProgress as any).emailsSent = ((campaignProgress as any).emailsSent || 0) + 1;
            campaignLogger.success(`Email sent successfully → ${emailAddr} (${nameForLog})`);
            setRowEmailStatus(row, "SENT");
            row["Email Sent Date"] = todayDate;
            setRowStatus(row, "SENT");
            row["Status Sent Date"] = todayDate;
            anySuccess = true;
            await updateLeadOutreachStatus(nameForLog, "email", "SENT", mapsUrl);
          } else {
            (campaignProgress as any).emailsFailed = ((campaignProgress as any).emailsFailed || 0) + 1;
            campaignLogger.error(`Email dispatch FAILED → ${emailAddr} (${nameForLog})`);
            setRowEmailStatus(row, "FAILED");
            row["Email Sent Date"] = todayDate;
            await updateLeadOutreachStatus(nameForLog, "email", "FAILED", mapsUrl);
          }
        }
      }

      // WhatsApp dispatch (Text-only, no attachments)
      if (shouldSendWhatsapp) {
        didDispatch = true;
        if (dryRun) {
          campaignLogger.info(`[SIMULATION] WhatsApp → ${phone} | Msg: ${interpolatedWa.slice(0, 60)}...`);
          (campaignProgress as any).whatsappSent = ((campaignProgress as any).whatsappSent || 0) + 1;
          setRowWhatsAppStatus(row, "SIMULATED");
          row["WhatsApp Sent Date"] = todayDate;
          anySuccess = true;
        } else {
          const ok = await sendWhatsAppMessage(phone, interpolatedWa);
          if (ok === true) {
            (campaignProgress as any).whatsappSent = ((campaignProgress as any).whatsappSent || 0) + 1;
            campaignLogger.success(`WhatsApp sent successfully → ${phone} (${nameForLog})`);
            setRowWhatsAppStatus(row, "SENT");
            row["WhatsApp Sent Date"] = todayDate;
            setRowStatus(row, "SENT");
            row["Status Sent Date"] = todayDate;
            anySuccess = true;
            await updateLeadOutreachStatus(nameForLog, "whatsapp", "SENT", mapsUrl);
          } else if (ok === "not_registered") {
            campaignLogger.warn(`WhatsApp SKIP → ${phone} (${nameForLog}) — not registered on WhatsApp.`);
            (campaignProgress as any).skipped = ((campaignProgress as any).skipped || 0) + 1;
            setRowWhatsAppStatus(row, "NOT_REGISTERED");
            row["WhatsApp Sent Date"] = todayDate;
          } else {
            (campaignProgress as any).whatsappFailed = ((campaignProgress as any).whatsappFailed || 0) + 1;
            campaignLogger.error(`WhatsApp dispatch FAILED → ${phone} (${nameForLog})`);
            setRowWhatsAppStatus(row, "FAILED");
            row["WhatsApp Sent Date"] = todayDate;
            await updateLeadOutreachStatus(nameForLog, "whatsapp", "FAILED", mapsUrl);
          }
        }
      }

      if (anySuccess) {
        setRowStatus(row, dryRun ? "SIMULATED" : "SENT");
        row["Status Sent Date"] = todayDate;
      } else if (didDispatch && !isEmailSent(row) && !isWhatsAppSent(row)) {
        setRowStatus(row, "FAILED");
        row["Status Sent Date"] = todayDate;
      }

      persistCampaignCsv();
      (campaignProgress as any).updatedRows = [...rows];
      (campaignProgress as any).updatedHeaders = csvHeaders;

      if (didDispatch && i < rows.length - 1 && !campaignCancelRequested) {
        for (let s = delay; s > 0; s--) {
          while (isCampaignPaused && !campaignCancelRequested) {
            campaignProgress.status = "Campaign Paused (Waiting delay)";
            if (activeCampaignMetadata) activeCampaignMetadata.status = "PAUSED";
            await new Promise(r => setTimeout(r, 800));
          }
          if (campaignCancelRequested) break;
          campaignProgress.secondsRemaining = s;
          await new Promise(r => setTimeout(r, 1000));
        }
        campaignProgress.secondsRemaining = 0;
      }
    }

    const sent   = ((campaignProgress as any).emailsSent  || 0) + ((campaignProgress as any).whatsappSent  || 0);
    const failed = ((campaignProgress as any).emailsFailed|| 0) + ((campaignProgress as any).whatsappFailed|| 0);
    const finalStatus = campaignCancelRequested ? "Cancelled" : "Completed";
    campaignProgress.status = `${finalStatus}${dryRun ? " (Simulation)" : ""}. Sent: ${sent}, Failed: ${failed}, Skipped: ${(campaignProgress as any).skipped || 0}`;
    campaignLogger.success(`Local Data Campaign finished. Sent: ${sent}, Failed: ${failed}, Skipped: ${(campaignProgress as any).skipped || 0}`);
    persistCampaignCsv();
    (campaignProgress as any).updatedRows = [...rows];
    (campaignProgress as any).updatedHeaders = csvHeaders;

    recordCampaignCompleted({
      ...activeCampaignMetadata,
      endTime: new Date().toISOString(),
      status: finalStatus,
      stats: {
        emailsSent: campaignProgress.emailsSent,
        emailsFailed: campaignProgress.emailsFailed,
        whatsappSent: campaignProgress.whatsappSent,
        whatsappFailed: campaignProgress.whatsappFailed,
        skipped: campaignProgress.skipped,
        total: campaignProgress.total
      }
    });
  } catch (err: any) {
    campaignLogger.error(`Local Data Campaign crashed: ${err?.message || err}`);
    campaignProgress.status = `Error: ${err?.message || err}`;
    recordCampaignCompleted({
      ...activeCampaignMetadata,
      endTime: new Date().toISOString(),
      status: "Error",
      error: err?.message || String(err),
      stats: {
        emailsSent: campaignProgress.emailsSent,
        emailsFailed: campaignProgress.emailsFailed,
        whatsappSent: campaignProgress.whatsappSent,
        whatsappFailed: campaignProgress.whatsappFailed,
        skipped: campaignProgress.skipped,
        total: campaignProgress.total
      }
    });
  } finally {
    activeCampaignMetadata = null;
    isCampaignRunning = false;
    isCampaignPaused = false;
    campaignCancelRequested = false;
  }
}

// ─── Local Data Campaign Endpoint ─────────────────────────────────────────────
app.post("/api/campaign/local-data", async (req, res) => {
  if (isCampaignRunning) {
    return res.status(400).json({ error: "Another campaign is already running. Pause or stop it first." });
  }

  const {
    rows,
    mapping,
    headers: incomingHeaders,
    fileName,
    campaignName,
    emailSubject,
    emailBody,
    whatsappMessage,
    delaySeconds,
    enableEmail,
    enableWhatsapp,
    dryRun,
    senderName,
    senderCompany,
    roleTitle,
    skills,
    portfolioUrl,
    skipAlreadySent = true,
    attachmentFilename,
    emailAttachmentFilename,
  } = req.body;

  // Persist local campaign templates to templates.json
  try {
    const currentTemplates = loadPitchTemplates();
    currentTemplates.localCampaign = {
      emailSubject: emailSubject || currentTemplates.localCampaign?.emailSubject || "",
      emailBody: emailBody || currentTemplates.localCampaign?.emailBody || "",
      whatsappMessage: whatsappMessage || currentTemplates.localCampaign?.whatsappMessage || "",
    };
    savePitchTemplates(currentTemplates);
    campaignLogger.info("Local campaign message templates saved to templates.json");
  } catch (err: any) {
    campaignLogger.warn(`Could not save local templates to templates.json: ${err?.message || err}`);
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No data rows provided." });
  }
  if (!emailSubject && !emailBody && !whatsappMessage) {
    return res.status(400).json({ error: "No message templates provided." });
  }
  if (!enableEmail && !enableWhatsapp) {
    return res.status(400).json({ error: "At least one dispatch channel (Email or WhatsApp) must be enabled." });
  }

  if (enableWhatsapp && !dryRun && getWhatsAppStatus().status !== "CONNECTED") {
    return res.status(400).json({
      error: "WhatsApp client is not connected. Please scan the QR code in the launch panel or Settings first to link your WhatsApp account."
    });
  }

  // Respond immediately — campaign runs in background
  res.json({ success: true, message: `Local Data Campaign started for ${rows.length} records.` });

  executeLocalDataCampaign({
    rows,
    mapping,
    headers: incomingHeaders,
    fileName,
    campaignName,
    emailSubject,
    emailBody,
    whatsappMessage,
    delaySeconds,
    enableEmail,
    enableWhatsapp,
    dryRun,
    senderName,
    senderCompany,
    roleTitle,
    skills,
    portfolioUrl,
    skipAlreadySent,
    attachmentFilename,
    emailAttachmentFilename,
  }).catch(err => {
    campaignLogger.error(`executeLocalDataCampaign background error: ${err}`);
  });
});

// ─── Trigger Scheduled Campaign Helper ───────────────────────────────────────
async function triggerScheduledCampaign(schedule: any) {
  if (isCampaignRunning) {
    campaignLogger.warn(`Skipping scheduled campaign '${schedule.name}' because another campaign is currently running.`);
    return;
  }

  const schedules = loadCampaignSchedules();
  const idx = schedules.findIndex(s => s.id === schedule.id);
  if (idx >= 0) {
    schedules[idx].status = "RUNNING";
    saveCampaignSchedules(schedules);
  }

  campaignLogger.info(`Starting scheduled campaign: ${schedule.name} (${schedule.type})`);

  try {
    if (schedule.type === "sheet") {
      const p = schedule.payload || {};
      const delaySec = parseInt(p.delaySeconds, 10) || 30;
      const mailActive = p.enableEmail !== undefined ? Boolean(p.enableEmail) : true;
      const waActive = p.enableWhatsapp !== undefined ? Boolean(p.enableWhatsapp) : true;
      const simulated = Boolean(p.dryRun);

      let resolvedAttachment: string | undefined;
      const attachCandidate = p.attachmentFilename || p.emailAttachmentFilename;
      if (attachCandidate) {
        const candidate = path.join(ATTACHMENTS_DIR, path.basename(attachCandidate));
        if (fs.existsSync(candidate)) resolvedAttachment = candidate;
      }

      isCampaignRunning = true;
      isCampaignPaused = false;
      campaignCancelRequested = false;
      campaignProgress = {
        current: 0,
        total: 0,
        status: "Starting scheduled Google Sheet campaign...",
        secondsRemaining: 0,
        emailsSent: 0,
        emailsFailed: 0,
        whatsappSent: 0,
        whatsappFailed: 0,
        skipped: 0
      };

      await runCampaignLoop(delaySec, mailActive, waActive, simulated, p.sheetName, resolvedAttachment, schedule.id, schedule.name);
    } else {
      await executeLocalDataCampaign({
        ...schedule.payload,
        campaignId: schedule.id,
        campaignName: schedule.name
      });
    }

    const curSchedules = loadCampaignSchedules();
    const curIdx = curSchedules.findIndex(s => s.id === schedule.id);
    if (curIdx >= 0) {
      curSchedules[curIdx].status = "COMPLETED";
      saveCampaignSchedules(curSchedules);
    }
  } catch (err: any) {
    campaignLogger.error(`Scheduled campaign execution failed: ${err?.message || err}`);
    const curSchedules = loadCampaignSchedules();
    const curIdx = curSchedules.findIndex(s => s.id === schedule.id);
    if (curIdx >= 0) {
      curSchedules[curIdx].status = "FAILED";
      curSchedules[curIdx].error = err?.message || String(err);
      saveCampaignSchedules(curSchedules);
    }
  }
}

// Check every 10 seconds for any due scheduled campaigns
setInterval(() => {
  if (isCampaignRunning) return;
  const schedules = loadCampaignSchedules();
  const now = Date.now();
  const due = schedules.find(s => s.status === "UPCOMING" && new Date(s.scheduledAt).getTime() <= now);
  if (due) {
    triggerScheduledCampaign(due);
  }
}, 10000);

// ─── Campaign History Endpoints ───────────────────────────────────────────────
app.get("/api/campaign/history", (req, res) => {
  res.json(loadCampaignHistory());
});

app.delete("/api/campaign/history/:id", (req, res) => {
  const history = loadCampaignHistory().filter(h => h.id !== req.params.id);
  saveCampaignHistory(history);
  res.json({ success: true, message: "Campaign history record deleted." });
});

app.post("/api/campaign/history/clear", (req, res) => {
  saveCampaignHistory([]);
  res.json({ success: true, message: "Campaign history cleared." });
});

// ─── Campaign Schedules Endpoints ─────────────────────────────────────────────
app.get("/api/campaign/schedules", (req, res) => {
  res.json(loadCampaignSchedules());
});

app.post("/api/campaign/schedule", (req, res) => {
  const { name, scheduledAt, type, payload } = req.body;
  if (!scheduledAt) {
    return res.status(400).json({ error: "Missing required parameter 'scheduledAt'." });
  }
  const schedules = loadCampaignSchedules();
  const newSchedule = {
    id: "sched_" + Date.now(),
    name: name || `Scheduled Campaign ${new Date(scheduledAt).toLocaleString()}`,
    scheduledAt,
    type: type || "sheet",
    payload: payload || {},
    status: "UPCOMING",
    createdAt: new Date().toISOString()
  };
  schedules.push(newSchedule);
  saveCampaignSchedules(schedules);
  campaignLogger.info(`Scheduled new campaign '${newSchedule.name}' for ${newSchedule.scheduledAt}`);
  res.json({ success: true, schedule: newSchedule });
});

app.delete("/api/campaign/schedule/:id", (req, res) => {
  const schedules = loadCampaignSchedules().filter(s => s.id !== req.params.id);
  saveCampaignSchedules(schedules);
  res.json({ success: true, message: "Scheduled campaign removed." });
});

// Update or Reschedule a scheduled campaign
app.put("/api/campaign/schedule/:id", (req, res) => {
  const schedules = loadCampaignSchedules();
  const idx = schedules.findIndex(s => s.id === req.params.id);
  if (idx < 0) {
    return res.status(404).json({ error: "Scheduled campaign not found." });
  }

  const { name, scheduledAt, delaySeconds, enableEmail, enableWhatsapp } = req.body;
  if (name) schedules[idx].name = name;
  if (scheduledAt) schedules[idx].scheduledAt = scheduledAt;
  if (schedules[idx].payload) {
    if (delaySeconds !== undefined) schedules[idx].payload.delaySeconds = Number(delaySeconds);
    if (enableEmail !== undefined) schedules[idx].payload.enableEmail = Boolean(enableEmail);
    if (enableWhatsapp !== undefined) schedules[idx].payload.enableWhatsapp = Boolean(enableWhatsapp);
  }
  schedules[idx].updatedAt = new Date().toISOString();
  saveCampaignSchedules(schedules);
  campaignLogger.info(`Updated scheduled campaign '${schedules[idx].name}'`);
  res.json({ success: true, schedule: schedules[idx] });
});

// Re-run or Reschedule from history
app.post("/api/campaign/history/:id/reschedule", (req, res) => {
  const history = loadCampaignHistory();
  const item = history.find(h => h.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Campaign history record not found." });
  }

  const { scheduledAt, name } = req.body;
  const schedules = loadCampaignSchedules();
  const newSchedule = {
    id: "sched_" + Date.now(),
    name: name || `Rerun: ${item.name}`,
    scheduledAt: scheduledAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    type: item.type === "Local CSV" ? "local" : "sheet",
    payload: {
      fileName: item.source,
      sheetName: item.source,
      delaySeconds: item.delaySeconds || 30,
      enableEmail: item.channels?.email !== false,
      enableWhatsapp: item.channels?.whatsapp !== false,
      dryRun: Boolean(item.dryRun)
    },
    status: "UPCOMING",
    createdAt: new Date().toISOString()
  };

  schedules.push(newSchedule);
  saveCampaignSchedules(schedules);
  res.json({ success: true, schedule: newSchedule });
});

app.post("/api/campaign/schedule/:id/run", (req, res) => {
  if (isCampaignRunning) {
    return res.status(400).json({ error: "Another campaign is currently running." });
  }
  const schedules = loadCampaignSchedules();
  const target = schedules.find(s => s.id === req.params.id);
  if (!target) {
    return res.status(404).json({ error: "Scheduled campaign not found." });
  }
  res.json({ success: true, message: `Starting scheduled campaign '${target.name}' now.` });
  triggerScheduledCampaign(target);
});

app.get("/api/campaign/local-data/csv", (req, res) => {
  const latestPath = path.join(process.cwd(), "data", "local-campaign-latest.csv");
  if (!fs.existsSync(latestPath)) {
    return res.status(404).json({ error: "No local campaign CSV available yet." });
  }
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=\"local-campaign-updated.csv\"");
  res.sendFile(latestPath);
});

app.get("/api/status", (req, res) => {
  res.json({
    isRunning: isScrapingRunning || emailEnricherState.isRunning,
    phase: scraperPhase,
    outputFile: scraperOutputFile,
    lastResult: scraperResult,
    webhookUrlConfigured: !!process.env.GOOGLE_SHEET_WEBHOOK_URL && process.env.GOOGLE_SHEET_WEBHOOK_URL !== "YOUR_WEBHOOK_URL",
    whatsappConnected: getWhatsAppStatus().status === "CONNECTED",
    campaignRunning: isCampaignRunning
  });
});

async function startServer() {
  // Vite integration middleware in dev mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            "**/data/**",
            "data/**",
            "**/templates.json",
            "templates.json",
            "**/*.csv",
            "**/attachments/**",
            "attachments/**",
            "**/uploads/**",
            "uploads/**",
            "**/.wwebjs_auth/**",
            "**/.wwebjs_cache/**",
            "**/scraper-log.txt",
            "**/campaign-log.txt",
            "**/campaigns_history.json",
            "**/campaign_schedules.json",
            "**/processed-leads.json",
            "**/failed-leads.json"
          ]
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LeadFinder AI Server running on http://localhost:${PORT}`);
    // Auto-initialize WhatsApp on startup so existing session restores or QR is ready
    try {
      initializeWhatsApp();
    } catch (e: any) {
      console.warn("Failed to auto-initialize WhatsApp on startup:", e?.message || e);
    }
  });
}

startServer();
