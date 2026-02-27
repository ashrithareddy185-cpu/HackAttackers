import express from "express";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { HfInference } from "@huggingface/inference";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size for base64 images
app.use(express.json({ limit: '50mb' }));

// Helper to get OpenAI client lazily
function getOpenAIClient() {
  const apiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey && !process.env.OLLAMA_BASE_URL) {
    return null;
  }
  return new OpenAI({
    apiKey: apiKey || "dummy-key-for-ollama", // Ollama might not need a real key
    baseURL: process.env.OLLAMA_BASE_URL || undefined,
  });
}

// Helper to get Hugging Face client lazily
function getHFClient() {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) return null;
  return new HfInference(hfKey);
}

// API route for image analysis
app.post("/api/analyze", async (req, res) => {
  try {
    const { messages, systemInstruction, language } = req.body;

    const hf = getHFClient();
    const openai = getOpenAIClient();

    if (!hf && !openai) {
      return res.status(500).json({ error: "No API keys configured. Please set HUGGINGFACE_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL." });
    }

    const langInstruction = `\n\nIMPORTANT: You MUST provide your response in ${language}.`;
    const fullSystemInstruction = systemInstruction + langInstruction;

    // --- HUGGING FACE PATH (Priority) ---
    if (hf) {
      try {
        // Find the last image and text
        let lastImage: { data: string; mimeType: string } | null = null;
        let lastText = "";

        // We'll use the most recent user message's parts
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
          lastUserMsg.parts.forEach((p: any) => {
            if (p.image) lastImage = p.image;
            if (p.text) lastText = p.text;
          });
        }

        if (!lastImage) {
          const response = await hf.chatCompletion({
            model: "meta-llama/Llama-3.2-11B-Vision-Instruct",
            messages: [
              { role: "system", content: fullSystemInstruction },
              ...messages.map((m: any) => ({ role: m.role, content: m.parts.map((p: any) => p.text || "").join(" ") }))
            ],
            max_tokens: 500,
          });
          return res.json({ text: response.choices[0].message.content });
        }

        const response = await hf.chatCompletion({
          model: "meta-llama/Llama-3.2-11B-Vision-Instruct",
          messages: [
            { role: "system", content: fullSystemInstruction },
            ...messages.map((msg: any) => {
              const content = msg.parts.map((part: any) => {
                if (part.image) {
                  return {
                    type: "image_url",
                    image_url: {
                      url: `data:${part.image.mimeType};base64,${part.image.data}`,
                    },
                  };
                }
                return { type: "text", text: part.text || "" };
              });
              return { role: msg.role, content };
            }),
          ],
          max_tokens: 1000,
        });

        return res.json({ text: response.choices[0].message.content });
      } catch (hfError: any) {
        console.error("Hugging Face Error:", hfError);
        // If HF fails and we have OpenAI, we can try falling back, 
        // but for now let's just return the error to be clear.
        return res.status(500).json({ error: `Hugging Face Error: ${hfError.message}` });
      }
    }

    // --- OPENAI / OLLAMA PATH ---
    if (openai) {
      const isOllama = !!process.env.OLLAMA_BASE_URL;
      const formattedMessages = [
        { role: "system", content: fullSystemInstruction },
        ...messages.map((msg: any) => {
          const content = msg.parts.map((part: any) => {
            if (part.image) {
              return {
                type: "image_url",
                image_url: {
                  url: `data:${part.image.mimeType};base64,${part.image.data}`,
                },
              };
            }
            return { type: "text", text: part.text || "" };
          });
          return { role: msg.role, content };
        }),
      ];

      const response = await openai.chat.completions.create({
        model: isOllama ? "llava" : "gpt-4o",
        messages: formattedMessages as any,
        max_tokens: 1000,
      });

      return res.json({ text: response.choices[0].message.content });
    }

    return res.status(500).json({ error: "No provider available to handle the request." });
  } catch (error: any) {
    console.error("General API Error:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred." });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
