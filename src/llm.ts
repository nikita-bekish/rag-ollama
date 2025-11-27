import axios from "axios";
import {
  LLM_MODEL,
  LLM_TEMPERATURE,
  LLM_TOP_P,
  OLLAMA_GENERATE_URL,
} from "./config";

export async function generateText(prompt: string): Promise<string> {
  try {
    const response = await axios.post(OLLAMA_GENERATE_URL, {
      model: LLM_MODEL,
      prompt: prompt,
      stream: false,
      temperature: LLM_TEMPERATURE,
      top_p: LLM_TOP_P,
    });

    if (!response.data || !response.data.response) {
      throw new Error("Некорректный ответ от Ollama: нет текста");
    }

    return response.data.response;
  } catch (error: any) {
    console.error("Ошибка при запросе к Ollama generate:", error?.message);
    throw error;
  }
}
