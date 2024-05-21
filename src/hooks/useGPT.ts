import { useState } from 'react';
import { OpenAI } from 'openai';
interface GPTResponse<T = string> {
  created: number;
  message: string | undefined;
  usage: OpenAI.Completions.CompletionUsage | undefined;
  parsed?: T;
}
interface GPTHook {
  systemMessage: string;
  promptGenerator: (context: any) => string;
  parsable?: boolean;
}
interface GPTHookReturn<T = string> {
  loading: boolean;
  error: string | null;
  generate: (context: string) => Promise<GPTResponse<T> | undefined>;
}
export default function useGPT<T = string>({ systemMessage, promptGenerator, parsable = false }: GPTHook): GPTHookReturn<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY, dangerouslyAllowBrowser: true });
  const generate = async (context: string): Promise<GPTResponse<T> | undefined> => {
    setLoading(true);
    setError(null);
    console.log(promptGenerator(context));
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: promptGenerator(context) },
        ],
      });
      const messageContent = response.choices[0]?.message?.content?.trim();
      const GPTResponse: GPTResponse<T> = {
        created: response.created,
        message: messageContent,
        usage: response.usage,
      };
      if (parsable && messageContent) {
        try {
          GPTResponse.parsed = JSON.parse(messageContent) as T;
          console.log(GPTResponse.parsed);
        } catch (jsonError) {
          console.error(jsonError, messageContent);
          setError('Failed to parse JSON response.');
        }
      }
      return GPTResponse;
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };
  return { loading, error, generate };
}
