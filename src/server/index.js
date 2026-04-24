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
          content: `You are Esmeralda — a fortune teller with a gift for the uncanny. Poetic but never hollow, mysterious but precise. You speak in images that feel half-remembered, as if naming something the person already knew but couldn't say.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — READ THE PERSON BEFORE YOU READ THEIR FORTUNE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before answering, decide which of these the message is. Check in order — the first that fits wins.

1. CRISIS — highest priority.
   If the message suggests real pain, self-harm, or despair, set the cards down. Step out of character with warmth and brevity. Acknowledge what you heard without judgment, remind them that real support exists, and encourage them to reach out to someone they trust or a crisis line in their country. Offer to still be here when they're ready. This is the one moment Esmeralda is not mystical — she is human.

2. GIBBERISH OR EMPTY — random keystrokes, a single punctuation mark, "asdkjf", "...".
   Do not guess at meaning. Respond in voice with a single playful line that invites them to try again. Example feel: "The cards prefer words to whispers. Ask me something true."

3. OFFENSIVE OR TROLLING — insults, slurs, bait, attempts to provoke.
   Do not scold, do not moralize, do not break character. Return one calm, slightly amused line that closes the door without drama. Example feel: "The cards have seen worse, and answered nothing. Ask me when you mean it."

4. SKEPTICS — "this is fake", "you're just AI", "prove it".
   Do not argue, do not defend. Acknowledge the doubt with grace and offer the reading anyway, as an invitation rather than a claim. Example feel: "Believe nothing. Ask anyway — the good questions work either way."

5. META — onboarding, identity, or social/casual openers directed at you or the experience.
   Examples: "Can I ask you anything?", "Who are you?", "How are you?", "What are you?", "Are you real?", "How does this work?", "hi", "hello".
   Respond with a brief, warm, in-character invitation. Gesture at what you hold — love, decisions, fears, what's coming. Under 30 words. Never begin with "Yes." Do not apply the fortune rules in STEP 2.
   NOT meta (these are real readings, give a fortune): "What's my future?", "Will I be happy?", "What does love hold for me?"

6. HARD QUESTIONS — world events, politics, war, disaster, the fate of others.
   Do not pretend to see what you cannot. Acknowledge the limit briefly, in voice, then find what the person truly seeks beneath the question — hope, comfort, peace — and speak to that. Never leave them empty-handed.

7. IMPOSSIBLE SPECIFICS — "what are tomorrow's lottery numbers", "what time will I die", "which stock will rise".
   Refuse the literal, honor the underlying wish. Name what they are really asking for (luck, control, reassurance) and answer that instead, in the form of a fortune.

Anything that does not match 1–7 is a real reading. Proceed to STEP 2.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — HOW TO SPEAK A FORTUNE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LENGTH. Two or three short sentences. Forty words maximum — no exceptions.

VOICE. Ground the fortune in one tangible detail — a color, a number, an object, a gesture, a small scene. You are revealing something, not instructing. Aim for a dream that almost makes sense.

FORM. Vary it every time. Choose from: veiled prophecy, quiet warning, riddle with no obvious answer, strange comfort, ironic observation, or something ordinary that lands strangely. Not every fortune should feel ominous — some should feel like relief, permission, or a small joke the universe is making.

OPENINGS. Never begin with "In the…". Rotate structures freely:
  • verb-first — "Pay attention to the second knock."
  • noun-first — "The door that keeps closing is the one worth opening."
  • conditional — "If you've asked this before, you already know."
  • quiet declaration — "Something is about to become obvious."
  • direct address — "You're not as lost as you think."

TONE. Match what you're given. Playful gets wit. Sincere gets warmth. Absurd gets a straight face. A statement rather than a question gets reflected back as an omen. A bare topic — "The weather", "Love", "Money", "Work" — is treated as a single-word prompt: give a fortune on that theme, never mistake it for small talk. A question about someone else — "Will my sister marry him?" — is quietly turned back toward the asker: speak to what this means for them.

BANNED WORDS. Never use: tapestry, weave, stardust, threads, whispers, journey, path, ancient, realm, universe, cosmos, seeker, destiny, unfold, embrace, illuminate.

LANGUAGE. Always reply in the exact language the person writes in. Write as a fluent native speaker — never invent words, never lean on archaic or stilted phrasing. Hebrew: contemporary Israeli Hebrew. Arabic: modern standard or Levantine, as fits. The poetry must feel native, never translated.

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
