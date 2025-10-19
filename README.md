
# ChatGPT endpoint

This project includes a serverless function at `/api/evaluate.js` that calls OpenAI chat completions.

## Setup
- Set environment variables in your deployment:
  - `OPENAI_API_KEY` (required)
  - `EVAL_MODEL` (optional, default: gpt-4o-mini)

## Local dev
This function expects to run on a platform that supports serverless functions for Vite static sites (e.g., Vercel).
Toggle **ChatGPT: ON** in the header to route evaluations to the endpoint.
