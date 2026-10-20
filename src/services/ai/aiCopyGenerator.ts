/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { Lead } from "../../types";
import { generateOutreachCopy, renderOutreachTemplate, OutreachTemplate, PitchTemplateConfig } from "../outreach/outreachCopy";
import { loadPitchTemplates } from "../outreach/templateStorage";
import { logger } from "../../utils/logger";

/**
 * Generates custom outreach messages (WhatsApp + Email) for a lead.
 * Supports:
 * - NVIDIA AI Auto Pitch (Business client acquisition OR Job application outreach)
 * - Saved Custom Templates (Website pitch, Social media pitch, Job inquiry pitch, Custom text)
 */
export async function generateAICopy(lead: Lead, customConfig?: PitchTemplateConfig): Promise<OutreachTemplate> {
  const templateConfig = customConfig || loadPitchTemplates();

  // If user selected a deterministic custom template strategy, render directly
  if (templateConfig.selectedStrategy && templateConfig.selectedStrategy !== "ai") {
    logger.info(`Using saved '${templateConfig.selectedStrategy}' template strategy for: '${lead.businessName}'`);
    return renderOutreachTemplate(lead, templateConfig);
  }

  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const isJobGoal = templateConfig.campaignGoal === "job";
  const subGoal = templateConfig.jobSubGoal || "both";

  let prompt = "";

  if (isJobGoal) {
    let focusInstruction = "";
    if (subGoal === "jobOnly") {
      focusInstruction = `Focus EXCLUSIVELY on inquiring about full-time software developer / engineering employment opportunities across Web Development, Android Application Development (Flutter), and AI Applications. Emphasize engineering capabilities, portfolio review, and joining their team.`;
    } else if (subGoal === "freelanceOnly") {
      focusInstruction = `Focus EXCLUSIVELY on offering professional freelance development across Web Development, Android App Development (Flutter), and AI Applications. Emphasize fast project turnaround, high-quality deliverables, and client portfolio.`;
    } else {
      focusInstruction = `Position as a versatile developer available for BOTH full-time engineering roles AND freelance / contract project collaboration in Web Development, Android Application Development, and AI Applications.`;
    }

    prompt = `You are a talented software professional reaching out to a business/clinic for tech collaboration.
${focusInstruction}

Write a personalized, concise, friendly outreach pitch for '${lead.businessName}'.

Candidate Information:
- Candidate Name: "${templateConfig.senderName || "Dhananjay Shahane"}"
- Specialization / Role: "${templateConfig.roleTitle || "Full Stack Developer (Web, Android & AI Apps)"}"
- Core Skills: "${templateConfig.skills || "Next.js, Flutter, React, Android, Node.js, TypeScript, AI Applications"}"
- Portfolio Link: "${templateConfig.portfolioUrl || "https://dhananjay-shahane.vercel.app"}"

Target Company Information:
- Business Name: "${lead.businessName}"
- Category: "${lead.category || "Business"}"
- Rating: ${lead.rating || 0}★ (${lead.reviews || 0} reviews)
- Address: "${lead.address || "Local area"}"

Copywriting Rules:
1. **Brevity**: 2-3 short, clean sentences. No robotic templates or generic resume regurgitation.
2. **Value Hook**: Mention their business reputation, state candidate skills, and link the portfolio.
3. **CTA**: Ask politely if they are hiring or have upcoming project needs.
4. **WhatsApp**: Conversational, under 300 characters, includes portfolio link.
5. **Email**: Professional subject line mentioning role/services and '${lead.businessName}', short body with warm signoff from "${templateConfig.senderName || "Dhananjay Shahane"}".

You MUST return ONLY a single JSON object with no markdown fences or preambles, matching this schema:
{
  "emailSubject": "string",
  "emailBody": "string",
  "whatsappMessage": "string"
}`;
  } else {
    prompt = `You are a professional B2B digital presence and branding specialist. 
Write a highly personalized, human-sounding B2B outreach campaign copy for the business '${lead.businessName}'.
Analyze their digital presence audit details and craft messages targeting their specific needs:
- AI Insight from audit: "${lead.aiInsight || "No specific insight"}"
- Website Status: "${lead.websiteStatus || "MISSING"}" (Website URL: "${lead.website || "None"}")
- Instagram Status: "${lead.instagramStatus || "NOT_FOUND"}" (Instagram URL: "${lead.instagramUrl || "None"}")
- Facebook Status: "${lead.facebookStatus || "NOT_FOUND"}" (Facebook URL: "${lead.facebookUrl || "None"}")
- Rating: ${lead.rating || 0} (${lead.reviews || 0} reviews)
- Category: "${lead.category || "local business"}"
- Emails: "${lead.emails && lead.emails.length > 0 ? lead.emails.join(", ") : "None"}"

Copywriting Rules:
1. **Extreme Brevity & Zero Complexity**: Keep messages very short (2-3 short, clear sentences max). No generic template speak.
2. **Never use the word "marketing"**. Call it "digital presence", "social media", "website", or "branding".
3. **Response-Focused CTA**: End the message with a simple, friendly question asking permission to send value (e.g. "Can I send you the link to check it out?").
4. **If they DO NOT have a website**: Pitch free demo website built specifically for their business.
5. **If they DO have a website**: Pitch social media branding roadmap & booking automation.
6. **Tone & Style**: Friendly, local human. No corporate jargon.

You MUST return ONLY a single JSON object with no markdown fences or preambles, matching this schema:
{
  "emailSubject": "string",
  "emailBody": "string",
  "whatsappMessage": "string"
}`;
  }

  // 1. Try NVIDIA API (Primary)
  if (nvidiaKey && nvidiaKey.trim() !== "" && !nvidiaKey.includes("YOUR_NVIDIA")) {
    try {
      const model = process.env.NVIDIA_MODEL || "meta/llama-3.2-11b-vision-instruct";
      logger.info(`Generating personalized AI outreach copy via NVIDIA API (${model}) for: '${lead.businessName}' [Goal: ${templateConfig.campaignGoal}]`);
      
      const response = await axios.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          model: model,
          messages: [
            {
              role: "system",
              content: "You are a JSON-only response generator. Output ONLY a valid JSON object. Do not include markdown fences, preambles, or conversational commentary."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.2,
          max_tokens: 450
        },
        {
          headers: {
            "Authorization": `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json"
          },
          timeout: 20000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content?.trim();
      if (content) {
        const firstBrace = content.indexOf("{");
        const lastBrace = content.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1) {
          const jsonStr = content.substring(firstBrace, lastBrace + 1);
          const parsed = JSON.parse(jsonStr);
          if (parsed.emailSubject && parsed.emailBody && parsed.whatsappMessage) {
            logger.success(`NVIDIA AI successfully generated outreach copy for: '${lead.businessName}'`);
            return {
              emailSubject: parsed.emailSubject.trim(),
              emailBody: parsed.emailBody.trim(),
              whatsappMessage: parsed.whatsappMessage.trim()
            };
          }
        }
      }
    } catch (error: any) {
      const errMsg = error.response?.data?.detail || error.response?.data?.message || error.message || error;
      logger.warn(`NVIDIA AI copy generation failed: ${errMsg}. Trying fallbacks...`);
    }
  }

  // 2. Try Gemini API (Fallback)
  if (geminiKey && geminiKey.trim() !== "" && geminiKey !== "MY_GEMINI_API_KEY") {
    try {
      logger.info(`Generating personalized AI outreach copy via Gemini for: '${lead.businessName}'`);
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text ? response.text.trim() : "";
      if (text) {
        const cleanJsonStr = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleanJsonStr);
        if (parsed.emailSubject && parsed.emailBody && parsed.whatsappMessage) {
          logger.success(`Gemini successfully generated outreach copy for: '${lead.businessName}'`);
          return {
            emailSubject: parsed.emailSubject.trim(),
            emailBody: parsed.emailBody.trim(),
            whatsappMessage: parsed.whatsappMessage.trim()
          };
        }
      }
    } catch (error: any) {
      logger.warn(`Gemini AI copy generation failed: ${error.message || error}. Falling back to rule-based copy.`);
    }
  }

  // 3. Fallback to template engine
  logger.info(`Using template engine for: '${lead.businessName}'`);
  return renderOutreachTemplate(lead, templateConfig);
}
