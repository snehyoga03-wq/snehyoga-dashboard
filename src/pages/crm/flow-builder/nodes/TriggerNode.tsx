import React, { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Play, X, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const TriggerNode = ({ id, data, isConnectable }: any) => {
  const { updateNodeData } = useReactFlow();
  const [inputValue, setInputValue] = useState('');

  const keywords = data.keywords || [];
  const matchType = data.matchType || 'exact';
  const isCaseSensitive = data.isCaseSensitive || false;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      if (!keywords.includes(inputValue.trim())) {
        updateNodeData(id, { keywords: [...keywords, inputValue.trim()] });
      }
      setInputValue('');
    }
  };

  const removeKeyword = (kw: string) => {
    updateNodeData(id, { keywords: keywords.filter((k: string) => k !== kw) });
  };

  const toggleCaseSensitive = () => {
    updateNodeData(id, { isCaseSensitive: !isCaseSensitive });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-emerald-500 w-[300px] overflow-hidden">
      {/* Header */}
      <div className="bg-emerald-50 px-3 py-2 flex items-center justify-between border-b border-emerald-100">
        <div className="flex items-center gap-2">
          <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
          <span className="text-emerald-900 font-bold text-xs uppercase tracking-wide">Flow Start</span>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 bg-white flex flex-col gap-4">
        {/* Keywords Section */}
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Type / press enter to add keyword</label>
          <div className="border border-gray-200 rounded-lg p-1.5 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all bg-gray-50">
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="hello, I want to join the group..." 
              className="border-0 bg-transparent h-7 text-xs shadow-none focus-visible:ring-0 p-1"
            />
            <div className="flex flex-wrap gap-1 mt-1 p-1">
              {keywords.map((kw: string) => (
                <span key={kw} className="bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md text-xs flex items-center gap-1 shadow-sm">
                  {kw}
                  <X className="w-3 h-3 text-gray-400 cursor-pointer hover:text-red-500" onClick={() => removeKeyword(kw)} />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Match Type */}
        <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-100">
          <div>
            <p className="text-xs font-semibold text-gray-700">Select type of match</p>
            <p className="text-[10px] text-gray-500">Enable toggle for case sensitive match</p>
          </div>
          <div 
            className={`w-8 h-4 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${isCaseSensitive ? 'bg-emerald-500' : 'bg-gray-300'}`}
            onClick={toggleCaseSensitive}
          >
            <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isCaseSensitive ? 'translate-x-4' : 'translate-x-0'}`}></div>
          </div>
        </div>

        {/* Media Upload (Visual only for now) */}
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
          <ImageIcon className="w-6 h-6 text-emerald-500 mb-2" />
          <span className="text-[10px] font-medium text-gray-500">Click to upload Media</span>
        </div>

        {/* Message Preview */}
        <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 space-y-2">
          <textarea
            value={data.previewText || 'Dear Students & Parents 👋\n\n🎉 Congratulations! Your seat is CONFIRMED for the\n\n🧠 ✨ 10X MEMORY POWER WEBINAR ✨ 🧠'}
            onChange={(e) => updateNodeData(id, { previewText: e.target.value })}
            className="w-full text-xs text-gray-700 bg-transparent resize-none focus:outline-none min-h-[100px]"
          />
          <div className="pt-2 border-t border-emerald-100">
            <Button variant="outline" className="w-full text-emerald-700 border-emerald-200 bg-white h-8 text-xs font-semibold">
              NEXT STEP
            </Button>
          </div>
        </div>

      </div>
      
      {/* Handle */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-4 h-4 bg-white border-[3px] border-emerald-500"
      />
    </div>
  );
};

export default TriggerNode;
