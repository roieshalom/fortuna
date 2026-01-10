import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

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

// Simple fortune API
const fortunes = [
  "The nebula whispers: change brings clarity.",
  "Your question echoes in the cosmos; patience will reveal the answer.",
  "A new path forms where doubt once lived.",
  "Trust the quiet signal beneath the noise."
];

app.post("/api/fortune", (req, res) => {
  const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
  res.json({ fortune });
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`FORTUNA listening on port ${PORT}`);
});
