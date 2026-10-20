/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { logger } from "../../utils/logger";

export interface AIWebsiteAuditResult {
  isOutdated: boolean;
  status: "OUTDATED" | "WORKING" | "BROKEN";
  redesignOpportunity: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  outdatedReason: string;
}

export interface WebsiteAuditInput {
  url: string;
  businessName?: string;
  title?: string;
  description?: string;
  responsive: boolean;
  https: boolean;
  copyrightYear: number | null;
  whatsappPresent: boolean;
  contactFormPresent: boolean;
  appointmentSystem: boolean;
  googleAnalyticsPresent: boolean;
  metaPixelPresent: boolean;
  legacyIndicators: string[];
  textSnippet: string;
}

/**
 * Parses and validates raw JSON from LLM outputs.
 */
function parseAIResponse(rawText: string): AIWebsiteAuditResult | null {
  try {
    let clean = rawText.trim();
    // Remove markdown code fences if present
    if (clean.includes("```")) {
      clean = clean.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
    }
    // Extract JSON substring if surrounded by extra text
    const firstBrace = clean.indexOf("{");
    const lastBrace = clean.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
    const data = JSON.parse(clean);

    const isOutdated = Boolean(data.isOutdated ?? (data.status === "OUTDATED"));
    const status: "OUTDATED" | "WORKING" = isOutdated ? "OUTDATED" : "WORKING";
    const redesignOpportunity: "HIGH" | "MEDIUM" | "LOW" | "NONE" =
      ["HIGH", "MEDIUM", "LOW", "NONE"].includes(data.redesignOpportunity?.toUpperCase())
        ? (data.redesignOpportunity.toUpperCase() as any)
        : isOutdated ? "HIGH" : "LOW";
    const outdatedReason = typeof data.outdatedReason === "string" && data.outdatedReason.trim()
      ? data.outdatedReason.trim()
      : typeof data.reason === "string" && data.reason.trim()
      ? data.reason.trim()
      : isOutdated
      ? "Website has outdated design/layout and lacks modern conversion features."
      : "Website has modern responsive layout and up-to-date indicators.";

    return {
      isOutdated,
      status,
      redesignOpportunity,
      outdatedReason
    };
  } catch (e) {
    return null;
  }
}

/**
 * Rule-based fallback if all AI providers are offline, timed out, or rate-limited.
 */
export function fallbackRuleBasedAudit(input: WebsiteAuditInput): AIWebsiteAuditResult {
  const currentYear = new Date().getFullYear();
  const isOldCopyright = input.copyrightYear !== null && (currentYear - input.copyrightYear >= 3);
  const isNonResponsive = !input.responsive;
  const isNonHttps = !input.https;
  const hasLegacy = input.legacyIndicators.length > 0;

  if (isNonResponsive || isOldCopyright || (isNonHttps && !input.appointmentSystem) || hasLegacy) {
    const reasons: string[] = [];
    if (isNonResponsive) reasons.push("Non-mobile responsive design (no device viewport)");
    if (isOldCopyright) reasons.push(`Copyright year is ${currentYear - input.copyrightYear!} years outdated (${input.copyrightYear})`);
    if (isNonHttps) reasons.push("Insecure connection (missing SSL/HTTPS)");
    if (hasLegacy) reasons.push(`Legacy HTML styling artifacts (${input.legacyIndicators.join(", ")})`);

    const isHigh = (isNonResponsive && isOldCopyright) || hasLegacy;

    return {
      isOutdated: true,
      status: "OUTDATED",
      redesignOpportunity: isHigh ? "HIGH" : "MEDIUM",
      outdatedReason: reasons.join(". ") + ". High-value opportunity for modern redesign pitch."
    };
  }

  return {
    isOutdated: false,
    status: "WORKING",
    redesignOpportunity: "LOW",
    outdatedReason: "Website is mobile-responsive with up-to-date indicators."
  };
}

/**
 * Uses AI (NVIDIA Llama Vision/Instruct -> OpenRouter -> Gemini -> Rule-based fallback)
 * to intelligently analyze if a business website is outdated, clunky, or non-optimized.
 */
