/**
 * API SERVICE FOR DEVIL CHATBOT
 * Coordinates Groq API completions (Text & Vision) & Pollinations AI Image Generation
 */

const DEFAULT_GROQ_KEY = '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';
const GROQ_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Retrieves the active Groq API Key (from localStorage override, or default key)
 */
export function getApiKey() {
  const override = localStorage.getItem('devil_api_key_override');
  return override ? override.trim() : DEFAULT_GROQ_KEY;
}

/**
 * Saves a key override
 */
export function saveApiKeyOverride(key) {
  if (key && key.trim().startsWith('gsk_')) {
    localStorage.setItem('devil_api_key_override', key.trim());
  } else {
    localStorage.removeItem('devil_api_key_override');
  }
}

/**
 * Checks if the API key is active
 */
export function hasValidApiKey() {
  const key = getApiKey();
  return typeof key === 'string' && key.length > 10;
}

/**
 * Sends a message stream request to Groq API
 * @param {Array} messages - Chat logs history
 * @param {Object} options - Configuration overrides (model, system prompt, stream callback)
 */
export async function streamChatCompletions(messages, options = {}) {
  const {
    model = 'llama-3.3-70b-versatile',
    systemPrompt = 'You are Devil, a helpful and professional AI assistant.',
    onChunk = () => {},
    onComplete = () => {},
    onError = () => {}
  } = options;

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('API Key is missing or invalid. Please check settings.');
    }

    // Prepend system prompt to conversation log
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const response = await fetch(GROQ_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: apiMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorMsg = errorJson?.error?.message || `HTTP error! status: ${response.status}`;
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullResponseText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Save the last incomplete line back to the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine === 'data: [DONE]') continue;

        if (cleanLine.startsWith('data: ')) {
          try {
            const rawJson = cleanLine.substring(6);
            const parsed = JSON.parse(rawJson);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) {
              fullResponseText += content;
              onChunk(content, fullResponseText);
            }
          } catch (e) {
            // Silently skip corrupted lines
          }
        }
      }
    }

    // Flush any remaining data in the buffer
    if (buffer && buffer.startsWith('data: ')) {
      try {
        const parsed = JSON.parse(buffer.substring(6));
        const content = parsed.choices[0]?.delta?.content || '';
        if (content) {
          fullResponseText += content;
          onChunk(content, fullResponseText);
        }
      } catch (e) {}
    }

    onComplete(fullResponseText);
    return fullResponseText;

  } catch (error) {
    onError(error);
    throw error;
  }
}

export async function generateImageUrl(prompt) {
  const cleanPrompt = encodeURIComponent(prompt.trim());
  const randomSeed = Math.floor(Math.random() * 9999999);
  
  // High quality parameters for Pollinations image generation
  return `https://image.pollinations.ai/prompt/${cleanPrompt}?width=1024&height=1024&nologo=true&seed=${randomSeed}&private=true&enhance=true`;
}
