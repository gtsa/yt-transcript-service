import express from "express";
import cors from "cors";
import * as ycs from "youtube-captions-scraper";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// optional root
app.get("/", (_req, res) => {
  res.json({
    service: "yt-transcript-service",
    status: "ok",
    endpoints: ["/health", "/api/v1/captions"]
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "yt-transcript-service" });
});

app.post("/api/v1/captions", async (req, res) => {
  try {
    const { url, lang = "en" } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: "Missing 'url' field" });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: "Invalid YouTube URL" });
    }

    // try to fetch subtitles directly
    const subtitles = await ycs.getSubtitles({
      videoID: videoId,
      lang
    });

    if (!subtitles || subtitles.length === 0) {
      return res.status(404).json({
        error: "No captions found (maybe not available in this language)",
        videoId,
        requestedLang: lang
      });
    }

    const transcript = subtitles.map((s: any) => s.text).join(" ").trim();

    return res.json({
      videoId,
      requestedLang: lang,
      transcript,
      captions: subtitles
    });
  } catch (err: any) {
    console.error("Error fetching captions:", err?.message || err);
    return res.status(500).json({
      error: "Failed to fetch captions",
      details: err?.message || "Unknown error"
    });
  }
});

function extractVideoId(url: string): string | null {
  const re =
    /(?:youtube\.com\/.*v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/;
  const match = url.match(re);
  return match ? match[1] : null;
}

app.listen(PORT, () => {
  console.log(`✅ yt-transcript-service running on http://0.0.0.0:${PORT}`);
});
