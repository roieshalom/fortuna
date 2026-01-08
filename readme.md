# Fortuna

A minimal fortune-teller app that answers one question with one focused fortune.

## Why this exists

Built as a product + UX experiment to explore how people interact with AI-powered guidance tools. The MVP focuses on one core flow: ask → get fortune → reflect.

## How it works

- **Backend**: Node/Express API with one `/api/fortune` endpoint (currently returns random fortunes; will connect to LLM).
- **Frontend**: Plain HTML/CSS/JS, no build tools.

## Run locally

```bash
npm install
npm run dev