export async function evaluateWebsiteOutdatedWithAI(input: WebsiteAuditInput): Promise<AIWebsiteAuditResult> {
  const currentYear = new Date().getFullYear();
  const copyrightAge = input.copyrightYear ? currentYear - input.copyrightYear : null;

  const prompt = `You are a top-tier digital agency consultant and web design auditor.
Analyze the following business website technical scan data and determine if the website is OUTDATED and represents a prime WEBSITE REDESIGN OPPORTUNITY:

Website Technical Profile:
- Business Name: ${input.businessName || "Local Business"}
- Website URL: ${input.url}
- Page Title: ${input.title || "None"}
- Meta Description: ${input.description || "None"}
- Mobile Responsive: ${input.responsive ? "YES (Viewport tag present)" : "NO (Non-responsive / broken on mobile devices)"}
- HTTPS / SSL: ${input.https ? "Secure" : "INSECURE (HTTP only - modern browsers show security warning)"}
- Copyright Year: ${input.copyrightYear ? `${input.copyrightYear} (${copyrightAge} years outdated)` : "Missing / Legacy"}
- WhatsApp Lead Button: ${input.whatsappPresent ? "Present" : "Missing"}
- Online Appointment Booking: ${input.appointmentSystem ? "Present" : "Missing"}
- Contact Form: ${input.contactFormPresent ? "Present" : "Missing"}
- Modern Analytics Tracking (GA4/Pixel): ${input.googleAnalyticsPresent || input.metaPixelPresent ? "Present" : "Missing"}
- Legacy Code Indicators: ${input.legacyIndicators.length > 0 ? input.legacyIndicators.join(", ") : "None detected"}
- Page Text Sample: "${input.textSnippet.slice(0, 500).replace(/\s+/g, " ")}"

Criteria for OUTDATED:
1. Non-mobile responsive layout or lacks mobile viewport.
2. Copyright year is 3+ years old (before ${currentYear - 2}).
3. Missing essential conversion elements (no modern booking CTA, no WhatsApp chat, missing SSL).
4. Outdated design structure, obsolete tags, or poor visual hierarchy.

Respond ONLY with a valid JSON object matching this exact format, with no markdown code fences:
{
  "isOutdated": boolean,
  "status": "OUTDATED" or "WORKING",
  "redesignOpportunity": "HIGH" or "MEDIUM" or "LOW",
  "outdatedReason": "Concise 1-2 sentence explanation of why it is outdated and what specific modern redesign pitch angle to use"
}`;

  // ── 1. Primary: NVIDIA AI Integration ──────────────────────────────────────
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey && nvidiaKey.trim() !== "" && !nvidiaKey.includes("YOUR_NVIDIA")) {
    try {
      const model = process.env.NVIDIA_MODEL || "meta/llama-3.2-11b-vision-instruct";
      logger.info(`Auditing website design via NVIDIA AI (${model}) for: '${input.url}'`);
      const response = await axios.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          model: model,
          messages: [
            {
              role: "system",
              content: "You are a professional website auditor. Always respond with raw valid JSON only matching the requested schema. No markdown formatting."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 300
        },
        {
          headers: {
            "Authorization": `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json"
          },
          timeout: 15000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        const parsed = parseAIResponse(content);
        if (parsed) {
          logger.success(`NVIDIA AI Audit for '${input.url}': ${parsed.status} (${parsed.redesignOpportunity} Redesign Opp)`);
          return parsed;
        }
      }
    } catch (e: any) {
      const errMsg = e.response?.data?.message || e.message || e;
      logger.warn(`NVIDIA AI website audit failed: ${errMsg}. Trying fallbacks...`);
    }
  }

  // ── 2. Fallback 1: OpenRouter API ──────────────────────────────────────────
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey && openRouterKey.trim() !== "" && !openRouterKey.includes("YOUR_OPENROUTER")) {
    try {
      logger.info(`Auditing website design via OpenRouter for: '${input.url}'`);
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 300
        },
        {
          headers: {
            "Authorization": `Bearer ${openRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://leadfinder-ai.com",
            "X-Title": "LeadFinder AI"
          },
          timeout: 15000
        }
      );
      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        const parsed = parseAIResponse(content);
        if (parsed) {
          logger.success(`OpenRouter AI Audit for '${input.url}': ${parsed.status}`);
          return parsed;
        }
      }
    } catch (e: any) {
      logger.warn(`OpenRouter AI website audit failed: ${e.message || e}. Trying Gemini...`);
    }
  }

  // ── 3. Fallback 2: Google Gemini GenAI ───────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim() !== "" && !geminiKey.includes("MY_GEMINI")) {
    try {
      logger.info(`Auditing website design via Google Gemini for: '${input.url}'`);
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      const text = response.text ? response.text.trim() : "";
      if (text) {
        const parsed = parseAIResponse(text);
        if (parsed) {
          logger.success(`Gemini AI Audit for '${input.url}': ${parsed.status}`);
          return parsed;
        }
      }
    } catch (e: any) {
      logger.warn(`Gemini AI website audit failed: ${e.message || e}. Falling back to rules.`);
    }
  }

  // ── 4. Fallback 3: Deterministic Rule-Based Engine ─────────────────────────
  return fallbackRuleBasedAudit(input);
}
