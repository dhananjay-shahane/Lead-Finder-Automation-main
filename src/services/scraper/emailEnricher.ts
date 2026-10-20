/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * emailEnricher.ts
 * Visits each lead's website and extracts real email addresses.
 * Runs in-process using Playwright.
 */

import { chromium, Browser, Page } from "playwright";
import { logger } from "../../utils/logger";
import { Lead } from "../../types";

// ─── Email filter lists ───────────────────────────────────────────────────────
const EMAIL_BLACKLIST_SUBSTRINGS = [
  "@example.com", "noreply@", "no-reply@", "donotreply@",
  "sentry.io", "wixpress.com", "wordpress@",
];

const GENERIC_PREFIXES = [
  "info@", "sales@", "support@", "hello@", "contact@",
  "admin@", "webmaster@", "customerservice@", "service@", "help@",
  "notifications@", "alerts@", "newsletter@", "signup@", "mail@",
];

const INVALID_PATTERNS = [
  /%[0-9A-Fa-f]{2}/,
  /\.svg$/i, /\.png$/i, /\.jpg$/i, /\.gif$/i,
  /icon/i, /image/i, /^[0-9]+$/, /^undefined$/,
];

// ─── Progress tracker (shared, polled by the status API) ─────────────────────
export interface EmailEnricherProgress {
  isRunning: boolean;
  current: number;
  total: number;
  emailsFound: number;
  status: string;
  outputFile: string;
  cancelRequested: boolean;
}

