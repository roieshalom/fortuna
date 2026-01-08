// src/server/index.js
const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend from src/client
const clientPath = path.join(__dirname, "..", "client");
app.use(express.static(clientPath));

// API route: generate a fortune
app.post("/api/fortune", async (req, res) => {
  const { question } = req.body || {};

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: "Please ask a question." });
  }

  // TODO: replace this block with real API call using process.env.FORTUNE_API_KEY
  const fakeFortunes = [
    "The winds of change are already in your favor.",
    "An unexpected message will bring clarity soon.",
    "Your patience will pay off sooner than you think.",
    "Saying no will open the door you actually want.",
    "You already know the answer, you just needed to ask."
  ];
  const fortune =
    fakeFortunes[Math.floor(Math.random() * fakeFortunes.length)];

  return res.json({
    question,
    fortune
  });
});

// Fallback: send index.html for any other route (simple SPA feel)
app.get("*", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Fortuna server running at http://localhost:${PORT}`);
});
