"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { Paperclip, Send, Image as ImageIcon, File as FileIcon, X, BotIcon, User, Download, Trash2, Pencil, Zap, Square, FileText } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import 'highlight.js/styles/atom-one-dark.css';

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
  const [isChatOpen, setIsChatOpen] = useState(false);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Effects ---
  useEffect(() => {
    setHasMounted(true);
    marked.setOptions({
        highlight: function(code: string, lang: string) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
    } as any);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // --- Core Functions ---
  const exportChatLog = () => {
    const log = messages.map(msg => {
      let fileInfo = msg.file ? `[File: ${msg.file.name}]` : "";
      return `${msg.role === 'user' ? 'User' : 'Bot'}: ${fileInfo} ${msg.content}`.trim();
    }).join('\n\n');
    
    const blob = new Blob([log], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-log-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
        let accumulatedResponse = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            let chunk = decoder.decode(value, { stream: true });

            if (chunk.includes("||TOKEN_DATA||")) {
                const parts = chunk.split("||TOKEN_DATA||");
                accumulatedResponse += parts[0];
                const tokenData = JSON.parse(parts[1]);
                setTokenCount(prev => ({ 
                    in: prev.in + tokenData.input_tokens, 
                    out: prev.out + tokenData.output_tokens 
                }));
                setMessages(prev => prev.map(msg => 
                    msg.id === botMessageId ? { ...msg, content: accumulatedResponse } : msg
                ));
                break; 
            } else {
                accumulatedResponse += chunk;
                setMessages(prev => prev.map(msg => 
                    msg.id === botMessageId ? { ...msg, content: accumulatedResponse } : msg
                ));
            }
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
      setFilePreview({ name: file.name, type: file.type, url: URL.createObjectURL(file) });
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
    
    const formData = new FormData();
    const history = updatedMessages.slice(0, messageIndex).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));

    formData.append('message', editText);
    formData.append('history', JSON.stringify(history));
    
    streamBotResponse(formData);
    cancelEditing();
  };
  
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview({ name: file.name, type: file.type, url: URL.createObjectURL(file) });
    }
  };

  if (!hasMounted) return null;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
      {!isChatOpen ? (
        <div className="flex flex-col items-center justify-center text-center gap-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="relative">
                <div className="absolute -inset-2 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
                <BotIcon className="w-24 h-24 text-primary relative" />
            </div>
            <h1 className="text-5xl font-bold">
                <span className="italic font-medium text-muted-foreground">Let's start </span>
                <Button onClick={() => setIsChatOpen(true)} variant="link" className="text-5xl font-bold p-0 h-auto leading-none align-baseline text-primary underline-offset-8 hover:text-primary/80 transition-all hover:tracking-wider">
                    asking
                </Button>
            </h1>
        </div>
      ) : (
        <div className={`w-full max-w-4xl h-full transition-all duration-300 animate-in fade-in zoom-in-95`} onDragEnter={handleDragEnter}>
          <div className="relative flex flex-col w-full h-full rounded-2xl bg-card/80 text-foreground backdrop-blur-2xl border shadow-2xl overflow-hidden">
            {isDragging && (<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm" onDragLeave={handleDragLeave} onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}><Download className="w-16 h-16 mb-4" /><p className="text-xl font-semibold">Drop your file here</p></div>)}
            <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12"><AvatarFallback className="bg-primary text-primary-foreground"><BotIcon /></AvatarFallback></Avatar>
                    <div>
                        <h2 className="text-lg font-semibold">AI Assistant</h2>
                        <div className="flex items-center gap-2 text-sm text-green-500">
                            <span className="relative flex h-2 w-2"><span className="absolute inline-flex w-full h-full bg-green-400 rounded-full opacity-75 animate-ping"></span><span className="relative inline-flex w-2 h-2 bg-green-500 rounded-full"></span></span>
                            Online
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><div className="flex items-center gap-2 px-3 py-1 text-sm font-medium bg-muted rounded-full"><Zap className="w-4 h-4 text-muted-foreground" /><span>{tokenCount.in + tokenCount.out}</span></div></TooltipTrigger><TooltipContent><p>{tokenCount.in} (in) + {tokenCount.out} (out) Tokens</p></TooltipContent></Tooltip></TooltipProvider>
                    <Button variant="ghost" size="icon" onClick={exportChatLog} className="text-muted-foreground hover:text-foreground"><Download className="w-5 h-5" /></Button>
                    <Button variant="ghost" size="icon" onClick={clearConversation} className="text-muted-foreground hover:text-foreground"><Trash2 className="w-5 h-5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></Button>
                </div>
            </header>
            <ScrollArea className="flex-grow p-6">
                <div className="space-y-8">
                {messages.map((message) => (
                    <div key={message.id} className={`flex items-start gap-4 group ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.role === 'model' && (<Avatar className="w-9 h-9"><AvatarFallback className="bg-primary text-primary-foreground"><BotIcon className="w-5 h-5"/></AvatarFallback></Avatar>)}
                    <div className={`flex flex-col items-start max-w-xl ${message.role === 'user' ? 'items-end' : ''}`}>
                        <Card className={`p-4 shadow-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground rounded-3xl rounded-br-lg' : 'bg-card text-card-foreground rounded-3xl rounded-bl-lg'}`}>
                        {message.file && !message.content && (<div className="mb-2">{message.file.type.startsWith('image/') ? (<img src={message.file.url} alt={message.file.name} className="rounded-lg max-h-48" />) : (<div className="p-2 text-sm bg-black/10 text-black/70 rounded-md">{message.file.name}</div>)}</div>)}
                        {editingMessageId === message.id ? (
                            <div className="space-y-2 w-full">
                                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="bg-white text-gray-900" />
                                <div className="flex justify-end gap-2"><Button size="sm" onClick={submitEdit}>Update</Button><Button size="sm" variant="ghost" onClick={cancelEditing}>Cancel</Button></div>
                            </div>
                        ) : (
                            <>{message.content ? (<div className="prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(message.content) }} />) : (<div className="flex items-center gap-2"><div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div></div>)}</>
                        )}
                        </Card>
                        {message.role === 'user' && message.file && (<div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground p-2 bg-muted rounded-md">{message.file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}<span>{message.file.name}</span></div>)}
                        {message.role === 'user' && !editingMessageId && (<Button variant="ghost" size="icon" className="w-7 h-7 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEditing(message)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>)}
                    </div>
                    {message.role === 'user' && (<Avatar className="w-9 h-9"><AvatarFallback className="bg-secondary text-secondary-foreground"><User className="w-5 h-5"/></AvatarFallback></Avatar>)}
                    </div>
                ))}
                <div ref={messagesEndRef} />
                </div>
            </ScrollArea>
            <div className="p-4 bg-background/80 border-t flex-shrink-0">
                {filePreview && (<div className="relative p-2 mb-3 border rounded-lg bg-muted"><div className="flex items-center gap-3 text-sm">{filePreview.type.startsWith('image/') ? (<img src={filePreview.url} alt={filePreview.name} className="w-12 h-12 rounded-md object-cover" />) : (<FileIcon className="w-8 h-8 text-muted-foreground" />)}<span className="font-medium truncate">{filePreview.name}</span></div><Button variant="ghost" size="icon" className="absolute top-1 right-1 w-7 h-7 text-muted-foreground hover:text-foreground" onClick={() => { setSelectedFile(null); setFilePreview(null); }}><X className="w-4 h-4" /></Button></div>)}
                <div className="relative flex items-center gap-2">
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground rounded-full flex-shrink-0 w-12 h-12"><Paperclip className="w-5 h-5" /></Button></DropdownMenuTrigger><DropdownMenuContent className="bg-popover border text-popover-foreground"><DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="focus:bg-accent"><ImageIcon className="w-4 h-4 mr-2" /> Image</DropdownMenuItem><DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="focus:bg-accent"><FileIcon className="w-4 h-4 mr-2" /> PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}} placeholder="Type your message..." className="w-full p-4 pr-16 text-base bg-muted rounded-full border focus:ring-2 focus:ring-ring focus:outline-none resize-none shadow-inner" rows={1}/>
                <div className="absolute flex gap-1 transform -translate-y-1/2 right-2 top-1/2">
                    <Button size="icon" onClick={isGenerating ? handleStopGenerating : handleSendMessage} disabled={!input.trim() && !selectedFile && !isGenerating} className={`w-12 h-12 rounded-full text-white transition-all duration-300 ${isGenerating ? 'bg-red-500 hover:bg-red-600' : 'bg-primary text-primary-foreground hover:scale-110'}`}>{isGenerating ? <Square className="w-5 h-5" /> : <Send className="w-5 h-5" />}</Button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf"/>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}