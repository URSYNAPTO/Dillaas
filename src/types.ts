export interface User {
  id: string;
  email: string;
  name: string;
  joinDate: string;
  lastActive: string;
  toolsUsed: number;
  favorites: string[];
  isAdmin?: boolean;
}

export interface UsageLog {
  id: string;
  userId: string | 'anonymous';
  toolId: string;
  timestamp: string;
  country: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  prompt: string;
}

export interface ToolUsage {
  toolId: string;
  prompt: string;
  response: string;
  timestamp: string;
}
