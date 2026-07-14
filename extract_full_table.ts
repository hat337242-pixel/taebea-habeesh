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

async function extract() {
  const imagePath = path.join(process.cwd(), "src/assets/images/6037634802044833187.jpg");
  if (!fs.existsSync(imagePath)) {
    console.error("Image file not found at:", imagePath);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Data = imageBuffer.toString("base64");

  const prompt = `
    This image contains a table or list of officials/delegates (المسؤولين والمندوبين) in Hubaysh (حبيش).
    Please perform extremely thorough and complete Arabic OCR to extract EVERY SINGLE ROW in the list.
    Do not skip any row. Show the exact columns you see in the table, such as:
    - الاسم (Name)
    - الصفة / المسؤولية (Role/Responsibility)
    - رقم الهاتف (Phone Number)
    - العزلة / المنطقة (Zone/Area)
    
    If there are more pages, or if you see additional columns, extract them too.
    Please list the raw text of each row first, then reconstruct it as a complete list.
  `;

  console.log("Calling Gemini API to do a thorough extract of 6037634802044833187.jpg...");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data,
          },
        },
        { text: prompt },
      ],
    });

    console.log("Thorough OCR extraction completed!");
    console.log("Response text:");
    console.log(response.text);
  } catch (error) {
    console.error("Error during extraction:", error);
    process.exit(1);
  }
}

extract();
