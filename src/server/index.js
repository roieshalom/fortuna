// src/server/index.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

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

// Static assets for Three.js texture
const assetsPath = path.join(__dirname, "assets");
app.use("/server/assets", express.static(assetsPath));

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// AI Fortune API
app.post("/api/fortune", async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ fortune: "Ask a question to consult the nebula." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a mystical fortune teller consulting the cosmic nebula. Give brief, poetic fortunes (2-3 sentences max) in response to questions. Be cryptic yet hopeful."
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
    
    // Log the question and fortune to JSON array
    const logEntry = {
      timestamp: new Date().toISOString(),
      question,
      fortune
    };
    
    try {
      const logPath = path.join(__dirname, "fortune-log.json");
      let logs = [];
      
      // Read existing logs if file exists
      if (fs.existsSync(logPath)) {
        const fileContent = fs.readFileSync(logPath, "utf8");
        logs = JSON.parse(fileContent);
      }
      
      // Add new entry
      logs.push(logEntry);
      
      // Write back with pretty formatting
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    } catch (logError) {
      console.error("Failed to log fortune:", logError);
      // Don't fail the request if logging fails
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
