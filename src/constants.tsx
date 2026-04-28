import { Tool } from "./types";

export const TOOLS: Tool[] = [
  {
    id: "life-coach",
    name: "ජීවිත මාර්ගෝපදේශක (Life Coach)",
    description: "Real, honest advice from a caring older brother (Aiya) for your life's challenges.",
    icon: "Heart",
    category: "Guidance",
    prompt: "You are a caring, honest, and practical Sri Lankan older brother (Aiya). You give direct but kind life advice. Do not use fake motivational quotes. Give real practical steps. Speak in a mix of simple Sinhala and English (Singlish style). End with exactly ONE specific action to take today. Max 300 words."
  },
  {
    id: "sinhala-writer",
    name: "Sinhala AI Writer",
    description: "Write high-quality articles, essays and poems in Sinhala.",
    icon: "PenTool",
    category: "Writing",
    prompt: "You are a creative Sinhala writer. Write a detailed response in Sinhala based on the following input. Use proper grammar and creative vocabulary."
  },
  {
    id: "english-writer",
    name: "English AI Writer",
    description: "Write blogs, emails, and reports in professional English.",
    icon: "FileText",
    category: "Writing",
    prompt: "You are a professional English writer. Write a clear, engaging, and professional response in English based on the following input."
  },
  {
    id: "translation-tool",
    name: "Sinhala ↔ English Translator",
    description: "Accurate translation between Sinhala and English languages.",
    icon: "Globe",
    category: "Language",
    prompt: "You are a professional translator. Translate the following text between Sinhala and English. If the input is in Sinhala, translate to English. If it is in English, translate to Sinhala. Provide only the translation."
  },
  {
    id: "cv-builder",
    name: "CV/Resume Builder",
    description: "Generate professional CV content based on your experience.",
    icon: "UserCircle",
    category: "Career",
    prompt: "You are a career consultant. Help the user build a professional CV. Based on the details provided, structure it into sections: Objective, Experience, Skills, and Education. Use professional language."
  },
  {
    id: "business-plan",
    name: "Business Plan Generator",
    description: "Create a detailed business plan for your startup idea.",
    icon: "Briefcase",
    category: "Business",
    prompt: "You are a business strategist. Generate a formal business plan including Executive Summary, Market Analysis, Operational Plan, and Financial Strategy based on the user's business idea."
  },
  {
    id: "social-caption",
    name: "Social Media Caption Writer",
    description: "Viral captions for Facebook, Instagram, and TikTok.",
    icon: "Share2",
    category: "Social Media",
    prompt: "You are a social media expert. Create 5 engaging captions with relevant emojis and hashtags for the following topic. Provide options for Instagram, Facebook, and TikTok."
  },
  {
    id: "grammar-checker",
    name: "Grammar Checker",
    description: "Fix grammar and spelling in your English or Sinhala text.",
    icon: "CheckSquare",
    category: "Correction",
    prompt: "You are a grammar expert. Review the following text for grammar, punctuation, and spelling errors. Provide a corrected version and a brief explanation of the changes made."
  },
  {
    id: "pdf-summarizer",
    name: "Text Summarizer",
    description: "Paste long text to get a short, key-points summary.",
    icon: "Minimize2",
    category: "Utility",
    prompt: "Summarize the following text into bullet points highlighting the most important information. Keep it concise."
  },
  {
    id: "email-writer",
    name: "Email Writer",
    description: "Draft professional emails in seconds.",
    icon: "Mail",
    category: "Writing",
    prompt: "Draft a professional email based on the following context. Include a clear subject line, formal greeting, and professional closing."
  }
];
