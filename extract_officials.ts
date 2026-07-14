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
  const imagePath = path.join(process.cwd(), "Screenshot_٢٠٢٦٠٧٠٧-٢٠٥٩٤٥_Phone.jpg");
  if (!fs.existsSync(imagePath)) {
    console.error("Image file not found at:", imagePath);
    process.exit(1);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Data = imageBuffer.toString("base64");

  const prompt = `
    This is a screenshot. Please perform accurate Arabic OCR and extract all text or tabular information contained in it.
    If it's a list of officials or sub-districts (عزل) or delegates, please extract all of them in detail.
  `;

  console.log("Calling Gemini API to extract text from Screenshot_٢٠٢٦٠٧٠٧-٢٠٥٩٤٥_Phone.jpg...");

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

    console.log("Extraction successful!");
    console.log("Response text:");
    console.log(response.text);
  } catch (error) {
    console.error("Error during extraction:", error);
    process.exit(1);
  }
}

extract();
