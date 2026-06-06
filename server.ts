import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const API_KEYS: string[] = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8,
  process.env.GEMINI_API_KEY_9,
  process.env.GEMINI_API_KEY_10,
  process.env.GEMINI_API_KEY_11,
  process.env.GEMINI_API_KEY_12,
].filter(Boolean) as string[];

let currentKeyIndex = 0;

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.post("/api/chat", async (req, res) => {
    const { text, history, systemInstruction, imageBase64, mimeType } = req.body;

    // Construct contents array
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
    let lastError: any = null;
    let lastErrorMessage = "";

    while (attempt < API_KEYS.length) {
      const apiKey = API_KEYS[currentKeyIndex] || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key is missing." });
      }

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: { "User-Agent": "aistudio-build" }
          }
        });

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents,
          config
        });

        // Successful response
        return res.json({ text: response.text });
      } catch (e: any) {
        lastError = e;
        const errorMessage = e?.message?.toLowerCase() || "";
        lastErrorMessage = e?.message || "Error communicating with Gemini";
        
        console.error(`Key at index ${currentKeyIndex} failed:`, lastErrorMessage);

        // Failover if rate limited, quota exceeded, or internal server error
        if (e.status === 429 || errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("rate") || e.status >= 500) {
          console.log(`Rotating API key... (Attempt ${attempt + 1}/${API_KEYS.length})`);
          currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
          attempt++;
        } else {
          // If it's a different error (e.g. bad request, policy), do not rotate, return it
          break;
        }
      }
    }

    // If we exhausted all attempts or broke out
    if (attempt >= API_KEYS.length) {
      console.error("All API keys exhausted.");
      return res.status(500).json({ 
        error: "মাস্টার, সমস্ত API কি-এর কোটা বা রেট লিমিট শেষ হয়ে গেছে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন। (All quotas exhausted)" 
      });
    }

    return res.status(500).json({ error: lastErrorMessage });
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