"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Paperclip, Send, Image as ImageIcon, File as FileIcon, X, BotIcon, User, Download, Trash2, Pencil, Zap, Square } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import 'highlight.js/styles/github-dark.css';

// --- Type Definitions ---
interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  file?: {
    name: string;
    type: string;
    url: string;
  };
}

interface FilePreview {
  name: string;
  type: string;
  url: string;
}

// --- Main Chatbot Component ---
export default function Chatbot() {
  // --- State Management ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [tokenCount, setTokenCount] = useState({ in: 0, out: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hasMounted, setHasMounted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Effects ---
  useEffect(() => {
    setHasMounted(true);
    // Configure marked with highlight.js
    marked.setOptions({
        highlight: function(code: string, lang: string) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
    } as any); // Use 'as any' to bypass incorrect type definitions if necessary
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- API & Core Functions ---
  const streamBotResponse = async (formData: FormData) => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const botMessageId = `msg-${Date.now() + 1}`;
    setMessages(prev => [...prev, { id: botMessageId, role: 'model', content: '' }]);

    try {
        const response = await fetch('/api/chat', { method: 'POST', body: formData, signal });
        if (!response.ok || !response.body) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });

            if (buffer.includes("||TOKEN_DATA||")) {
                const parts = buffer.split("||TOKEN_DATA||");
                fullResponse += parts[0];
                const tokenData = JSON.parse(parts[1]);
                setTokenCount({ in: tokenData.input_tokens, out: tokenData.output_tokens });
                buffer = "";
            } else {
                fullResponse = buffer;
            }

            setMessages(prev => prev.map(msg => 
                msg.id === botMessageId ? { ...msg, content: fullResponse } : msg
            ));
        }
    } catch (error: any) {
        if (error.name !== 'AbortError') {
             console.error("Fetch Error:", error);
             setMessages(prev => prev.map(msg => 
                msg.id === botMessageId ? { ...msg, content: `Sorry, an error occurred: ${error.message}` } : msg
            ));
        }
    } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
    }
  };

  const handleSendMessage = () => {
    if (!input.trim() && !selectedFile) return;

    const newUserMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      file: selectedFile ? { name: selectedFile.name, type: selectedFile.type, url: URL.createObjectURL(selectedFile) } : undefined
    };

    setMessages(prev => [...prev, newUserMessage]);
    
    const formData = new FormData();
    const history = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    formData.append('message', input);
    formData.append('history', JSON.stringify(history));
    if (selectedFile) {
        formData.append('file', selectedFile);
    }

    streamBotResponse(formData);

    setInput('');
    setSelectedFile(null);
    setFilePreview(null);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview({
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file)
      });
    }
  };
  
  const handleStopGenerating = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
      }
  };

  const clearConversation = () => {
    setMessages([]);
    setTokenCount({ in: 0, out: 0 });
  };

  const startEditing = (message: Message) => {
    setEditingMessageId(message.id);
    setEditText(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const submitEdit = () => {
    if (!editingMessageId) return;
    
    const messageIndex = messages.findIndex(m => m.id === editingMessageId);
    if (messageIndex === -1) return;

    const updatedUserMessage: Message = { ...messages[messageIndex], content: editText };
    const updatedMessages = [...messages.slice(0, messageIndex), updatedUserMessage];
    setMessages(updatedMessages);
    
    // Resend the conversation from this point
    const formData = new FormData();
    const history = updatedMessages.slice(0, messageIndex).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    formData.append('message', editText);
    formData.append('history', JSON.stringify(history));
    // Note: Re-attaching the original file on edit is not implemented here for simplicity.
    
    streamBotResponse(formData);

    cancelEditing();
  };
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview({
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file)
      });
    }
  };

  if (!hasMounted) {
    return null;
  }

  return (
      <div 
          className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2]"
          onDragEnter={handleDragEnter}
      >
          <div className="relative flex flex-col w-full max-w-4xl h-[90vh] rounded-2xl bg-white/10 text-white backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
          
          {isDragging && (
              <div 
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
              >
                  <Download className="w-16 h-16 mb-4 text-white" />
                  <p className="text-xl font-semibold text-white">Drop your file here</p>
              </div>
          )}

          <header className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5 flex-shrink-0">
              <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-gradient-to-br from-pink-500 to-teal-400 text-white">
                          <BotIcon />
                      </AvatarFallback>
                  </Avatar>
                  <div>
                      <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
                      <div className="flex items-center gap-2 text-sm text-teal-300">
                          <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex w-full h-full bg-teal-400 rounded-full opacity-75 animate-ping"></span>
                              <span className="relative inline-flex w-2 h-2 bg-teal-500 rounded-full"></span>
                          </span>
                          Online
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <TooltipProvider>
                      <Tooltip>
                          <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-white/80 bg-white/10 rounded-full">
                                  <Zap className="w-4 h-4 text-white/70" />
                                  <span>{tokenCount.in + tokenCount.out}</span>
                              </div>
                          </TooltipTrigger>
                          <TooltipContent>
                              <p>{tokenCount.in} (in) + {tokenCount.out} (out) Tokens</p>
                          </TooltipContent>
                      </Tooltip>
                  </TooltipProvider>
                  <Button variant="ghost" size="icon" onClick={clearConversation} className="text-white/70 hover:text-white hover:bg-white/10">
                      <Trash2 className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                      <Download className="w-5 h-5" />
                  </Button>
              </div>
          </header>

          <ScrollArea className="flex-1 p-6">
              <div className="space-y-8">
              {messages.map((message) => (
                  <div key={message.id} className={`flex items-start gap-4 group ${message.role === 'user' ? 'justify-end' : ''}`}>
                  {message.role === 'model' && (
                      <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-gradient-to-br from-pink-500 to-teal-400 text-white"><BotIcon className="w-5 h-5"/></AvatarFallback>
                      </Avatar>
                  )}
                  <div className={`flex flex-col items-start max-w-xl ${message.role === 'user' ? 'items-end' : ''}`}>
                      <Card className={`p-4 shadow-lg ${message.role === 'user' ? 'bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white rounded-3xl rounded-br-lg' : 'bg-white text-gray-800 rounded-3xl rounded-bl-lg'}`}>
                      {message.file && (
                          <div className="mb-2">
                          {message.file.type.startsWith('image/') ? (
                              <img src={message.file.url} alt={message.file.name} className="rounded-lg max-h-48" />
                          ) : (
                              <div className="p-2 text-sm bg-black/10 text-black/70 rounded-md">{message.file.name}</div>
                          )}
                          </div>
                      )}
                      {editingMessageId === message.id ? (
                          <div className="space-y-2 w-full">
                              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="bg-white text-gray-900" />
                              <div className="flex justify-end gap-2">
                                  <Button size="sm" onClick={submitEdit}>Update</Button>
                                  <Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button>
                              </div>
                          </div>
                      ) : (
                        <div dangerouslySetInnerHTML={{ __html: marked.parse(message.content) }} />
                      )}
                      </Card>
                      {message.role === 'user' && !editingMessageId && (
                          <Button variant="ghost" size="icon" className="w-7 h-7 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEditing(message)}>
                              <Pencil className="w-4 h-4 text-white/50" />
                          </Button>
                      )}
                  </div>
                  {message.role === 'user' && (
                      <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-gradient-to-br from-teal-400 to-green-400 text-white"><User className="w-5 h-5"/></AvatarFallback>
                      </Avatar>
                  )}
                  </div>
              ))}
              <div ref={messagesEndRef} />
              </div>
          </ScrollArea>

          <div className="p-4 bg-white/5 border-t border-white/10">
              {filePreview && (
              <div className="relative p-2 mb-3 border border-white/20 rounded-lg bg-white/10">
                  <div className="flex items-center gap-3 text-sm text-white">
                  {filePreview.type.startsWith('image/') ? (
                      <img src={filePreview.url} alt={filePreview.name} className="w-12 h-12 rounded-md object-cover" />
                  ) : (
                      <FileIcon className="w-8 h-8 text-white/70" />
                  )}
                  <span className="font-medium truncate">{filePreview.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 w-7 h-7 text-white/50 hover:text-white" onClick={() => { setSelectedFile(null); setFilePreview(null); }}>
                  <X className="w-4 h-4" />
                  </Button>
              </div>
              )}
              <div className="relative flex items-center gap-2">
              <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10 rounded-full flex-shrink-0 w-12 h-12">
                      <Paperclip className="w-5 h-5" />
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white/10 backdrop-blur-lg border-white/20 text-white">
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="focus:bg-white/20">
                      <ImageIcon className="w-4 h-4 mr-2" /> Image
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="focus:bg-white/20">
                      <FileIcon className="w-4 h-4 mr-2" /> PDF
                      </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
              <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                  }
                  }}
                  placeholder="Type your message..."
                  className="w-full p-4 pr-16 text-base text-white bg-white/10 rounded-full border border-white/20 focus:ring-2 focus:ring-teal-400 focus:outline-none resize-none"
                  rows={1}
              />
              <div className="absolute flex gap-1 transform -translate-y-1/2 right-2 top-1/2">
                  <Button 
                      size="icon" 
                      onClick={isGenerating ? handleStopGenerating : handleSendMessage} 
                      disabled={!input.trim() && !selectedFile && !isGenerating}
                      className={`w-12 h-12 rounded-full text-white transition-all duration-300 ${isGenerating ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-br from-teal-400 to-green-400 hover:scale-110'}`}
                  >
                      {isGenerating ? <Square className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                  </Button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>
          </div>
          </div>
      </div>
  );
}
