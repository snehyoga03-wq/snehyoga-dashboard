import React, { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Connection,
  Edge,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import FlowSidebar from './FlowSidebar';
import FlowSimulatorDrawer from './FlowSimulatorDrawer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit2, Sparkles, Clock, Save, Loader2, Play, Radio, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

import TriggerNode from './nodes/TriggerNode';
import MessageNode from './nodes/MessageNode';
import ActionNode from './nodes/ActionNode';
import ConditionNode from './nodes/ConditionNode';
import InputNode from './nodes/InputNode';

const nodeTypes: NodeTypes = {
  triggerNode: TriggerNode,
  messageNode: MessageNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  inputNode: InputNode,
};

const WhatsAppFlowBuilderContent = ({ flow, onBack }: { flow: any, onBack: () => void }) => {
  const { toast } = useToast();
  const reactFlowWrapper = useRef(null);
  
  // Parse nodes and edges from flow, or fallback to default starter flow
  const initialNodes = flow?.nodes && Array.isArray(flow.nodes) && flow.nodes.length > 0 
    ? flow.nodes 
    : [
        {
          id: '1',
          type: 'triggerNode',
          data: { label: 'Flow Start', keywords: ['hi', 'hello', 'yoga'] },
          position: { x: 100, y: 150 },
        },
        {
          id: '2',
          type: 'messageNode',
          data: { 
            subtype: 'template', 
            templateName: 'sneha_yoga_welcome_greeting',
            aiKeyword: 'welcome' 
          },
          position: { x: 450, y: 100 },
        }
      ];

  const initialEdges = flow?.edges && Array.isArray(flow.edges) && flow.edges.length > 0
    ? flow.edges 
    : [
        { id: 'e1-2', source: '1', target: '2', animated: true }
      ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [flowName, setFlowName] = useState(flow?.name || 'New Flow');
  const [isLive, setIsLive] = useState<boolean>(flow?.status ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Connection handler preserving sourceHandle (for per-button output ports)
  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2, stroke: '#10b981' } }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const subtype = event.dataTransfer.getData('application/subtype');
      if (typeof type === 'undefined' || !type) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: uuidv4(),
        type,
        position,
        data: { label: `${type} node`, subtype },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const handleSaveFlow = async () => {
    if (!flow?.id) {
      toast({ title: 'Flow ID missing', description: 'Please save from the manager list first.', variant: 'destructive' });
      return;
    }
    
    setIsSaving(true);
    try {
      const currentNodes = reactFlowInstance ? reactFlowInstance.getNodes() : nodes;
      const currentEdges = reactFlowInstance ? reactFlowInstance.getEdges() : edges;

      const { error } = await supabase
        .from('whatsapp_flows')
        .update({
          name: flowName,
          status: isLive,
          nodes: currentNodes,
          edges: currentEdges,
          updated_at: new Date().toISOString()
        })
        .eq('id', flow.id);

      if (error) throw error;
      
      toast({ 
        title: isLive ? '🎉 Flow Saved & Published LIVE!' : 'Flow Saved as Draft', 
        description: isLive ? 'This flow is active for incoming WhatsApp messages.' : 'Flow saved.' 
      });
    } catch (error: any) {
      toast({ title: 'Error saving flow', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-white flex-col z-[50]">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-10">
        {/* Left section: Back & Name */}
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800 transition-colors bg-gray-100 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <input 
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-lg font-bold text-gray-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1"
            />
            <button className="text-gray-400 hover:text-gray-600 bg-gray-50 border border-gray-200 p-1.5 rounded-md transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Center section: Live Status & Simulator */}
        <div className="flex items-center gap-4">
          {/* Make Live Switch Badge */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
            <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs font-bold text-emerald-900">
              {isLive ? 'LIVE' : 'DRAFT'}
            </span>
            <button 
              onClick={() => setIsLive(!isLive)}
              className={`w-9 h-5 rounded-full flex items-center p-0.5 transition-colors cursor-pointer ml-1 ${isLive ? 'bg-emerald-600' : 'bg-gray-300'}`}
              title={isLive ? "Click to set Draft" : "Click to Make Flow Live"}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${isLive ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Test Flow Simulator Launcher Button */}
          <Button 
            onClick={() => setIsSimulatorOpen(true)}
            className="bg-emerald-900 hover:bg-emerald-950 text-white rounded-lg px-4 h-9 shadow-sm flex items-center gap-2 text-xs font-bold"
          >
            <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
            ⚡ Test Flow Live
          </Button>
        </div>

        {/* Right section: Save Flow */}
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleSaveFlow} 
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 shadow-md font-bold text-xs"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save & Publish
          </Button>
        </div>
      </div>
      
      {/* Sub Header Tabs */}
      <div className="flex items-center px-6 border-b border-gray-100 bg-white shadow-sm z-10">
        {['FLOW BUILDER', 'TEMPLATES & BUTTONS', 'KEYWORD TRIGGERS', 'LIVE ANALYTICS'].map((tab, idx) => (
          <button key={tab} className={`py-3 px-5 text-[11px] font-bold tracking-wider ${idx === 0 ? 'text-emerald-800 border-b-2 border-emerald-600' : 'text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>
      
      {/* Canvas & Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <FlowSidebar />
        
        {/* React Flow Canvas */}
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            className="bg-slate-50/50"
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.2}
            maxZoom={4}
          >
            <Controls className="bg-white shadow-md border border-gray-100 rounded-lg" />
            <MiniMap 
              nodeColor={(node) => {
                switch (node.type) {
                  case 'triggerNode': return '#10b981';
                  case 'messageNode': return '#059669';
                  case 'actionNode': return '#2563eb';
                  case 'conditionNode': return '#d97706';
                  case 'inputNode': return '#db2777';
                  default: return '#cbd5e1';
                }
              }}
              className="bg-white border border-gray-200 rounded-lg shadow-sm" 
            />
            <Background color="#cbd5e1" gap={24} size={1.5} />
          </ReactFlow>
        </div>

        {/* Live Test Simulator Drawer */}
        <FlowSimulatorDrawer
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          nodes={reactFlowInstance ? reactFlowInstance.getNodes() : nodes}
          edges={reactFlowInstance ? reactFlowInstance.getEdges() : edges}
          flowName={flowName}
        />
      </div>
    </div>
  );
};

export default function WhatsAppFlowBuilder({ flow, onBack }: { flow: any, onBack: () => void }) {
  return (
    <div className="h-[calc(100vh-64px)] -m-6 md:-m-8 flex flex-col overflow-hidden bg-white relative z-50">
      <ReactFlowProvider>
        <WhatsAppFlowBuilderContent flow={flow} onBack={onBack} />
      </ReactFlowProvider>
    </div>
  );
}
