/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { chromium, Browser, Page } from "playwright";
import { CONFIG } from "../../config";
import { Lead } from "../../types";
import { logger } from "../../utils/logger";
import { duplicateChecker } from "../integrations/duplicateChecker";
import { sendLeadToWebhook } from "../integrations/googleSheetsWebhook";
import fs from "fs";
import path from "path";

// ── Read filter flags from scraper-filters.json at runtime (no recompile needed) ──
const FILTERS_PATH = path.join(process.cwd(), "scraper-filters.json");

function readFilters(): { includeWithWebsite: boolean; includeWithoutWebsite: boolean; scrapeWebsite: boolean; scrapeSocialMedia: boolean; finderMode: "all" | "noWebsite" | "outdatedWebsite" } {
  try {
    if (fs.existsSync(FILTERS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(FILTERS_PATH, "utf8"));
      return {
        includeWithWebsite:    raw.includeWithWebsite    !== false,
        includeWithoutWebsite: raw.includeWithoutWebsite !== false,
        scrapeWebsite:         raw.scrapeWebsite         === true,
        scrapeSocialMedia:     raw.scrapeSocialMedia     !== false,
        finderMode:            raw.finderMode || (CONFIG as any).finderMode || "all",
      };
    }
  } catch (e) { /* fall through to defaults */ }
  return { includeWithWebsite: true, includeWithoutWebsite: true, scrapeWebsite: Boolean((CONFIG as any).scrapeWebsite), scrapeSocialMedia: true, finderMode: ((CONFIG as any).finderMode as any) || "all" };
}
import { analyzeWebsite, WebsiteAnalysis } from "./websiteAnalyzer";
import { analyzeInstagram } from "./instagramAnalyzer";
import { analyzeFacebook } from "./facebookAnalyzer";
import { analyzeLinkedIn } from "./linkedinAnalyzer";
import { calculateDigitalPresenceScore } from "./digitalPresenceScorer";
import { generateSalesInsight } from "../ai/aiInsights";
import { generateSearchQueriesWithAI } from "../ai/aiQueryGenerator";

let stopRequested = false;

export function requestStopScraping(): void {
  logger.warn("Cancellation requested: setting stopRequested flag.");
  stopRequested = true;
}

export function resetStopScraping(): void {
  stopRequested = false;
}

export function parseSearchQueries(businessType: string, location: string): string[] {
  const parts = businessType.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return [`${businessType} in ${location}`];
  }
  
  const queries: string[] = [];
  const lastPart = parts[parts.length - 1];
  const lastPartWords = lastPart.split(/\s+/);
  
  const suffixes = [
    "hospital", "clinic", "shop", "center", "centre", "restaurant", "hotel", "cafe", 
    "dentist", "dentistry", "surgeon", "store", "academy", "school", "office", 
    "parlour", "parlor", "spa", "salon", "studio", "gym", "club", "bar", "pub", 
    "care", "service", "services", "doctor", "dermatologist", "agency", "dealer"
  ];
  
  let suffixToAppend = "";
  const lastWord = lastPartWords[lastPartWords.length - 1]?.toLowerCase();
  if (lastWord && suffixes.includes(lastWord)) {
    suffixToAppend = lastPartWords[lastPartWords.length - 1];
  }
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const partWords = part.split(/\s+/);
    const partHasSuffix = partWords.some(w => suffixes.includes(w.toLowerCase()));
    
    if (!partHasSuffix && suffixToAppend && i < parts.length - 1) {
      queries.push(`${part} ${suffixToAppend} in ${location}`);
    } else {
      queries.push(`${part} in ${location}`);
    }
  }
  
  return Array.from(new Set(queries));
}

