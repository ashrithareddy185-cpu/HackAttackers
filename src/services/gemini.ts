import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, MessagePart } from "../types";

const GEMINI_MODEL = "gemini-3-flash-preview";

export async function analyzeImageAndChat(
  messages: ChatMessage[],
  systemInstruction: string,
  language: string = "English"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const langInstruction = `\n\nIMPORTANT: You MUST provide your response in ${language}.`;
  const fullSystemInstruction = systemInstruction + langInstruction;

  // Convert our ChatMessage format to Gemini's format
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: msg.parts.map(part => {
      if (part.image) {
        return {
          inlineData: {
            data: part.image.data,
            mimeType: part.image.mimeType
          }
        };
      }
      return { text: part.text || "" };
    })
  }));

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: contents as any,
    config: {
      systemInstruction: fullSystemInstruction,
      temperature: 0.7,
    },
  });

  return response.text || "I'm sorry, I couldn't analyze that image.";
}
