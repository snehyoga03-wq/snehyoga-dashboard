import React from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { MapPin, Navigation, HelpCircle, UploadCloud } from 'lucide-react';
import { Input } from '@/components/ui/input';

const InputNode = ({ id, data, isConnectable }: any) => {
  const { updateNodeData } = useReactFlow();
  const subtype = data.subtype || 'ask-question';

  const renderHeaderIcon = () => {
    switch (subtype) {
      case 'ask-address': return <MapPin className="w-3.5 h-3.5 text-pink-600" />;
      case 'ask-location': return <Navigation className="w-3.5 h-3.5 text-pink-600" />;
      case 'ask-question': return <HelpCircle className="w-3.5 h-3.5 text-pink-600" />;
      case 'ask-media': return <UploadCloud className="w-3.5 h-3.5 text-pink-600" />;
      default: return <HelpCircle className="w-3.5 h-3.5 text-pink-600" />;
    }
  };

  const renderHeaderTitle = () => {
    switch (subtype) {
      case 'ask-address': return 'Ask Address';
      case 'ask-location': return 'Ask Location';
      case 'ask-question': return 'Ask Question';
      case 'ask-media': return 'Ask Media';
      default: return 'User Input';
    }
  };

  const renderContent = () => (
    <div className="flex flex-col gap-3">
      <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:border-pink-500 focus-within:ring-1 focus-within:ring-pink-500 transition-all bg-gray-50">
        <textarea 
          value={data.questionText || ''}
          onChange={(e) => updateNodeData(id, { questionText: e.target.value })}
          className="w-full text-xs p-2 min-h-[60px] bg-transparent resize-none focus:outline-none text-gray-700"
          placeholder={
            subtype === 'ask-location' ? "Please share your location using the attachment pin..." : 
            subtype === 'ask-address' ? "Please type out your full delivery address..." :
            subtype === 'ask-media' ? "Please upload an image or document..." :
            "What is your name?"
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Save Response To Attribute</label>
        <Input 
          value={data.saveToVariable || ''}
          onChange={(e) => updateNodeData(id, { saveToVariable: e.target.value })}
          placeholder="e.g. user_address" 
          className="h-7 text-xs bg-gray-50 border-gray-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Validation / Fallback Message</label>
        <Input 
          value={data.fallbackMessage || ''}
          onChange={(e) => updateNodeData(id, { fallbackMessage: e.target.value })}
          placeholder="Invalid input, please try again." 
          className="h-7 text-[10px] bg-gray-50 border-gray-200"
        />
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-[260px] overflow-visible">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-4 h-4 bg-white border-[3px] border-gray-300 -ml-2" />
      
      <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-100 rounded-t-xl">
        {renderHeaderIcon()}
        <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">{renderHeaderTitle()}</span>
      </div>
      
      <div className="p-3 bg-white flex flex-col gap-3">
        {renderContent()}
      </div>
      
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-4 h-4 bg-white border-[3px] border-pink-500 -mr-2" />
    </div>
  );
};

export default InputNode;
