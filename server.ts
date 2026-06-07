import express from "express";
import "dotenv/config"; // <--- এই লাইনটি অবশ্যই যোগ করতে হবে
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const getAPIKeys = () => {
  const keys: string[] = [];
  for (let i = 1; i <= 12; i++) {
const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) {
      keys.push(key);
    }
  }
  // Remove the check for process.env.GEMINI_API_KEY to stick strictly to the 1-12 keys rule if desired
  // Or keep it for fallback. I'll keep it as it's safe and helpful.
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
  }
  return keys;
};

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
    
    const configuredKeys = getAPIKeys();
    
    if (configuredKeys.length === 0) {
       return res.status(500).json({ error: "Gemini API Key is missing. Please configure at least one API key (e.g., GEMINI_API_KEY_1)." });
    }

    // Ensure currentKeyIndex is within bounds if keys change
    if (currentKeyIndex >= configuredKeys.length) {
      currentKeyIndex = 0;
    }

    while (attempt < configuredKeys.length) {
      const apiKey = configuredKeys[currentKeyIndex];

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
          console.log(`Rotating API key... (Attempt ${attempt + 1}/${configuredKeys.length})`);
          currentKeyIndex = (currentKeyIndex + 1) % configuredKeys.length;
          attempt++;
        } else {
          // If it's a different error (e.g. bad request, policy), do not rotate, return it
          break;
        }
      }
    }

    // If we exhausted all attempts or broke out
    if (attempt >= configuredKeys.length) {
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