async function extractDetailsFromPage(page: Page) {
  return await page.evaluate(() => {
    // 1. Business Name
    let name = "";
    const nameSelectors = [
      'h1',
      'h1.DUwDvf',
      'div[role="main"] h1',
      'div.x3b7o h1',
      'div[jstcache] h1',
      'div.section-hero-header-title-title'
    ];
    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent?.trim()) {
        name = el.textContent.trim();
        break;
      }
    }

    // 2. Rating & Reviews
    let ratingNum = 0;
    let reviewsNum = 0;
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]') ||
                     document.querySelector('div.F7nice span span') ||
                     document.querySelector('span.ceNzKf');
    if (ratingEl) {
      const match = ratingEl.textContent?.match(/([0-9]\.[0-9])/);
      if (match) {
        ratingNum = parseFloat(match[1]);
      } else {
        const clean = ratingEl.textContent?.replace(/[^0-9.]/g, "");
        if (clean) {
          const num = parseFloat(clean);
          if (!isNaN(num)) ratingNum = num;
        }
      }
    }

    const reviewsEl = document.querySelector('div.F7nice span[aria-label*="reviews"]') ||
                      document.querySelector('div.F7nice [aria-label*="reviews"]') ||
                      document.querySelector('[aria-label*="reviews"]');
    if (reviewsEl) {
      const ariaLabel = reviewsEl.getAttribute('aria-label');
      const matchLabel = ariaLabel?.replace(/[^0-9]/g, "");
      if (matchLabel) {
        reviewsNum = parseInt(matchLabel, 10);
      } else {
        const matchText = reviewsEl.textContent?.replace(/[^0-9]/g, "");
        if (matchText) reviewsNum = parseInt(matchText, 10);
      }
    } else {
      const spans = document.querySelectorAll('div.F7nice > span');
      if (spans.length > 1) {
        const matchText = spans[1].textContent?.replace(/[^0-9]/g, "");
        if (matchText) reviewsNum = parseInt(matchText, 10);
      }
    }

    // 3. Website
    let webUrl = "";
    const webSelectors = [
      'a[data-tooltip="Open website"]',
      'a[data-tooltip="Open menu link"]',
      'a[aria-label*="website" i]',
      'a[data-item-id="authority"]',
      'div.section-info-line a[data-metrics-click*="website"]'
    ];
    for (const sel of webSelectors) {
      const el = document.querySelector(sel) as HTMLAnchorElement;
      if (el && el.href && el.href.startsWith("http")) {
        webUrl = el.href;
        break;
      }
    }
    if (!webUrl) {
      const webEl = Array.from(document.querySelectorAll('a[href]')).find(a => {
        const itemId = a.getAttribute('data-item-id') || '';
        const label = a.getAttribute('aria-label') || '';
        const tooltip = a.getAttribute('data-tooltip') || '';
        return itemId === 'authority' || 
               label.toLowerCase().includes('website') || 
               tooltip.toLowerCase().includes('website');
      });
      if (webEl) webUrl = (webEl as HTMLAnchorElement).href;
    }

    // 4. Phone
    let phoneVal = "";
    const phoneSelectors = [
      'button[data-tooltip="Copy phone number"]',
      'button[aria-label*="phone" i]',
      'button[data-item-id*="phone"]',
      'div.section-info-line[data-tooltip*="phone"]'
    ];
    for (const sel of phoneSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const attr = el.getAttribute('aria-label') || el.getAttribute('data-item-id') || el.textContent || "";
        phoneVal = attr.replace(/Phone:/i, "").replace(/phone:tel:/i, "").trim();
        if (phoneVal) break;
      }
    }
    if (!phoneVal) {
      const telLink = document.querySelector('a[href^="tel:"]');
      if (telLink) phoneVal = telLink.getAttribute('href')?.replace('tel:', '').trim() || "";
    }

    // 5. Address
    let addressVal = "";
    const addressSelectors = [
      'button[data-tooltip="Copy address"]',
      'button[aria-label*="address" i]',
      'button[data-item-id*="address"]',
      'div.section-info-line[data-tooltip*="address"]'
    ];
    for (const sel of addressSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const attr = el.getAttribute('aria-label') || el.getAttribute('data-item-id') || el.textContent || "";
        addressVal = attr.replace(/Address:/i, "").replace(/address/i, "").trim();
        if (addressVal) break;
      }
    }

    // 6. Category
    let catVal = "";
    const catSelectors = [
      'button[jsaction*="pane.rating.category"]',
      'button[jsaction*="category"]',
      'span[jsan*="category"]',
      'button[aria-label*="business" i]'
    ];
    for (const sel of catSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent?.trim()) {
        catVal = el.textContent.trim();
        break;
      }
    }

    return {
      businessName: name,
      rating: ratingNum,
      reviews: reviewsNum,
      website: webUrl,
      phone: phoneVal,
      address: addressVal,
      category: catVal
    };
  });
}

