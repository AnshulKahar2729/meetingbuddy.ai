import { GoogleGenerativeAI } from "@google/generative-ai";

const ai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// TODO FIX THIS FUCNITON
export async function extractActionItems(transcript: string) {
  const prompt = `Analyze the following meeting transcript and extract:
    - Action items (tasks)
    - Who is responsible for each task
    - Any mentioned deadlines

    Transcript: "${transcript}"

    Provide output as JSON.
    `;

  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent([prompt]);

  return result;
}
