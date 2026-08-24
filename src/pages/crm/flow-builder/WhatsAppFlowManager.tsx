import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Copy, Edit2, Trash2, AlertCircle, Play, Radio, Sparkles } from 'lucide-react';
import WhatsAppFlowBuilder from './WhatsAppFlowBuilder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export default function WhatsAppFlowManager() {
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const [flows, setFlows] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableExists, setTableExists] = useState(true);
  const { toast } = useToast();

  const fetchFlows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('whatsapp_flows').select('*').order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01') {
          setTableExists(false);
        } else {
          toast({ title: 'Error fetching flows', description: error.message, variant: 'destructive' });
        }
      } else {
        setTableExists(true);
        setFlows(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'list') {
      fetchFlows();
    }
  }, [view]);

  const handleCreateFlow = async () => {
    if (!tableExists) return toast({ title: 'Database required', description: 'Please run setup_database.sql in Supabase dashboard.', variant: 'destructive' });
    try {
      const defaultNodes = [
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

      const defaultEdges = [
        { id: 'e1-2', source: '1', target: '2', animated: true }
      ];

      const { data, error } = await supabase.from('whatsapp_flows').insert([{
        name: `Yoga Campaign Flow ${flows.length + 1}`,
        created_by: 'Admin',
        status: true,
        nodes: defaultNodes,
        edges: defaultEdges
      }]).select().single();
      
      if (error) throw error;
      
      setSelectedFlow(data);
      setView('builder');
    } catch (error: any) {
      toast({ title: 'Error creating flow', description: error.message, variant: 'destructive' });
    }
  };

  const handleEditFlow = (flow: any) => {
    setSelectedFlow(flow);
    setView('builder');
  };

  const handleDeleteFlow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this flow?')) return;
    try {
      const { error } = await supabase.from('whatsapp_flows').delete().eq('id', id);
      if (error) throw error;
      setFlows(flows.filter(f => f.id !== id));
      toast({ title: 'Flow deleted' });
    } catch (error: any) {
      toast({ title: 'Error deleting flow', description: error.message, variant: 'destructive' });
    }
  };

  const handleDuplicateFlow = async (flow: any) => {
    try {
      const { data, error } = await supabase.from('whatsapp_flows').insert([{
        name: `${flow.name} (Copy)`,
        created_by: flow.created_by,
        status: flow.status,
        nodes: flow.nodes,
        edges: flow.edges
      }]).select().single();
      
      if (error) throw error;
      
      setFlows([data, ...flows]);
      toast({ title: 'Flow duplicated' });
    } catch (error: any) {
      toast({ title: 'Error duplicating flow', description: error.message, variant: 'destructive' });
    }
  };

  const handleToggleStatus = async (flow: any) => {
    try {
      const newStatus = !flow.status;
      const { error } = await supabase.from('whatsapp_flows').update({ status: newStatus }).eq('id', flow.id);
      if (error) throw error;
      setFlows(flows.map(f => f.id === flow.id ? { ...f, status: newStatus } : f));
      toast({ 
        title: newStatus ? '🟢 Flow is now LIVE on WhatsApp!' : '⚪ Flow set to Draft', 
      });
    } catch (error: any) {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    }
  };

  const filteredFlows = flows.filter(f => 
    f.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (view === 'builder') {
    return <WhatsAppFlowBuilder flow={selectedFlow} onBack={() => setView('list')} />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 p-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            WhatsApp Flow Builder
            <span className="text-xs bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              AiSensy Engine
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Build interactive WhatsApp chatbot flows, select approved templates with quick-reply buttons, and publish live.
          </p>
        </div>

        <Button onClick={handleCreateFlow} disabled={!tableExists} className="bg-emerald-800 hover:bg-emerald-900 text-white shadow-md font-bold">
          <Plus className="w-4 h-4 mr-2" />
          Create New Flow
        </Button>
      </div>

      {!tableExists && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-900">Database Setup Required</h3>
            <p className="text-sm text-red-700 mt-1">
              Please run <code>setup_database.sql</code> in your Supabase SQL Editor to create the <code>whatsapp_flows</code> table.
            </p>
          </div>
        </div>
      )}

      {/* Controls & Search */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80 shadow-sm">
          <Input 
            placeholder="Search by flow name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white border-gray-200" 
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Flows Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col min-h-[400px] overflow-hidden">
        <div className="overflow-x-auto relative min-h-[200px]">
          {loading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 text-emerald-800 font-semibold">Loading flows...</div>}
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 bg-gray-50 border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-700">Flow Name</th>
                <th className="px-6 py-4 font-bold text-gray-700">Created By</th>
                <th className="px-6 py-4 font-bold text-gray-700">Status</th>
                <th className="px-6 py-4 font-bold text-gray-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredFlows.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">
                    No flows found. Click "Create New Flow" to build your first WhatsApp flow!
                  </td>
                </tr>
              )}
              {filteredFlows.map((flow) => (
                <tr key={flow.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-800 flex items-center gap-2">
                    {flow.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{flow.created_by || 'Admin'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={() => handleToggleStatus(flow)} 
                        className={`w-10 h-5 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${flow.status ? 'bg-emerald-600' : 'bg-gray-300'}`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${flow.status ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${flow.status ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                        {flow.status ? '● LIVE' : '○ DRAFT'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 flex justify-end items-center gap-3 text-emerald-800">
                    <Button 
                      size="sm" 
                      onClick={() => handleEditFlow(flow)} 
                      className="bg-emerald-800 hover:bg-emerald-900 text-white h-8 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Play className="w-3 h-3 fill-current text-emerald-400" />
                      Build & Test
                    </Button>
                    <button onClick={() => handleDuplicateFlow(flow)} className="p-1.5 hover:bg-emerald-50 rounded-md transition-colors text-emerald-700" title="Duplicate"><Copy size={16} strokeWidth={2} /></button>
                    <button onClick={() => handleEditFlow(flow)} className="p-1.5 hover:bg-emerald-50 rounded-md transition-colors text-emerald-700" title="Edit"><Edit2 size={16} strokeWidth={2} /></button>
                    <button onClick={() => handleDeleteFlow(flow.id)} className="p-1.5 hover:bg-red-50 rounded-md transition-colors text-red-600" title="Delete"><Trash2 size={16} strokeWidth={2} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
