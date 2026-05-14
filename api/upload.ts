import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.IBB;
  const { image } = req.body;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key IBB tidak ditemukan di Environment Variables Vercel" });
  }
  if (!image) {
    return res.status(400).json({ error: "Gambar tidak terkirim" });
  }

  try {
    const cleanBase64 = image.includes("base64,")
      ? image.split("base64,")[1]
      : image;

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: new URLSearchParams({ image: cleanBase64 }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const result = await response.json() as any;

    if (result.success) {
      res.status(200).json({ success: true, url: result.data.url });
    } else {
      res.status(400).json({ error: "Respon ImgBB: " + (result.error?.message || "Gagal") });
    }
  } catch (err: any) {
    console.error("Upload failed:", err);
    res.status(500).json({ error: "Server Error: " + err.message });
  }
}
