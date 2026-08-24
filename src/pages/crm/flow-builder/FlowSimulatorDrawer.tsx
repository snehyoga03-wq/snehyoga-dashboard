import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, RefreshCw, Smartphone, CheckCheck, Sparkles, User, Tag, 
  Database, Clock, ChevronRight, MessageSquare, ExternalLink 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface FlowSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: any[];
  edges: any[];
  flowName: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  template?: any;
  buttons?: any[];
  mediaUrl?: string;
  mediaType?: string;
  timestamp: string;
  nodeId?: string;
}

export default function FlowSimulatorDrawer({
  isOpen,
  onClose,
  nodes,
  edges,
  flowName,
}: FlowSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [capturedVariables, setCapturedVariables] = useState<Record<string, any>>({});
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [waitingForInputNode, setWaitingForInputNode] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset simulator
  const handleReset = () => {
    setMessages([
      {
        id: 'sys-start',
        sender: 'bot',
        text: `👋 Simulator ready for "${flowName}". Type a keyword (e.g., "hi", "yoga", "book") or click a quick keyword to start!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setCapturedVariables({});
    setActiveNodeId(null);
    setWaitingForInputNode(null);
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      handleReset();
    }
  }, [isOpen]);

  // Find next connected node from a source node and optional sourceHandle ID
  const getNextNode = (sourceNodeId: string, handleId?: string) => {
    let matchingEdge = edges.find((e) => {
      if (handleId) {
        return e.source === sourceNodeId && e.sourceHandle === handleId;
      }
      return e.source === sourceNodeId;
    });

    // Fallback if handleId was specified but no specific edge found, check default edge
    if (!matchingEdge && handleId) {
      matchingEdge = edges.find((e) => e.source === sourceNodeId);
    }

    if (!matchingEdge) return null;
    return nodes.find((n) => n.id === matchingEdge.target);
  };

  // Process and render a node
  const processNode = (node: any, userContext: Record<string, any> = capturedVariables) => {
    if (!node) return;
    setActiveNodeId(node.id);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (node.type === 'messageNode') {
      const subtype = node.data?.subtype;
      
      if (subtype === 'template') {
        const tplName = node.data?.templateName || 'Template';
        const tplVars = node.data?.variables || {};
        const tplButtons = node.data?.buttons || [];

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'bot',
            text: `[WhatsApp Template: ${tplName}]\nVars: ${JSON.stringify(tplVars)}`,
            template: node.data,
            buttons: tplButtons,
            timestamp: now,
            nodeId: node.id,
          },
        ]);
      } else {
        // Text / Media buttons / List
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'bot',
            text: node.data?.text || 'Hello from Sneha Yoga!',
            buttons: node.data?.buttons || [],
            mediaUrl: node.data?.mediaUrl,
            mediaType: node.data?.mediaType,
            timestamp: now,
            nodeId: node.id,
          },
        ]);
      }
    } else if (node.type === 'inputNode') {
      setWaitingForInputNode(node);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'bot',
          text: node.data?.questionText || 'Please reply with your details:',
          timestamp: now,
          nodeId: node.id,
        },
      ]);
    } else if (node.type === 'actionNode') {
      const subtype = node.data?.subtype;
      if (subtype === 'set-attribute') {
        const key = node.data?.attrName || 'attr';
        const val = node.data?.attrValue || 'value';
        setCapturedVariables((prev) => ({ ...prev, [key]: val }));
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'bot',
            text: `⚙️ [System Action]: Set Attribute "${key}" = "${val}"`,
            timestamp: now,
            nodeId: node.id,
          },
        ]);
      } else if (subtype === 'add-tag') {
        const tag = node.data?.tagName || 'Tag';
        setCapturedVariables((prev) => ({
          ...prev,
          tags: [...(prev.tags || []), tag],
        }));
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'bot',
            text: `🏷️ [System Action]: Added Tag "${tag}"`,
            timestamp: now,
            nodeId: node.id,
          },
        ]);
      } else if (subtype === 'delay') {
        const delayVal = node.data?.delayValue || '5';
        const delayUnit = node.data?.delayUnit || 'minutes';
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'bot',
            text: `⏳ [Delay Action]: Pausing for ${delayVal} ${delayUnit}...`,
            timestamp: now,
            nodeId: node.id,
          },
        ]);
      } else if (subtype === 'assign-agent') {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'bot',
            text: `👤 [Agent Transfer]: Assigned chat to ${node.data?.agentId || 'Support Team'}. Bot paused.`,
            timestamp: now,
            nodeId: node.id,
          },
        ]);
      }

      // Automatically advance from Action node to next node
      const nextNode = getNextNode(node.id);
      if (nextNode) {
        setTimeout(() => processNode(nextNode, userContext), 600);
      }
    } else if (node.type === 'conditionNode') {
      // Evaluate condition
      const conds = node.data?.conditions || [];
      let isTrue = true;
      if (conds.length > 0) {
        const firstCond = conds[0];
        const valInState = userContext[firstCond.variable] || '';
        if (firstCond.operator === 'equals') {
          isTrue = String(valInState).toLowerCase() === String(firstCond.value).toLowerCase();
        }
      }

      const handleId = isTrue ? 'true' : 'false';
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'bot',
          text: `🔀 [Condition Evaluated]: ${isTrue ? 'MATCHED (True)' : 'NO MATCH (False)'}`,
          timestamp: now,
          nodeId: node.id,
        },
      ]);

      const nextNode = getNextNode(node.id, handleId);
      if (nextNode) {
        setTimeout(() => processNode(nextNode, userContext), 600);
      }
    }
  };

  // Handle user typing input or sending a keyword
  const handleSendMessage = (textToSend?: string, sourceHandleId?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Push user message
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: text,
        timestamp: now,
      },
    ]);

    if (!textToSend) setInputMessage('');

    // Case 1: Bot was waiting for input in ask-question node
    if (waitingForInputNode) {
      const varName = waitingForInputNode.data?.saveToVariable || 'user_answer';
      const updatedVars = { ...capturedVariables, [varName]: text };
      setCapturedVariables(updatedVars);
      
      const currentInputNode = waitingForInputNode;
      setWaitingForInputNode(null);

      const nextNode = getNextNode(currentInputNode.id);
      if (nextNode) {
        setTimeout(() => processNode(nextNode, updatedVars), 600);
      }
      return;
    }

    // Case 2: User clicked a specific button or handle
    if (activeNodeId && sourceHandleId) {
      const nextNode = getNextNode(activeNodeId, sourceHandleId);
      if (nextNode) {
        setTimeout(() => processNode(nextNode), 600);
        return;
      }
    }

    // Case 3: Start from Trigger node matching keyword or default start
    const triggerNode = nodes.find((n) => n.type === 'triggerNode');
    if (triggerNode) {
      const nextNode = getNextNode(triggerNode.id);
      if (nextNode) {
        setTimeout(() => processNode(nextNode), 600);
        return;
      }
    }

    // Fallback if no edge matches
    const firstMsgNode = nodes.find((n) => n.type === 'messageNode');
    if (firstMsgNode) {
      setTimeout(() => processNode(firstMsgNode), 600);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl border-l border-gray-200 z-[100] flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      {/* Drawer Header */}
      <div className="bg-emerald-900 text-white px-5 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-700/80 flex items-center justify-center border border-emerald-500">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight flex items-center gap-2">
              WhatsApp Live Simulator
              <span className="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider">
                LIVE
              </span>
            </h3>
            <p className="text-xs text-emerald-200 truncate max-w-[220px]">{flowName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-lg transition-colors"
            title="Reset Simulation"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Simulator Body */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative overflow-hidden">
        {/* WhatsApp Background Chat Pattern Overlay */}
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        {/* Captured Variables Panel */}
        {Object.keys(capturedVariables).length > 0 && (
          <div className="bg-emerald-950/90 text-emerald-100 p-2.5 px-4 text-xs font-mono border-b border-emerald-800 flex items-center justify-between z-10 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-300">Variables:</span>
            </div>
            <div className="flex gap-2 truncate max-w-[280px]">
              {Object.entries(capturedVariables).map(([k, v]) => (
                <span key={k} className="bg-emerald-900 px-2 py-0.5 rounded text-[10px] border border-emerald-700">
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar relative z-10">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm text-xs relative ${
                  msg.sender === 'user'
                    ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none'
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                }`}
              >
                {/* Media Image Preview */}
                {msg.mediaUrl && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-gray-200 aspect-video">
                    <img src={msg.mediaUrl} alt="Media" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Text Content */}
                <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                {/* Buttons list */}
                {msg.buttons && msg.buttons.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 border-t border-gray-100 pt-2">
                    {msg.buttons.map((btn: any, idx: number) => {
                      const handleId = btn.id ? `btn-${idx}` : `tpl-btn-${idx}`;
                      return (
                        <button
                          key={btn.id || idx}
                          onClick={() => handleSendMessage(btn.text, handleId)}
                          className="w-full py-2 px-3 text-emerald-700 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors shadow-none"
                        >
                          {btn.type === 'URL' ? (
                            <>
                              <ExternalLink className="w-3 h-3 text-emerald-600" />
                              {btn.text}
                            </>
                          ) : (
                            btn.text
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Message Footer Time */}
                <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-gray-400">
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Keyword Pills */}
        <div className="bg-white/80 p-2 border-t border-gray-200/80 flex gap-2 overflow-x-auto z-10 custom-scrollbar backdrop-blur-sm">
          {['Hi', 'Yoga Classes', 'Book Trial', 'Schedule', 'Pricing'].map((kw) => (
            <button
              key={kw}
              onClick={() => handleSendMessage(kw)}
              className="text-[10px] bg-emerald-100/70 hover:bg-emerald-200 text-emerald-800 font-bold px-2.5 py-1 rounded-full whitespace-nowrap transition-colors"
            >
              💬 {kw}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div className="bg-white p-3 border-t border-gray-200 flex items-center gap-2 z-10 shadow-lg">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              waitingForInputNode
                ? 'Type your answer here...'
                : 'Type a message or trigger keyword...'
            }
            className="flex-1 text-xs h-10 bg-gray-50 border-gray-200 rounded-xl focus-visible:ring-emerald-600"
          />
          <Button
            onClick={() => handleSendMessage()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 w-10 p-0 rounded-xl flex items-center justify-center shadow-md"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
