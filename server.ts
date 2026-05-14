import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser with increased limit for base64 images
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Upload Action (ImgBB proxy)
  app.post("/api/upload", async (req, res) => {
    // List keys from user to prevent "unauthorized" or "quota" errors
    const keys = [
      process.env.IBB,
      "4b0e7625ca15a17bbb9048f4a56a46f1",
      "ffd03b4182baf51dc036903cc090a4a3"
    ].filter(Boolean) as string[];

    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "Gambar tidak terkirim" });

    const cleanBase64 = image.includes("base64,") ? image.split("base64,")[1] : image;

    // Try each key
    for (const apiKey of keys) {
      try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: "POST",
          body: new URLSearchParams({ image: cleanBase64 }),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const result = await response.json() as any;
        if (result.success) {
          const finalUrl = result.data.display_url || result.data.url;
          return res.json({ success: true, url: finalUrl });
        }
      } catch (err) {
        console.error("Key failed:", apiKey);
      }
    }

    res.status(400).json({ error: "Semua API Key Gagal atau Limit. Silakan cek ulang Key kaka." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
