import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Copy, Edit2, Trash2, AlertCircle } from 'lucide-react';
import WhatsAppFlowBuilder from './WhatsAppFlowBuilder';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export default function WhatsAppFlowManager() {
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [selectedFlow, setSelectedFlow] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('Your Flows');
  const [flows, setFlows] = useState<any[]>([]);
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
    if (!tableExists) return toast({ title: 'Database required', description: 'Please run the setup_database.sql script in your Supabase dashboard first.', variant: 'destructive' });
    try {
      const { data, error } = await supabase.from('whatsapp_flows').insert([{
        name: 'New Flow',
        created_by: 'Admin',
        nodes: [{
          id: '1',
          type: 'triggerNode',
          data: { label: 'Flow Start', keywords: [], previewText: '' },
          position: { x: 250, y: 50 },
        }],
        edges: []
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
    } catch (error: any) {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    }
  };

  if (view === 'builder') {
    return <WhatsAppFlowBuilder flow={selectedFlow} onBack={() => setView('list')} />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50/50 p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Flow Builder</h1>
      </div>

      {!tableExists && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-900">Database Setup Required</h3>
            <p className="text-sm text-red-700 mt-1">
              Please go to your Supabase Dashboard SQL Editor and run the contents of <code>setup_database.sql</code> to create the required <code>whatsapp_flows</code> table.
            </p>
          </div>
        </div>
      )}



      {/* Controls & Search */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-72 shadow-sm">
          <Input placeholder="Search by flow name" className="pl-10 bg-white border-gray-200" />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <Button onClick={handleCreateFlow} disabled={!tableExists} className="bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          Create Flow
        </Button>
      </div>

      {/* Tabs & Table */}
      <div className="bg-white rounded-xl border shadow-sm flex flex-col min-h-[400px]">

        <div className="overflow-x-auto relative min-h-[200px]">
          {loading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">Loading...</div>}
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-medium font-semibold text-gray-600">Flow Name</th>
                <th className="px-6 py-4 font-medium font-semibold text-gray-600">Created By</th>
                <th className="px-6 py-4 font-medium font-semibold text-gray-600">Status</th>
                <th className="px-6 py-4 font-medium font-semibold text-gray-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {flows.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No flows found. Create one to get started!</td>
                </tr>
              )}
              {flows.map((flow) => (
                <tr key={flow.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800">{flow.name}</td>
                  <td className="px-6 py-4 text-gray-600">{flow.created_by}</td>
                  <td className="px-6 py-4">
                    <div onClick={() => handleToggleStatus(flow)} className={`w-10 h-5 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${flow.status ? 'bg-emerald-800' : 'bg-gray-300'}`}>
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${flow.status ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </td>
                  <td className="px-6 py-4 flex justify-end gap-4 text-emerald-800">
                    <button onClick={() => handleDuplicateFlow(flow)} className="hover:text-emerald-600 transition-colors" title="Duplicate"><Copy size={16} strokeWidth={1.5} /></button>
                    <button onClick={() => handleEditFlow(flow)} className="hover:text-emerald-600 transition-colors" title="Edit"><Edit2 size={16} strokeWidth={1.5} /></button>
                    <button onClick={() => handleDeleteFlow(flow.id)} className="hover:text-emerald-600 transition-colors" title="Delete"><Trash2 size={16} strokeWidth={1.5} /></button>
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
