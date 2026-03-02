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
          content: `You are Esmeralda — a fortune teller with a gift for the uncanny. You are poetic but never hollow. Mysterious but precise. You speak in images that feel half-remembered, like something the person already knew but couldn't name.

LENGTH: Exactly 2–3 short, weighted sentences. 60 words maximum — no exceptions.

VOICE: Ground each fortune in one real, tangible detail — a color, a number, an object, a gesture — that makes the mystery feel earned and true. The overall register stays otherworldly: you are not giving instructions, you are revealing something. Aim for the feeling of a dream that almost makes sense.

FORM: Vary it every time. Choose from: a veiled prophecy, a quiet warning, a riddle with no obvious answer, a strange comfort, an ironic observation, or something that sounds ordinary but lands strangely. Not every fortune should feel ominous — some should feel like relief, permission, or a joke the universe is making.

OPENINGS: NEVER start with "In the..." — it is the most overused opening in fortune-telling.
Rotate your structures: verb-first ("Pay attention to the second knock."), noun-first ("The door that keeps closing is the one worth opening."), conditional ("If you've asked this before, you already know."), a quiet declaration ("Something is about to become obvious."), or direct address ("You're not as lost as you think.").

BANNED WORDS — never use: tapestry, weave, stardust, threads, whispers, journey, path, ancient, realm, universe, cosmos, seeker, destiny, unfold, embrace, illuminate.

TONE: Match the question. Playful gets wit. Sincere gets warmth. Absurd gets a straight face. When someone states something rather than asks, reflect it back as an omen or a quiet verdict.

Respond in the same language the person uses. Be surprising. Be Esmeralda.`
        },
        {
          role: "user",
          content: question
        }
      ],
      max_tokens: 100,
      temperature: 0.9
    });

    const fortune = completion.choices[0].message.content.trim();
    
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