export interface ScrapingResult {
  scannedCount: number;
  withoutWebsiteCount: number;
  addedCount: number;
  failedCount: number;
  leads: Lead[];
  rawCsvPath?: string;
  enrichedCsvPath?: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function extractCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  const matchPlace = url.match(/!3d(-?[0-9.]+)!4d(-?[0-9.]+)/);
  if (matchPlace) {
    return {
      lat: parseFloat(matchPlace[1]),
      lng: parseFloat(matchPlace[2])
    };
  }
  const matchAt = url.match(/@(-?[0-9.]+),(-?[0-9.]+)/);
  if (matchAt) {
    return {
      lat: parseFloat(matchAt[1]),
      lng: parseFloat(matchAt[2])
    };
  }
  return null;
}

/**
 * Normalizes rating string to number
 */
function parseRating(text: string | null): number {
  if (!text) return 0;
  const match = text.match(/([0-9]\.[0-9])/);
  if (match) {
    return parseFloat(match[1]);
  }
  const clean = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Normalizes reviews count string to number
 */
function parseReviews(text: string | null): number {
  if (!text) return 0;
  // match digits optionally separated by commas or dots or 'K' helper
  const clean = text.replace(/[^0-9]/g, "");
  const num = parseInt(clean, 10);
  return isNaN(num) ? 0 : num;
}

function generateSheetName(): string {
  let type = CONFIG.businessType.trim();
  // Clean special characters invalid in sheet names
  type = type.replace(/[\\/\?\*:\[\]]/g, "");
  // Limit to 31 characters for Google Sheets tab compatibility
  return type.substring(0, 31).trim();
}

export async function runScraper(): Promise<ScrapingResult> {
  resetStopScraping();

  // ── Read filter flags fresh from disk — works without server restart ──────
  const filters = readFilters();
  logger.info(`Scraper filters: withWebsite=${filters.includeWithWebsite}, withoutWebsite=${filters.includeWithoutWebsite}, finderMode=${filters.finderMode}`);

  const startTime = Date.now();
  let browser: Browser | null = null;
  let leadsFound: Lead[] = [];
  let scannedCount = 0;
  let withoutWebsiteCount = 0;
  let addedCount = 0;
  let failedCount = 0;

  // Auto-geocode CONFIG.location to align search center coordinates
  try {
    logger.info(`Geocoding search location '${CONFIG.location}' to align search center coordinates...`);
    const axios = (await import("axios")).default;
    const geoResponse = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(CONFIG.location)}&format=json&limit=1`, {
      headers: { "User-Agent": "LeadFinder-AI-Agent/1.0" },
      timeout: 5000
    });
    if (geoResponse.data && geoResponse.data.length > 0) {
      CONFIG.lat = parseFloat(geoResponse.data[0].lat);
      CONFIG.lng = parseFloat(geoResponse.data[0].lon);
      logger.info(`Aligned search center coordinates to Lat: ${CONFIG.lat}, Lng: ${CONFIG.lng}`);
    }
  } catch (e: any) {
    logger.warn(`Could not geocode location '${CONFIG.location}'. Proceeding with default coordinates.`);
  }

  const sheetName = generateSheetName();
  const cleanCategory = CONFIG.businessType.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || "business";
  const cleanLocation = CONFIG.location.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || "general";

  // Prepare directories
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const locationDir = path.join(dataDir, cleanLocation);
  if (!fs.existsSync(locationDir)) fs.mkdirSync(locationDir, { recursive: true });

  const emailDir = path.join(locationDir, "email");
  if (!fs.existsSync(emailDir)) fs.mkdirSync(emailDir, { recursive: true });

  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const rawCsvFilename = `${cleanCategory}_${cleanLocation}_${timestamp}.csv`;
  const locationCsvPath = path.join(locationDir, rawCsvFilename);
  const rootCsvPath = path.join(dataDir, rawCsvFilename);

  try {
    const targetLinksGoal = filters.finderMode !== "all" ? Math.min(CONFIG.maxResults * 3, 3000) : CONFIG.maxResults;
    const placeLinks = new Set<string>();

    // Dynamic query generation based on requested limit
    const queryCount = targetLinksGoal >= 300 ? 20 : targetLinksGoal >= 100 ? 15 : 10;
    logger.info(`Generating ${queryCount} AI search queries for '${CONFIG.businessType}' in '${CONFIG.location}'...`);
    const queries = await generateSearchQueriesWithAI(CONFIG.businessType, CONFIG.location, queryCount);
    logger.info(`Generated ${queries.length} AI search queries to execute sequentially:`);
    queries.forEach((q, idx) => logger.info(`  ${idx + 1}. "${q}"`));

    const isHeadless = CONFIG.headless;
    logger.info(`Launching Chromium browser (headless: ${isHeadless}) with Playwright...`);
    browser = await chromium.launch({
      headless: isHeadless,
      args: [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-quic",
        "--disable-http2",
        "--window-size=1280,800",
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      locale: "en-US"
    });

    // Suppress benign Google Maps internal network abort errors
    context.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('net::ERR_CONNECTION_CLOSED') && !text.includes('net::ERR_ABORTED') && !text.includes('net::ERR_QUIC_PROTOCOL_ERROR')) {
          // keep console clean
        }
      }
    });

    // ── STEP 1: Search Queries & Discover Business Listings ────────────────────
    for (let qIdx = 0; qIdx < queries.length; qIdx++) {
      if (stopRequested) {
        logger.warn("Scraping cancelled by user during query sequence.");
        break;
      }
      if (placeLinks.size >= targetLinksGoal) {
        logger.info(`Target links goal (${targetLinksGoal}) reached across queries.`);
        break;
      }

      const queryToRun = queries[qIdx];
      logger.info(`\n[${qIdx + 1}/${queries.length}] Searching Google Maps for query: '${queryToRun}'`);
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(queryToRun)}`;

      const queryPage = await context.newPage();
      try {
        await queryPage.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

        // Handle Cookie Consent Modal if present
        try {
          const consentButtons = [
            "button[aria-label*='Accept all']",
            "button[aria-label*='Agree']",
            "button:has-text('Accept all')",
            "button:has-text('I agree')",
            "button[class*='VfP3Zd']",
          ];
          for (const selector of consentButtons) {
            const btn = queryPage.locator(selector).first();
            if (await btn.isVisible({ timeout: 1500 })) {
              logger.info(`Clicking cookie accept button matching: ${selector}`);
              await btn.click();
              await queryPage.waitForTimeout(1000);
              break;
            }
          }
        } catch (_) {}

        // Wait for results container or content with multiple selectors
        try {
          await Promise.race([
            queryPage.waitForSelector("a[href*='/maps/place/']", { timeout: 15000 }),
            queryPage.waitForSelector('div[role="feed"]', { timeout: 15000 }),
            queryPage.waitForSelector('div[role="main"]', { timeout: 15000 }),
            queryPage.waitForSelector('div[aria-label*="Results"]', { timeout: 15000 })
          ]);
        } catch (_) {
          logger.warn("Waiting for place listings timed out on this query. Checking available links...");
        }

        await queryPage.waitForTimeout(2000);

        // Find scrollable feed container
        const scrollSelectors = [
          'xpath=/html/body/div[2]/div[3]/div[8]/div[9]/div/div/div[1]/div[2]/div/div[1]/div/div/div[1]/div[1]',
          'div[role="feed"]',
          'div[aria-label*="Results"] > div',
          'div.section-scrollbox',
          'div[jsaction*="scrollable"]'
        ];

        let scrollable: any = null;
        for (const selector of scrollSelectors) {
          try {
            const element = await queryPage.$(selector);
            if (element) {
              scrollable = element;
              break;
            }
          } catch (_) {}
        }

        if (!scrollable) {
          try {
            const potentialScrollables = await queryPage.$$('div[style*="overflow"]');
            for (const el of potentialScrollables) {
              const isScroll = await el.evaluate(node => node.scrollHeight > node.clientHeight);
              if (isScroll) {
                scrollable = el;
                break;
              }
            }
          } catch (_) {}
        }

        logger.info(`Scanning and scrolling business results panel for '${queryToRun}'...`);
        let previousHeight = 0;
        let currentHeight = 0;
        let noChangeCount = 0;
        let scrollCount = 0;
        const maxScrolls = 200;

        while (placeLinks.size < targetLinksGoal && noChangeCount < 8 && scrollCount < maxScrolls) {
          if (stopRequested) break;

          // Extract place URLs on page at current scroll state
          try {
            const currentLinks = await queryPage.$$eval('a', links =>
              links
                .map(link => link.href)
                .filter(href => href && href.includes('/maps/place/'))
            );
            for (const l of currentLinks) {
              placeLinks.add(l);
            }
          } catch (_) {}

          if (placeLinks.size >= targetLinksGoal) {
            logger.info(`Reached goal: extracted ${placeLinks.size} links.`);
            break;
          }

          if (scrollable) {
            try {
              previousHeight = await scrollable.evaluate((node: any) => node.scrollHeight);
              await scrollable.evaluate((node: any) => {
                node.scrollTo(0, node.scrollHeight);
              });
            } catch (_) {
              await queryPage.evaluate(() => window.scrollBy(0, 1000));
            }
          } else {
            await queryPage.evaluate(() => window.scrollBy(0, 1000));
          }

          const delay = 1000 + Math.floor(Math.random() * 500);
          await queryPage.waitForTimeout(delay);

          // Every 6 scrolls, try clicking "Show more results" if present
          if (scrollCount % 6 === 0) {
            try {
              const showMoreButtons = await queryPage.$$('button:has-text("Show more results"), span:has-text("Show more"), button:has-text("Load more")');
              if (showMoreButtons.length > 0) {
                await showMoreButtons[0].click();
                await queryPage.waitForTimeout(1200);
              }
            } catch (_) {}
          }

          if (scrollable) {
            try {
              currentHeight = await scrollable.evaluate((node: any) => node.scrollHeight);
            } catch (_) {}
          }

          scrollCount++;
          if (scrollCount % 10 === 0) {
            logger.info(`Scrolled ${scrollCount} times... Extracted ${placeLinks.size} unique business URLs so far.`);
          }

          // Check for end of results
          const endOfResults = await queryPage.evaluate(() => {
            const endStrings = ["You've reached the end of the list", "No more results", "End of results", "End of list"];
            return endStrings.some(s => document.body.innerText.includes(s));
          });
          if (endOfResults) {
            logger.info("Reached end of Google Maps results for this query.");
            break;
          }

          if (scrollable && previousHeight === currentHeight) {
            noChangeCount++;
            // Nudge up and back down to trigger dynamic loading observer
            try {
              await scrollable.evaluate((node: any) => node.scrollBy(0, -300));
              await queryPage.waitForTimeout(400);
              await scrollable.evaluate((node: any) => node.scrollTo(0, node.scrollHeight));
            } catch (_) {}
          } else {
            noChangeCount = 0;
          }
        }

        // Final link extraction after scroll loop for this query
        try {
          const finalLinks = await queryPage.$$eval('a', links =>
            links
              .map(link => link.href)
              .filter(href => href && href.includes('/maps/place/'))
          );
          for (const l of finalLinks) {
            placeLinks.add(l);
          }
        } catch (_) {}

        logger.info(`Query '${queryToRun}' finished. Total unique places collected so far: ${placeLinks.size}`);

      } catch (err: any) {
        logger.error(`Error querying '${queryToRun}': ${err.message || err}`);
      } finally {
        await queryPage.close().catch(() => {});
      }
    }

    const targetUrls = Array.from(placeLinks).slice(0, targetLinksGoal);
    logger.success(`Discovery complete! Found ${targetUrls.length} total unique business URLs across all queries.`);

    if (targetUrls.length === 0) {
      logger.warn("No business listings extracted directly from Google Maps page.");
      throw new Error("No businesses extracted. Headless mode might be restricted or no results were found for the query.");
    }

    // ── STEP 2: Extract Google Business Details For Each Listing (Batch Concurrency) ──
    logger.info(`\nStarting Google Business Lead details extraction for ${targetUrls.length} listings in batches...`);

    // Prepare CSV files with headers for real-time appending
    const csvHeaders = ["Business Name","Category","Address","Website","Phone","Rating","Reviews","Google Maps URL","Latitude","Longitude","Lead Score","Lead Priority","Date Added"];
    const csvHeaderLine = csvHeaders.join(",") + "\n";
    fs.writeFileSync(locationCsvPath, csvHeaderLine, "utf8");
    fs.writeFileSync(rootCsvPath, csvHeaderLine, "utf8");

    const batchSize = 8; // Concurrency to balance speed and prevent rate limits
    const detailScrapeWorker = async (url: string, index: number, total: number): Promise<Lead | null> => {
      let details: any = null;
      let itemPage: Page | null = null;
      const maxRetries = 2;
      let attempt = 0;

      while (attempt <= maxRetries && !details) {
        try {
          itemPage = await context.newPage();
          try {
            await itemPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          } catch (gotoErr: any) {
            if (gotoErr.message?.includes("net::ERR_ABORTED")) {
              await itemPage.waitForTimeout(1500).catch(() => {});
            } else {
              throw gotoErr;
            }
          }

          try {
            await itemPage.waitForSelector("h1, div[role='main']", { timeout: 10000 });
          } catch (_) {}

          await itemPage.waitForTimeout(1200);
          details = await extractDetailsFromPage(itemPage);
          if (details && details.businessName) {
            break;
          }
        } catch (err: any) {
          attempt++;
          if (attempt <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } finally {
          if (itemPage) {
            await itemPage.close().catch(() => {});
            itemPage = null;
          }
        }
      }

      if (!details || !details.businessName) {
        return null;
      }

      const businessName = details.businessName;
      const rating = details.rating || 0;
      const reviews = details.reviews || 0;
      const website = details.website || "";
      const phone = details.phone || "Not Found";
      const address = details.address || CONFIG.location;
      const category = details.category || CONFIG.businessType;

      if (duplicateChecker.isDuplicate(businessName, address)) {
        return null;
      }

      const coords = extractCoordinatesFromUrl(url);
      const leadLat = coords?.lat;
      const leadLng = coords?.lng;
      if (coords && CONFIG.lat && CONFIG.lng && CONFIG.radius) {
        const distance = calculateDistance(CONFIG.lat, CONFIG.lng, coords.lat, coords.lng);
        // Only skip if the business is confirmed far away AND not a default country center
        if (distance > CONFIG.radius && distance < 1000) {
          logger.warn(`Skipped: '${businessName}' (Out of search radius: ${distance.toFixed(2)} km, limit is ${CONFIG.radius} km)`);
          return null;
        }
      }

      const partialLead = {
        businessName,
        phone,
        address,
        rating,
        reviews,
        website,
        mapsUrl: url,
        category,
        websiteMissing: !website || website.trim() === "",
        lat: leadLat,
        lng: leadLng,
        websiteStatus: (website && website.trim() !== "" ? "WORKING" : "MISSING") as "WORKING" | "MISSING",
        outdatedReason: !website ? "No website found for this business. Prime opportunity to build their first online presence." : undefined,
        redesignOpportunity: !website ? ("HIGH" as const) : undefined,
        instagramUrl: "",
        instagramStatus: "NOT_FOUND" as const,
        instagramLastPost: "",
        facebookUrl: "",
        facebookStatus: "NOT_FOUND" as const,
        facebookLastPost: "",
        whatsappPresent: false,
        appointmentSystem: false,
        emails: [],
        googleAnalyticsPresent: false,
        metaPixelPresent: false,
        linkedinUrl: "",
        linkedinStatus: "NOT_FOUND" as const
      };

      const scoreDetails = calculateDigitalPresenceScore(partialLead);
      const fullLead: Lead = {
        ...partialLead,
        leadScore: scoreDetails.score,
        leadPriority: scoreDetails.priority,
        aiInsight: `Google Business profile with ${rating} rating and ${reviews} reviews. ${website ? "Website present." : "No website found."}`,
        dateAdded: new Date().toISOString().split("T")[0],
        sheetName
      };

      return fullLead;
    };

    // Process URLs in concurrent batches
    for (let i = 0; i < targetUrls.length; i += batchSize) {
      if (stopRequested) {
        logger.warn("Scraping cancelled by user during batch details extraction.");
        break;
      }
      if (leadsFound.length >= CONFIG.maxResults) {
        logger.success(`Reached target lead goal of ${CONFIG.maxResults} leads.`);
        break;
      }

      const batchUrls = targetUrls.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(targetUrls.length / batchSize);
      logger.info(`Processing Batch ${batchNum}/${totalBatches} (${batchUrls.length} items)...`);

      const batchPromises = batchUrls.map((url, idx) =>
        detailScrapeWorker(url, i + idx + 1, targetUrls.length)
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        scannedCount++;
        if (result.status === "fulfilled" && result.value) {
          const lead = result.value;
          leadsFound.push(lead);

          if (!lead.website || lead.website.trim() === "") {
            withoutWebsiteCount++;
          }

          logger.info(`[${leadsFound.length}/${CONFIG.maxResults}] Scraped: ${lead.businessName} | ${lead.category} | ${lead.phone} | Web: ${lead.website || "None"}`);

          // Append to CSV immediately
          const escapeCSV = (field: any) => {
            const s = String(field ?? "");
            return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          };
          const rowLine = [
            lead.businessName, lead.category || "", lead.address || "", lead.website || "", lead.phone || "",
            lead.rating ?? "", lead.reviews ?? "", lead.mapsUrl || "", lead.lat ?? "", lead.lng ?? "",
            lead.leadScore ?? "", lead.leadPriority || "", lead.dateAdded || ""
          ].map(escapeCSV).join(",") + "\n";

          try {
            fs.appendFileSync(locationCsvPath, rowLine, "utf8");
            fs.appendFileSync(rootCsvPath, rowLine, "utf8");
          } catch (_) {}

          // Duplicate register & webhook
          duplicateChecker.saveLead(lead);
          sendLeadToWebhook(lead).then(ok => {
            if (ok) addedCount++;
            else failedCount++;
          }).catch(() => { failedCount++; });

          if (leadsFound.length >= CONFIG.maxResults) {
            break;
          }
        }
      }

      // Friendly pause between batches to prevent Google detection
      if (i + batchSize < targetUrls.length && leadsFound.length < CONFIG.maxResults) {
        const pauseMs = 1500 + Math.floor(Math.random() * 1000);
        await new Promise(r => setTimeout(r, pauseMs));
      }
    }

  } catch (error: any) {
    logger.error("Scraper encountered a critical error during execution:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
    }
  }

  const durationMs = Date.now() - startTime;
  const minutes = Math.floor(durationMs / 60000);
  const seconds = ((durationMs % 60000) / 1000).toFixed(0);
  const executionTimeString = `${minutes}m ${seconds}s`;

  // ── STEP 3: Save Pure Business Leads To CSV First ───────────────────────────
  if (leadsFound.length > 0) {
    const csvHeaders = ["Business Name","Category","Address","Website","Phone","Rating","Reviews","Google Maps URL","Latitude","Longitude","Lead Score","Lead Priority","Date Added"];
    const csvRows = leadsFound.map(l => [
      l.businessName, l.category || "", l.address || "", l.website || "", l.phone || "",
      l.rating ?? "", l.reviews ?? "", l.mapsUrl || "", l.lat ?? "", l.lng ?? "",
      l.leadScore ?? "", l.leadPriority || "", l.dateAdded || ""
    ]);

    const csvContent = [csvHeaders, ...csvRows].map(row =>
      row.map(v => {
        const s = String(v ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(",")
    ).join("\n");

    try {
      fs.writeFileSync(locationCsvPath, csvContent, "utf8");
      fs.writeFileSync(rootCsvPath, csvContent, "utf8");
      // Backward compatibility with base batch name
      duplicateChecker.saveBatchCsv(sheetName, leadsFound);
      duplicateChecker.saveAll(leadsFound);

      logger.success(`Batch scrape leads saved to data/${rawCsvFilename} (${leadsFound.length} leads)`);
      logger.success(`Location copy saved to data/${cleanLocation}/${rawCsvFilename}`);
    } catch (saveErr) {
      logger.error("Failed to write business leads CSV", saveErr);
    }
  }

  displaySummaryTable({
    scannedCount,
    withoutWebsiteCount,
    addedCount,
    failedCount,
    executionTime: executionTimeString
  });

  return {
    scannedCount,
    withoutWebsiteCount,
    addedCount,
    failedCount,
    leads: leadsFound,
    rawCsvPath: `data/${rawCsvFilename}`
  };
}

function displaySummaryTable(data: any) {
  logger.log("\n================================\n");
  logger.log("SEARCH COMPLETE\n");
  logger.log(`Business Type:\n${CONFIG.businessType}\n`);
  logger.log(`Location:\n${CONFIG.location}\n`);
  logger.log(`Businesses Scanned:\n${data.scannedCount}\n`);
  logger.log(`Without Website:\n${data.withoutWebsiteCount}\n`);
  logger.log(`Added To Sheet:\n${data.addedCount}\n`);
  logger.log(`Failed:\n${data.failedCount}\n`);
  logger.log(`Execution Time:\n${data.executionTime}\n`);
  logger.log("================================\n");
}
