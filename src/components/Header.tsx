import React from 'react';
import siteLogo from '../assets/images/my-logo.png'; // <-- IMPORTANT: Update this path to your logo
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Download, Trash2, X, Zap } from 'lucide-react';

// Define the props the Header will accept
interface HeaderProps {
  tokenCount: { in: number; out: number };
  exportChatLog: () => void;
  clearConversation: () => void;
  closeChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ tokenCount, exportChatLog, clearConversation, closeChat }) => {
  return (
    <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3">
            <img src={siteLogo.src} alt="AI Assistant Logo" className="w-10 h-10 rounded-full" />
            <div>
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <div className="flex items-center gap-2 text-sm text-green-500">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex w-full h-full bg-green-400 rounded-full opacity-75 animate-ping"></span>
                        <span className="relative inline-flex w-2 h-2 bg-green-500 rounded-full"></span>
                    </span>
                    Online
                </div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 px-3 py-1 text-sm font-medium bg-muted rounded-full">
                            <Zap className="w-4 h-4 text-muted-foreground" />
                            <span>{tokenCount.in + tokenCount.out}</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tokenCount.in} (in) + {tokenCount.out} (out) Tokens</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Button variant="ghost" size="icon" onClick={exportChatLog} className="text-muted-foreground hover:text-foreground"><Download className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" onClick={clearConversation} className="text-muted-foreground hover:text-foreground"><Trash2 className="w-5 h-5" /></Button>
            <Button variant="ghost" size="icon" onClick={closeChat} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></Button>
        </div>
    </header>
  );
};

export default Header;