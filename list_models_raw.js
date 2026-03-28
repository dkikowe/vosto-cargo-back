import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  try {
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
    console.log("Available models:");
    response.data.models.forEach(model => {
      console.log(`- ${model.name} (${model.supportedGenerationMethods.join(', ')})`);
    });
  } catch (error) {
    console.error("Error listing models:", error.response ? error.response.data : error.message);
  }
}

listModels();
