/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Send, 
  Image as ImageIcon, 
  X, 
  Loader2, 
  User, 
  Bot,
  Info,
  Mic,
  Volume2,
  Download,
  Languages,
  ChevronDown,
  FileText,
  FileJson,
  File as FileIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { jsPDF } from 'jspdf';
import { ChatMessage, MessagePart } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LANGUAGES = [
  { label: 'English', value: 'English' },
  { label: 'Spanish', value: 'Spanish' },
  { label: 'French', value: 'French' },
  { label: 'German', value: 'German' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'Chinese', value: 'Chinese' },
  { label: 'Japanese', value: 'Japanese' },
  { label: 'Arabic', value: 'Arabic' },
];

const DOWNLOAD_FORMATS = [
  { label: 'Text (.txt)', value: 'txt', icon: FileText },
  { label: 'JSON (.json)', value: 'json', icon: FileJson },
  { label: 'PDF (.pdf)', value: 'pdf', icon: FileIcon },
];

const SYSTEM_INSTRUCTION = `You are VisionTalk, an AI-powered conversational assistant designed for visually impaired users. 
Your task is to receive images uploaded by the user, analyze the content, and provide detailed, meaningful descriptions. 
Engage in a conversation about the image in a natural, human-like manner, answering questions, providing context, and giving insights about objects, scenes, text, colors, emotions, or activities present in the image. 
Make your responses clear, concise, and accessible, focusing on providing maximum helpful information for visually impaired users.
Always start with a general overview of the image if it's the first time you see it.
Be descriptive but avoid being overly verbose unless asked.
Focus on spatial relationships (e.g., "to the left of the tree is a bench").`;

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAnalyzing]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const [mimeType, data] = base64.split(';base64,');
      setSelectedImage({
        data: data,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() && !selectedImage) return;

    const userParts: MessagePart[] = [];
    if (selectedImage) {
      userParts.push({ image: selectedImage });
    }
    if (inputText.trim()) {
      userParts.push({ text: inputText.trim() });
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      parts: userParts,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText('');
    setSelectedImage(null);
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          systemInstruction: SYSTEM_INSTRUCTION,
          language: selectedLanguage
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze image.");
      }

      const data = await response.json();
      const responseText = data.text;
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        parts: [{ text: responseText }],
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadConversation = (format: string) => {
    if (messages.length === 0) return;

    const fileName = `VisionTalk_Chat_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'json') {
      const dataStr = JSON.stringify(messages, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.json`;
      link.click();
    } else if (format === 'txt') {
      let text = `VisionTalk Conversation - ${new Date().toLocaleString()}\n\n`;
      messages.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'VisionTalk';
        text += `[${new Date(msg.timestamp).toLocaleTimeString()}] ${role}:\n`;
        msg.parts.forEach(part => {
          if (part.text) text += `${part.text}\n`;
          if (part.image) text += `[Image Uploaded]\n`;
        });
        text += `\n---\n\n`;
      });
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.txt`;
      link.click();
    } else if (format === 'pdf') {
      const doc = new jsPDF();
      let y = 20;
      doc.setFontSize(16);
      doc.text("VisionTalk Conversation", 20, y);
      y += 10;
      doc.setFontSize(10);
      doc.text(`Date: ${new Date().toLocaleString()}`, 20, y);
      y += 15;

      messages.forEach(msg => {
        const role = msg.role === 'user' ? 'User' : 'VisionTalk';
        doc.setFont("helvetica", "bold");
        doc.text(`${role}:`, 20, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        
        msg.parts.forEach(part => {
          if (part.text) {
            const splitText = doc.splitTextToSize(part.text, 170);
            doc.text(splitText, 20, y);
            y += (splitText.length * 5) + 5;
          }
          if (part.image) {
            doc.text("[Image Uploaded]", 20, y);
            y += 10;
          }
          
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
        });
        y += 5;
      });
      doc.save(`${fileName}.pdf`);
    }
    setShowDownloadMenu(false);
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white shadow-2xl overflow-hidden">
      {/* Header */}
      <header className="bg-zinc-900 text-white p-4 flex items-center justify-between shrink-0 relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">VisionTalk</h1>
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">AI Visual Assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="relative" ref={langMenuRef}>
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-colors"
              aria-label="Select language"
            >
              <Languages className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">{selectedLanguage}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", showLangMenu && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {showLangMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-40 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden"
                >
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => {
                        setSelectedLanguage(lang.value);
                        setShowLangMenu(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs hover:bg-zinc-700 transition-colors",
                        selectedLanguage === lang.value ? "text-emerald-400 bg-zinc-700/50" : "text-zinc-300"
                      )}
                    >
                      {lang.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Download Button */}
          <div className="relative" ref={downloadMenuRef}>
            <button 
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              disabled={messages.length === 0}
              className={cn(
                "p-2 rounded-lg transition-colors",
                messages.length === 0 ? "text-zinc-600 cursor-not-allowed" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
              )}
              title="Download conversation"
              aria-label="Download conversation"
            >
              <Download className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {showDownloadMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden"
                >
                  <div className="px-4 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-700">
                    Export Format
                  </div>
                  {DOWNLOAD_FORMATS.map((format) => (
                    <button
                      key={format.value}
                      onClick={() => downloadConversation(format.value)}
                      className="w-full text-left px-4 py-3 text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-3 transition-colors"
                    >
                      <format.icon className="w-4 h-4 text-emerald-400" />
                      {format.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setMessages([])}
            className="p-2 text-zinc-300 hover:bg-zinc-800 hover:text-white rounded-lg transition-colors"
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 bg-zinc-50 scroll-smooth"
      >
        {messages.length === 0 && !isAnalyzing && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Camera className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-800">Welcome to VisionTalk</h2>
            <p className="text-zinc-600 max-w-md">
              Upload an image of your surroundings, a document, or any object. 
              I'll provide a detailed description and answer your questions.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md pt-4">
              <div className="p-3 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-500 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>"Describe this park for me."</span>
              </div>
              <div className="p-3 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-500 flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>"What does this sign say?"</span>
              </div>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                message.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                message.role === 'user' ? "bg-zinc-200" : "bg-emerald-500"
              )}>
                {message.role === 'user' ? <User className="w-5 h-5 text-zinc-600" /> : <Bot className="w-5 h-5 text-white" />}
              </div>
              
              <div className={cn(
                "max-w-[85%] space-y-2",
                message.role === 'user' ? "items-end" : "items-start"
              )}>
                {message.parts.map((part, idx) => (
                  <div key={idx} className="space-y-2">
                    {part.image && (
                      <div className="relative group">
                        <img 
                          src={`data:${part.image.mimeType};base64,${part.image.data}`} 
                          alt="User uploaded content" 
                          className="rounded-2xl max-h-64 object-cover border-4 border-white shadow-md"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    {part.text && (
                      <div className={cn(
                        "p-4 rounded-2xl shadow-sm",
                        message.role === 'user' 
                          ? "bg-zinc-900 text-white rounded-tr-none" 
                          : "bg-white border border-zinc-200 text-zinc-800 rounded-tl-none"
                      )}>
                        <div className="markdown-body">
                          <ReactMarkdown>{part.text}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <span className="text-[10px] text-zinc-400 px-2">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-zinc-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
              <span className="text-sm text-zinc-500 font-medium">Analyzing image...</span>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm text-center">
            {error}
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-zinc-100 shrink-0">
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 relative inline-block"
          >
            <img 
              src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
              alt="Preview" 
              className="w-24 h-24 object-cover rounded-xl border-2 border-emerald-500"
            />
            <button 
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={selectedImage ? "Ask about this image..." : "Type a message or upload an image..."}
              className="w-full bg-zinc-100 border-none rounded-2xl py-3 pl-4 pr-12 focus:ring-2 focus:ring-emerald-500 resize-none min-h-[56px] max-h-32 text-zinc-800 placeholder:text-zinc-400"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                aria-label="Upload image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={(!inputText.trim() && !selectedImage) || isAnalyzing}
            className={cn(
              "p-4 rounded-2xl transition-all shadow-md flex items-center justify-center",
              (!inputText.trim() && !selectedImage) || isAnalyzing
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
                : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
            )}
            aria-label="Send message"
          >
            {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
          </button>
        </form>
        
        <div className="mt-3 flex items-center justify-center gap-6 text-zinc-400">
          <button className="flex items-center gap-1.5 text-xs font-medium hover:text-zinc-600 transition-colors">
            <Mic className="w-3.5 h-3.5" />
            Voice Input
          </button>
          <div className="w-px h-3 bg-zinc-200" />
          <button className="flex items-center gap-1.5 text-xs font-medium hover:text-zinc-600 transition-colors">
            <Volume2 className="w-3.5 h-3.5" />
            Screen Reader Friendly
          </button>
        </div>
      </footer>
    </div>
  );
}
