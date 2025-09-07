import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

const dataUrlToBase64 = (dataUrl: string): string => {
  if (!dataUrl.includes(',')) {
    throw new Error('Invalid data URL format');
  }
  return dataUrl.substring(dataUrl.indexOf(',') + 1);
};

const handleApiResponse = (response: GenerateContentResponse): string => {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (!parts) {
        const blockReason = response?.promptFeedback?.blockReason;
        if (blockReason) {
            throw new Error(`Request was blocked by safety filters: ${blockReason}.`);
        }
      throw new Error("Invalid response structure from AI. No content parts found.");
    }
    
    let imageFound = null;
    let responseText = '';

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageFound = `data:image/png;base64,${part.inlineData.data}`;
        break; // Exit loop once image is found
      }
      if (part.text) {
          responseText += part.text;
      }
    }

    if (imageFound) {
        return imageFound;
    }

    if (responseText) {
        throw new Error(`The AI responded with text instead of an image: "${responseText}"`);
    }

    throw new Error("The AI did not return an image. Please try a different sketch or prompt.");
};

const sendRequestToGemini = async (apiKey: string, base64ImageDataUrl: string, textPrompt: string): Promise<string> => {
    if (!apiKey) {
      throw new Error("API Key is missing.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash-image-preview';
    const base64Data = dataUrlToBase64(base64ImageDataUrl);

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: model,
          contents: {
            parts: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: 'image/png',
                },
              },
              {
                text: textPrompt,
              },
            ],
          },
          config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
          },
        });

        return handleApiResponse(response);

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            // This is a common error message format for invalid keys from the SDK
            if (error.message.includes('API key not valid')) {
                throw new Error('Invalid API Key');
            }
            if (error.message.startsWith("Request was blocked") || error.message.startsWith("The AI responded with text")) {
                throw error;
            }
            throw new Error(`AI generation failed: ${error.message}`);
        }
        throw new Error("An unknown error occurred during AI generation.");
    }
}


export const transformSketch = async (
  apiKey: string,
  base64ImageDataUrl: string,
  stylePrompt: string,
): Promise<string> => {
    const textPrompt = `Transform this sketch into a finished image in the style of '${stylePrompt}'.`;
    return sendRequestToGemini(apiKey, base64ImageDataUrl, textPrompt);
};


export const editImage = async (
  apiKey: string,
  base64ImageDataUrl: string, // Image with erased parts
  editPrompt: string,
): Promise<string> => {
    const textPrompt = `Fill the erased (transparent) area naturally according to the following description: '${editPrompt}'. Keep the rest of the image as it is.`;
    return sendRequestToGemini(apiKey, base64ImageDataUrl, textPrompt);
};