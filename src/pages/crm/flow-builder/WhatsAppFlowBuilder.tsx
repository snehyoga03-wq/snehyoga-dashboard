import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit2, Sparkles, Clock, Save, Loader2 } from 'lucide-react';
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
  
  // Parse nodes and edges from flow, or fallback to empty arrays
  const initialNodes = flow?.nodes && Array.isArray(flow.nodes) && flow.nodes.length > 0 
    ? flow.nodes 
    : [{
        id: '1',
        type: 'triggerNode',
        data: { label: 'Flow Start', keywords: [] },
        position: { x: 250, y: 50 },
      }];
  const initialEdges = flow?.edges && Array.isArray(flow.edges) ? flow.edges : [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [flowName, setFlowName] = useState(flow?.name || 'New Flow');
  const [isSaving, setIsSaving] = useState(false);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
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
    if (!reactFlowInstance || !flow?.id) return;
    
    setIsSaving(true);
    try {
      const currentNodes = reactFlowInstance.getNodes();
      const currentEdges = reactFlowInstance.getEdges();

      const { error } = await supabase
        .from('whatsapp_flows')
        .update({
          name: flowName,
          nodes: currentNodes,
          edges: currentEdges,
          updated_at: new Date().toISOString()
        })
        .eq('id', flow.id);

      if (error) throw error;
      
      toast({ title: 'Flow saved successfully!' });
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
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-gray-500 hover:text-gray-800 transition-colors bg-gray-100 p-2 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <input 
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-xl font-bold text-gray-800 bg-transparent border-none outline-none focus:ring-1 focus:ring-emerald-500 rounded px-1"
            />
            <button className="text-gray-400 hover:text-gray-600 bg-gray-50 border border-gray-200 p-1.5 rounded-md transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-center max-w-2xl px-8">
          <div className="relative flex-1 shadow-sm rounded-lg">
            <input 
              type="text" 
              placeholder="What should AI create? Write here!" 
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            <Sparkles className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-5 h-9 shadow-sm whitespace-nowrap" onClick={() => toast({ title: 'AI Generation coming soon!' })}>
            Generate flow with AI
          </Button>
          <Button variant="outline" className="text-gray-600 border-gray-200 h-9 bg-white shadow-sm whitespace-nowrap">
            <Clock className="w-4 h-4 mr-2" />
            Previous prompts
          </Button>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={handleSaveFlow} 
            disabled={isSaving}
            className="text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 h-9 shadow-sm"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
      
      {/* Tab Bar under Header */}
      <div className="flex items-center px-6 border-b border-gray-100 bg-white shadow-sm z-10">
        {['BUILDER', 'KNOWLEDGE BASE', 'TOOL CALLING', 'AI ORCHESTRATOR'].map((tab, idx) => (
          <button key={tab} className={`py-3.5 px-6 text-[11px] font-bold tracking-wider ${idx === 0 ? 'text-emerald-800 border-b-2 border-emerald-600' : 'text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>
      
      <div className="flex-1 flex overflow-hidden relative">
        <FlowSidebar />
        
        {/* The React Flow Canvas */}
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
            className="bg-white"
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.2}
            maxZoom={4}
          >
            <Controls className="bg-white shadow-md border border-gray-100 rounded-lg" />
            <MiniMap 
              nodeColor={(node) => {
                switch (node.type) {
                  case 'triggerNode': return '#10b981';
                  case 'messageNode': return '#3b82f6';
                  case 'actionNode': return '#8b5cf6';
                  case 'conditionNode': return '#f59e0b';
                  case 'inputNode': return '#ec4899';
                  default: return '#cbd5e1';
                }
              }}
              className="bg-white border border-gray-200 rounded-lg shadow-sm" 
            />
            <Background color="#e2e8f0" gap={20} size={1.5} />
          </ReactFlow>
        </div>
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