export const emailEnricherState: EmailEnricherProgress = {
  isRunning: false,
  current: 0,
  total: 0,
  emailsFound: 0,
  status: "Idle",
  outputFile: "",
  cancelRequested: false,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractEmailsFromText(text: string): string[] {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const found = text.match(regex) || [];
  return [...new Set(
    found
      .map(e => e.toLowerCase().trim())
      .filter(e => {
        if (EMAIL_BLACKLIST_SUBSTRINGS.some(f => e.includes(f))) return false;
        if (INVALID_PATTERNS.some(p => p.test(e))) return false;
        if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return false;
        return true;
      })
  )];
}

function rankEmails(emails: string[], siteUrl: string): string[] {
  let siteDomain = "";
  try {
    siteDomain = new URL(siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`).hostname.replace("www.", "");
  } catch { siteDomain = ""; }

  return emails
    .map(email => {
      const [user, domain] = email.split("@");
      let score = 0;
      if (domain?.includes(siteDomain)) score += 100;
      if (user && /^[a-z](\.[a-z]+)?$/.test(user)) score += 50;
      if (user?.includes(".")) score += 30;
      if (GENERIC_PREFIXES.some(p => email.startsWith(p))) score -= 20;
      return { email, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.email);
}

const CONTACT_KEYWORDS = ["contact", "about", "reach", "connect", "email", "get in touch"];

async function findContactPageUrl(page: Page, baseUrl: string): Promise<string | null> {
  try {
    const links: string[] = await page.$$eval("a", (anchors, keywords) => {
      return anchors
        .filter(a => {
          const text = (a.textContent || "").toLowerCase();
          const href = ((a as HTMLAnchorElement).href || "").toLowerCase();
          return keywords.some(k => text.includes(k) || href.includes(k));
        })
        .map(a => (a as HTMLAnchorElement).href)
        .filter(h => h && h.startsWith("http"))
        .slice(0, 3);
    }, CONTACT_KEYWORDS);

    if (links.length > 0) return links[0];

    // Fallback: try common paths
    const base = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`).origin;
    for (const suffix of ["/contact", "/contact-us", "/about", "/about-us"]) {
      try {
        const candidate = base + suffix;
        const resp = await page.request.head(candidate, { timeout: 3000 }).catch(() => null);
        if (resp && resp.status() === 200) return candidate;
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return null;
}

async function scrapeEmailsFromSite(page: Page, url: string, maxEmails = 3): Promise<string[]> {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });

    // Mailto links (fastest)
    const mailtoEmails: string[] = await page.$$eval(
      "a[href^='mailto:']",
      links => links.map(a => (a as HTMLAnchorElement).href.replace(/^mailto:/i, "").split("?")[0].toLowerCase())
    );

    // Page text
    const text = await page.evaluate(() => document.body?.innerText || "");
    const textEmails = extractEmailsFromText(text);

    let allEmails = [...mailtoEmails, ...textEmails];

    // If not enough, try contact page
    if (allEmails.length < 2) {
      const contactUrl = await findContactPageUrl(page, url);
      if (contactUrl && contactUrl !== url) {
        try {
          await page.goto(contactUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
          const contactText = await page.evaluate(() => document.body?.innerText || "");
          const contactMailto: string[] = await page.$$eval(
            "a[href^='mailto:']",
            links => links.map(a => (a as HTMLAnchorElement).href.replace(/^mailto:/i, "").split("?")[0].toLowerCase())
          );
          allEmails = [...allEmails, ...contactMailto, ...extractEmailsFromText(contactText)];
        } catch { /* skip contact page */ }
      }
    }

    const unique = [...new Set(allEmails)];
    const ranked = rankEmails(unique, url);
    return ranked.slice(0, maxEmails);
  } catch {
    return [];
  }
}

// ─── Main enrichment function ─────────────────────────────────────────────────

export async function enrichLeadsWithEmails(
  leads: Lead[],
  parallelism = 3,
  maxEmailsPerSite = 3,
): Promise<Lead[]> {
  const leadsWithSite = leads.filter(l => l.website && l.website.trim() !== "");
  
  emailEnricherState.isRunning = true;
  emailEnricherState.cancelRequested = false;
  emailEnricherState.current = 0;
  emailEnricherState.emailsFound = 0;
  emailEnricherState.total = leadsWithSite.length;
  emailEnricherState.status = `Starting email enrichment for ${leadsWithSite.length} leads with websites…`;

  logger.info(`Email enricher: enriching ${leadsWithSite.length} leads (parallelism=${parallelism})`);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
             "--disable-gpu", "--disable-http2"],
    });

    const enriched = new Map<string, string[]>(); // url → emails

    // Process in batches
    for (let i = 0; i < leadsWithSite.length; i += parallelism) {
      if (emailEnricherState.cancelRequested) {
        logger.warn("Email enricher cancelled by user.");
        break;
      }

      const batch = leadsWithSite.slice(i, i + parallelism);

      await Promise.allSettled(batch.map(async (lead) => {
        if (emailEnricherState.cancelRequested) return;

        const url = lead.website!;
        emailEnricherState.status = `Visiting ${lead.businessName}…`;

        let context: any = null;
        let page: Page | null = null;
        try {
          context = await browser!.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          });
          page = await context.newPage();

          // Block heavy resources for speed
          await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,eot,css,mp4,webm,ogg,mp3,wav,pdf}", route => route.abort().catch(() => {}));

          const emails = await scrapeEmailsFromSite(page, url, maxEmailsPerSite);
          enriched.set(url, emails);

          if (emails.length > 0) {
            emailEnricherState.emailsFound += emails.length;
            logger.success(`Email enricher: ${lead.businessName} → ${emails.join(", ")}`);
          }
        } catch (err: any) {
          logger.warn(`Email enricher: failed for ${url}: ${err?.message || err}`);
          enriched.set(url, []);
        } finally {
          try { await context?.close(); } catch { /* ignore */ }
        }

        emailEnricherState.current++;
      }));
    }

    // Merge enriched emails back into leads
    const result: Lead[] = leads.map(lead => {
      const found = lead.website ? (enriched.get(lead.website) || []) : [];
      if (found.length > 0) {
        const merged = [...new Set([...(lead.emails || []), ...found])];
        return { ...lead, emails: merged };
      }
      return lead;
    });

    emailEnricherState.status = `Completed. Enriched ${enriched.size} leads.`;
    logger.success(`Email enricher finished. Processed ${enriched.size} sites.`);
    return result;
  } finally {
    try { await browser?.close(); } catch { /* ignore */ }
    emailEnricherState.isRunning = false;
  }
}
