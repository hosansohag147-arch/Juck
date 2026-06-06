import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// রেলওয়ে (Railway) থেকে চাবিগুলো পড়ার সহজ ও শক্তিশালী নিয়ম
const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
const API_KEYS = rawKeys 
  ? rawKeys.split(/[\n,]+/).map(key => key.trim()).filter(key => key.length > 0) 
  : [];

// সার্ভার চালু হওয়ার সময় কয়টি চাবি পেয়েছে তা কনসোলে প্রিন্ট করবে
console.log(`[System] মোট চাবি লোড হয়েছে: ${API_KEYS.length} টি`);

let currentKeyIndex = 0;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.post("/api/chat", async (req, res) => {
    const { text, history, systemInstruction, imageBase64, mimeType } = req.body;

    // যদি রেলওয়েতে চাবিটি একদমই খুঁজে না পাওয়া যায়
    if (!API_KEYS || API_KEYS.length === 0) {
      return res.status(500).json({ 
        error: "মাস্টার, রেলওয়ে (Railway) ড্যাশবোর্ডে GEMINI_API_KEYS ভ্যারিয়েবলটি খুঁজে পাওয়া যায়নি। দয়া করে রেলওয়ের Variables ট্যাবে চাবিটি চেক করুন।" 
      });
    }

    const contents = history.map((msg: any) => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    const newParts: any[] = [];
    if (text) {
      newParts.push({ text });
    }
    if (imageBase64 && mimeType) {
      newParts.push({
        inlineData: {
          data: imageBase64,
          mimeType: mimeType
        }
      });
    }

    if (newParts.length > 0) {
      contents.push({ role: "user", parts: newParts });
    }

    const config: any = {
      safetySettings: [
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    let attempt = 0;
    let lastErrorMessage = "";

    while (attempt < API_KEYS.length) {
      const apiKey = API_KEYS[currentKeyIndex];

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: { "User-Agent": "aistudio-build" }
          }
        });

        // আপনার পছন্দের মডেলটি দিয়ে সরাসরি রান হবে
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash", 
          contents,
          config
        });

        return res.json({ text: response.text });
      } catch (e: any) {
        const errorMessage = e?.message?.toLowerCase() || "";
        lastErrorMessage = e?.message || "Error communicating with Gemini";
        
        console.error(`Key at index ${currentKeyIndex} failed:`, lastErrorMessage);

        if (e.status === 429 || errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("rate") || e.status >= 500) {
          currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
          attempt++;
        } else {
          break;
        }
      }
    }

    if (attempt >= API_KEYS.length) {
      return res.status(500).json({ 
        error: "মাস্টার, সমস্ত API কি-এর কোটা আসলেই শেষ হয়ে গেছে। (All quotas exhausted)" 
      });
    }

    return res.status(500).json({ error: lastErrorMessage });
  });

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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();