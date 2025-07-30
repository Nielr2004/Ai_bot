import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Gemini safety settings
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Helper function to introduce a delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const message = formData.get('message') as string;
        const history = JSON.parse(formData.get('history') as string);
        const file = formData.get('file') as File | null;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });
        const chat = model.startChat({ history });

        const promptParts: (string | { inlineData: { mimeType: string; data: string; } })[] = [];

        if (file) {
            const buffer = await file.arrayBuffer();
            if (file.type.startsWith('image/')) {
                promptParts.push({
                    inlineData: { mimeType: file.type, data: Buffer.from(buffer).toString("base64") },
                });
            } else if (file.type === 'application/pdf') {
                const data = await pdf(Buffer.from(buffer));
                promptParts.push(`\n--- PDF CONTENT ---\n${data.text}\n--- END PDF CONTENT ---\n`);
            }
        }
        
        promptParts.push(message);

        // --- Exponential Backoff Logic ---
        let result;
        const maxRetries = 3;
        let attempt = 0;
        let delay = 1000; // Start with a 1-second delay

        while (attempt < maxRetries) {
            try {
                result = await chat.sendMessageStream(promptParts);
                break; // Success, exit the loop
            } catch (error: any) {
                // Check if the error is a 503 "Service Unavailable"
                if (error.status === 503 && attempt < maxRetries - 1) {
                    console.log(`Attempt ${attempt + 1} failed: Model overloaded. Retrying in ${delay / 1000}s...`);
                    await sleep(delay);
                    delay *= 2; // Double the delay for the next attempt
                    attempt++;
                } else {
                    throw error; // Re-throw other errors or if max retries are reached
                }
            }
        }

        if (!result) {
            throw new Error("Failed to get a response from the API after multiple retries.");
        }

        // Create a new ReadableStream to send the response
        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    controller.enqueue(new TextEncoder().encode(chunkText));
                }

                const response = await result.response;
                const usageMetadata = response.usageMetadata;
                if (usageMetadata) {
                    const tokenData = {
                        input_tokens: usageMetadata.promptTokenCount,
                        output_tokens: usageMetadata.candidatesTokenCount
                    };
                    controller.enqueue(new TextEncoder().encode(`||TOKEN_DATA||${JSON.stringify(tokenData)}`));
                }
                controller.close();
            }
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error) {
        console.error("Chat API error:", error);
        return new NextResponse("An internal server error occurred.", { status: 500 });
    }
}
