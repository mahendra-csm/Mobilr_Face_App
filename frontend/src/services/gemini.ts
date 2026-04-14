import { assistantAPI } from './api';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const geminiService = {
  async chatWithAssistant(message: string, history: Message[] = []): Promise<string> {
    try {
      const response = await assistantAPI.studentChat(message, history);
      return response.data.response;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || error.message || 'Failed to get response from AI assistant');
    }
  },

  async chatWithAdminAssistant(
    message: string,
    history: Message[] = [],
    appContext?: {
      totalStudents?: number;
      todayAttendance?: number;
      statistics?: any;
      attendanceRecords?: any[];
      students?: any[];
    }
  ): Promise<string> {
    try {
      const response = await assistantAPI.adminChat(message, history, appContext);
      return response.data.response;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || error.message || 'Failed to get response from admin assistant');
    }
  },

  async helpWithCode(code: string, question: string): Promise<string> {
    const prompt = `I have the following code:\n\n\`\`\`\n${code}\n\`\`\`\n\n${question}`;
    return this.chatWithAssistant(prompt);
  },
};

export default geminiService;
