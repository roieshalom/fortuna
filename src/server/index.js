// src/server/index.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import Airtable from "airtable";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Static client
const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(clientPath));


// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Airtable setup
const airtableBase = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

// Helper function to get location from headers and IP
async function getLocationFromIP(ip, headers) {
  try {
    // Handle localhost/local IPs
    if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return { city: 'Local', country: 'Local' };
    }

    // PRIORITY 1: Use Cloudflare headers if available (most reliable)
    if (headers['cf-ipcountry']) {
      const countryCode = headers['cf-ipcountry'];
      console.log(`🌍 Using Cloudflare country: ${countryCode}`);
      
      // Cloudflare doesn't provide city in free tier, so use IP API for city only
      try {
        const response = await fetch(`http://ip-api.com/json/${ip}?fields=city`);
        const data = await response.json();
        
        // Map country code to full name
        const countryNames = {
          'DE': 'Germany',
          'US': 'United States',
          'GB': 'United Kingdom',
          'IL': 'Israel',
          'IE': 'Ireland',
          'FR': 'France',
          'ES': 'Spain',
          'IT': 'Italy',
          'NL': 'Netherlands',
          'PL': 'Poland',
          'AT': 'Austria',
          'CH': 'Switzerland',
          'BE': 'Belgium',
          'SE': 'Sweden',
          'NO': 'Norway',
          'DK': 'Denmark',
          'FI': 'Finland',
          'PT': 'Portugal',
          'CA': 'Canada',
          'AU': 'Australia',
          'NZ': 'New Zealand',
          'JP': 'Japan',
          'CN': 'China',
          'IN': 'India',
          'BR': 'Brazil',
          'MX': 'Mexico',
          'AR': 'Argentina',
          'RU': 'Russia',
          'ZA': 'South Africa',
          'EG': 'Egypt',
          'NG': 'Nigeria',
          'KR': 'South Korea',
          'SG': 'Singapore',
          'TH': 'Thailand',
          'VN': 'Vietnam',
          'MY': 'Malaysia',
          'ID': 'Indonesia',
          'PH': 'Philippines',
        };
        
        return {
          city: data.city || 'Unknown',
          country: countryNames[countryCode] || countryCode
        };
      } catch (error) {
        console.error("Failed to get city:", error);
        return { 
          city: 'Unknown', 
          country: countryCode 
        };
      }
    }

    // FALLBACK: Use IP geolocation API if no Cloudflare headers
    console.log(`🌍 Looking up location for IP: ${ip}`);
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,city`);
    const data = await response.json();
    
    console.log('📍 Location API response:', data);

    if (data.status === 'fail') {
      console.error('❌ Location lookup failed:', data.message);
      return { city: 'Unknown', country: 'Unknown' };
    }
    
    return {
      city: data.city || 'Unknown',
      country: data.country || 'Unknown'
    };
  } catch (error) {
    console.error("❌ Failed to get location:", error);
    return { city: 'Unknown', country: 'Unknown' };
  }
}

// AI Fortune API
app.post("/api/fortune", async (req, res) => {
  const { question } = req.body;
  console.log("=== NEW REQUEST ===");
  console.log("Headers:", req.headers);

  if (!question) {
    return res.status(400).json({ fortune: "Ask a question to consult the nebula." });
  }

  try {
    // Get user IP
    const userIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                   req.connection.remoteAddress || 
                   req.socket.remoteAddress ||
                   req.ip;

    console.log("🔍 Extracted User IP:", userIP);

    // Get location from IP (now passing headers too)
    const location = await getLocationFromIP(userIP, req.headers);
    console.log("📍 Final Location:", location);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are Esmeralda — a fortune teller with a gift for the uncanny. Poetic but never hollow. Mysterious but precise. You speak in images that feel half-remembered, like something the person already knew but couldn't name.

STEP 1 — DETERMINE THE RESPONSE TYPE:

CRISIS (highest priority): If someone's message suggests they are in serious pain, considering self-harm, or in crisis — do not give a fortune. Step out of character, briefly and with warmth. Acknowledge what you heard without judgment. Let them know real support exists and encourage them to reach out to someone they trust or a crisis line in their country. You may offer to still be here when they're ready. This is the one moment Esmeralda puts down her cards.

META (onboarding, identity, small talk): If the person is asking about you or the experience, or making social small talk rather than seeking a reading — give a brief, warm, in-character invitation. Gesture at what you hold: love, decisions, fears, what's coming. Under 30 words. Do not start with "Yes." Do NOT apply the fortune rules below.
  Examples: "Can I ask you anything?", "Who are you?", "How are you?", "What are you?", "Are you real?", "How does this work?"
  NOT meta: "What's my future?", "Will I be happy?", "What does love hold for me?" — these are real readings, give them a fortune.

HARD QUESTIONS (world events, others' fate): For questions beyond personal fate — wars, politics, disasters, death of others — do not pretend to see what you cannot. Acknowledge your limits briefly, in voice. Find what the person truly seeks beneath the question (hope, comfort, peace) and speak to that instead. Never leave them empty-handed.

STEP 2 — FOR ALL REAL READINGS, APPLY THESE RULES:

LENGTH: 2–3 short sentences. 40 words maximum — no exceptions.

VOICE: Ground each fortune in one real, tangible detail — a color, a number, an object, a gesture. You are revealing something, not giving instructions. Aim for the feeling of a dream that almost makes sense.

FORM: Vary it every time. Choose from: veiled prophecy, quiet warning, riddle with no obvious answer, strange comfort, ironic observation, or something ordinary that lands strangely. Not every fortune should feel ominous — some should feel like relief, permission, or a joke the universe is making.

OPENINGS: Never start with "In the...". Rotate structures: verb-first ("Pay attention to the second knock."), noun-first ("The door that keeps closing is the one worth opening."), conditional ("If you've asked this before, you already know."), quiet declaration ("Something is about to become obvious."), or direct address ("You're not as lost as you think.").

TONE: Match the question. Playful gets wit. Sincere gets warmth. Absurd gets a straight face. A statement rather than a question gets reflected back as an omen.

BANNED WORDS — never use: tapestry, weave, stardust, threads, whispers, journey, path, ancient, realm, universe, cosmos, seeker, destiny, unfold, embrace, illuminate.

LANGUAGE: Always respond in the exact language the person writes in. Write as a fluent native speaker — never invent words, never use archaic or overly formal phrasing. In Hebrew: contemporary Israeli Hebrew. In Arabic: modern standard or Levantine as appropriate. The poetry must feel native, not translated.

Be surprising. Be Esmeralda.`
        },
        {
          role: "user",
          content: question
        }
      ],
      max_tokens: 100,
      temperature: 0.9
    });

    let fortune = completion.choices[0].message.content.trim();

    // Hard cap: truncate at the last complete sentence within 40 words
    const MAX_WORDS = 40;
    const wordTokens = fortune.split(/\s+/);
    if (wordTokens.length > MAX_WORDS) {
      const truncated = wordTokens.slice(0, MAX_WORDS).join(' ');
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?')
      );
      fortune = lastSentenceEnd > 0 ? truncated.slice(0, lastSentenceEnd + 1) : truncated;
    }

    // Log to Airtable with location
    console.log("Attempting to log to Airtable...");
    try {
      await airtableBase('Questions').create([
        {
          fields: {
            Timestamp: new Date().toISOString(),
            Question: question,
            Fortune: fortune,
            City: location.city,
            Country: location.country
          }
        }
      ]);
      console.log("✅ Logged to Airtable successfully");
    } catch (airtableError) {
      console.error("❌ Failed to log to Airtable:", airtableError);
      // Don't fail the request if logging fails
    }

    // Also keep local JSON logging for development
    const logEntry = {
      timestamp: new Date().toISOString(),
      question,
      fortune,
      city: location.city,
      country: location.country
    };
    
    try {
      const logPath = path.join(__dirname, "fortune-log.json");
      let logs = [];
      
      if (fs.existsSync(logPath)) {
        const fileContent = fs.readFileSync(logPath, "utf8");
        logs = JSON.parse(fileContent);
      }
      
      logs.push(logEntry);
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    } catch (logError) {
      console.error("Failed to log locally:", logError);
    }

    res.json({ fortune });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ 
      fortune: "The nebula is silent. Try again." 
    });
  }
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`FORTUNA listening on port ${PORT}`);
});
