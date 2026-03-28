import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    // There isn't a direct listModels method on the client instance in this SDK version easily accessible without looking at docs, 
    // but we can try to run a simple prompt on a few models to see which one works.
    
    const modelsToTry = ["gemini-2.0-flash-lite", "gemini-flash-latest"];
    
    for (const modelName of modelsToTry) {
      console.log(`Trying model: ${modelName}`);
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello");
        console.log(`✅ Model ${modelName} works!`);
        return; // Found a working one
      } catch (error) {
        console.log(`❌ Model ${modelName} failed: ${error.message}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
