# yt-transcript-service
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

A lightweight microservice that **extracts YouTube video captions** and returns them as clean JSON.  
It converts any YouTube URL into structured text data — including the full transcript and timed caption entries — for downstream use in AI-powered features like translation, summarisation, or quiz generation.

---

## Overview

This service is **ingestion-only**.  
It focuses purely on:
- Fetching available captions from a given YouTube video URL  
- Parsing and formatting them into usable JSON  
- Returning both a **plain transcript** and **timed captions**

It does **not** handle any AI processing (translation, summarisation, etc.) — that lives in a separate companion service called **`text-ai-service`**.

---

## Features

- `POST /api/v1/captions` → Get captions and transcript from a YouTube video  
- Handles multiple URL formats (`youtu.be`, `youtube.com/watch?v=...`, `youtube.com/embed/...`)
- Returns all available caption tracks (languages)
- Outputs both:
  - Raw timed captions (`[{ start, dur, text }]`)
  - Plain text transcript (joined text)
- Simple JSON in / JSON out API
- CORS support for frontend calls
- Docker-ready for integration into the `otterverse-net` network

---

## API (v1)

**Base path:** `/api/v1`

### `POST /api/v1/captions`

#### Request body

```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "lang": "en"
}
````

#### Response (200)

```json
{
  "videoId": "VIDEO_ID",
  "requestedLang": "en",
  "availableTracks": [
    { "lang": "en", "name": "English" },
    { "lang": "es", "name": "Spanish" }
  ],
  "transcript": "Full joined transcript text...",
  "captions": [
    { "start": 0.3, "dur": 2.1, "text": "Hello everyone" },
    { "start": 2.4, "dur": 1.7, "text": "Welcome back to the channel" }
  ]
}
```

#### Error responses

| Code | Description                                                  |
| ---- | ------------------------------------------------------------ |
| 400  | Invalid or missing YouTube URL                               |
| 404  | No captions available for this video                         |
| 500  | Fetching captions failed (dependency or YT structure change) |

---

## 🧾 Versioning

* **Current API version:** `v1`
* Version is always included in the path (`/api/v1/...`)
* Breaking changes (e.g. different response format) will move to `/api/v2/...`
* Non-breaking changes (extra optional fields) remain in `v1`

---

## Local Development

```bash
npm install
npm run dev
# Default: http://localhost:3000
```

Example request:

```bash
curl -X POST http://localhost:3000/api/v1/captions \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","lang":"en"}'
```

---

## 🐳 Docker

### Build and run manually

```bash
docker build -t yt-transcript-service:latest .
docker run --rm -p 3000:3000 yt-transcript-service:latest
```

### With `docker-compose.yml`

Attach it to your shared **`otterverse-net`** network:

```yaml
version: "3.9"
services:
  yt-transcript-service:
    build: .
    container_name: yt-transcript-service
    restart: unless-stopped
    environment:
      - PORT=3000
    ports:
      - "3005:3000"
    networks:
      - otterverse-net

networks:
  otterverse-net:
    external: true
```

This exposes the API at `http://localhost:3005` while making it reachable internally as
`http://yt-transcript-service:3000` (so Nginx or Otterverse backend can proxy to it).

---

## 🧠 Automated Daily Health Check (Dependency Watch)

Because this service relies on YouTube’s internal caption API, **minor YouTube changes** can break the dependency (`youtube-captions-scraper` or similar).

To catch that early, we include an **automated daily check** that validates both functionality and output accuracy.

### Purpose

Ensure the service still:

* ✅ Starts successfully
* ✅ Can fetch captions from a **known, public video ID**
* ✅ Returns a **non-empty transcript**
* ✅ Returns a **predefined, correct output** (so we know parsing still works as expected)

### Implementation Plan

1. Create a script `scripts/daily-check.js` that:

   * Calls the running service endpoint (e.g. `http://yt-transcript-service:3000/api/v1/captions`)
   * Uses one or two **known videos** with stable captions (e.g. short educational clips that don’t get deleted)
   * Compares the output transcript or specific caption lines to an **expected snippet** stored locally
   * Fails if:

     * The service is unreachable
     * HTTP status ≠ 200
     * Transcript is empty
     * Transcript content doesn’t contain the expected text snippet

2. Add a GitHub Actions workflow with a daily cron schedule:

   ```yaml
   on:
     schedule:
       - cron: "0 7 * * *"  # Run every morning UTC
   jobs:
     healthcheck:
       runs-on: ubuntu-latest
       steps:
         - name: Run daily YouTube caption check
           run: |
             curl -s -X POST http://yt-transcript-service:3000/api/v1/captions \
               -H "Content-Type: application/json" \
               -d '{"url":"https://www.youtube.com/watch?v=KNOWN_ID","lang":"en"}' \
               | tee output.json

             if ! grep -q "expected phrase from video" output.json; then
               echo "❌ Output did not match expected phrase."
               exit 1
             fi
   ```

3. If the workflow fails:

   * Check the dependency version (`youtube-captions-scraper` or similar)
   * Rebuild or update the Docker image
   * Redeploy and re-run the check

This ensures you are alerted **immediately** if:

* YouTube changes the structure of its caption data
* The dependency breaks
* The service starts but no longer produces correct or consistent output

---

## ⚠️ Limitations

* Some videos have **no captions** → returns 404
* Some have **only auto-generated captions**
* Rate limits can apply if many requests come from the same IP
* Occasionally YouTube changes structure → requires dependency update
* No persistence — caching layer should be added later for heavy use

---

## 🗺️ Roadmap

| Stage   | Goal                                          |
| ------- | --------------------------------------------- |
| ✅ v1    | Working local + Docker API returning captions |
| 🔜 v1.1 | Add simple caching layer                      |
| 🔜 v1.2 | Integrate daily health-check workflow         |

---

## 📦 Related services

* [`text-ai-service`](https://github.com/your-org/text-ai-service) → for translation, summarisation, and AI-based text processing.
* `otterverse` → main orchestrator and proxy environment where this service is deployed.

---

## 🪪 License

This project is licensed under the **Creative Commons Attribution–NonCommercial 4.0 International (CC BY-NC 4.0)** License.

You are free to:
- **Use**, **share**, and **adapt** the material for personal or educational purposes.
- **Credit** the original author when redistributing or modifying the work.

You may **not**:
- Use the material for **commercial purposes**.
- Distribute derivative works in closed-source or monetized products.

See the full license text here: [https://creativecommons.org/licenses/by-nc/4.0/](https://creativecommons.org/licenses/by-nc/4.0/)


