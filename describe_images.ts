import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function describe() {
  const images = [
    { name: "6037634802044833187.png", path: "6037634802044833187.png", mime: "image/png" },
    { name: "Screenshot_٢٠٢٦٠٧٠٧-٢٠٥٩٤٥_Phone.jpg", path: "Screenshot_٢٠٢٦٠٧٠٧-٢٠٥٩٤٥_Phone.jpg", mime: "image/jpeg" },
    { name: "src/assets/images/6037634802044833187.jpg", path: "src/assets/images/6037634802044833187.jpg", mime: "image/jpeg" },
    { name: "src/assets/images/mobilization_logo.jpg", path: "src/assets/images/mobilization_logo.jpg", mime: "image/jpeg" },
  ];

  for (const img of images) {
    if (!fs.existsSync(img.path)) {
      console.log(`${img.name} does not exist`);
      continue;
    }
    const buffer = fs.readFileSync(img.path);
    const base64 = buffer.toString("base64");
    
    try {
      const resp = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { inlineData: { mimeType: img.mime, data: base64 } },
          { text: `Describe this image briefly (1-2 sentences) and tell me if it contains any text or table list of people.` }
        ]
      });
      console.log(`--- ${img.name} ---`);
      console.log(resp.text);
    } catch (e) {
      console.error(`Error describing ${img.name}:`, e);
    }
  }
}

describe();
