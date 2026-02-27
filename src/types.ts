export type MessageRole = 'user' | 'assistant';

export interface MessagePart {
  text?: string;
  image?: {
    data: string;
    mimeType: string;
  };
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  timestamp: number;
}
