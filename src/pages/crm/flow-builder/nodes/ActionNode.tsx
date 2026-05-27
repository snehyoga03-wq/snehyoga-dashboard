import React from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { AlertTriangle, Waypoints, Link as LinkIcon, FileEdit, Tag, Server, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';

const ActionNode = ({ id, data, isConnectable }: any) => {
  const { updateNodeData } = useReactFlow();
  const subtype = data.subtype || 'action';

  const renderHeaderIcon = () => {
    switch (subtype) {
      case 'request-intervention': return <AlertTriangle className="w-3.5 h-3.5 text-blue-600" />;
      case 'meta-capi': return <Waypoints className="w-3.5 h-3.5 text-blue-600" />;
      case 'connect-flow': return <LinkIcon className="w-3.5 h-3.5 text-blue-600" />;
      case 'set-attribute': return <FileEdit className="w-3.5 h-3.5 text-blue-600" />;
      case 'add-tag': return <Tag className="w-3.5 h-3.5 text-blue-600" />;
      case 'api-request': return <Server className="w-3.5 h-3.5 text-blue-600" />;
      default: return <Settings className="w-3.5 h-3.5 text-blue-600" />;
    }
  };

  const renderHeaderTitle = () => {
    switch (subtype) {
      case 'request-intervention': return 'Intervention';
      case 'meta-capi': return 'Meta API';
      case 'connect-flow': return 'Connect Flow';
      case 'set-attribute': return 'Set Attribute';
      case 'add-tag': return 'Add Tag';
      case 'api-request': return 'API Request';
      default: return 'Action';
    }
  };

  const renderContent = () => {
    switch (subtype) {
      case 'request-intervention':
        return (
          <div className="bg-blue-50 border border-blue-100 rounded p-2 text-[10px] text-blue-800 leading-tight">
            When triggered, this will pause the bot and notify human agents on the live chat dashboard.
          </div>
        );
      case 'meta-capi':
        return (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Event Name</label>
              <Input 
                value={data.eventName || ''}
                onChange={(e) => updateNodeData(id, { eventName: e.target.value })}
                placeholder="e.g. Purchase" 
                className="h-7 text-xs bg-gray-50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Value</label>
              <Input 
                value={data.eventValue || ''}
                onChange={(e) => updateNodeData(id, { eventValue: e.target.value })}
                placeholder="0.00" 
                className="h-7 text-xs bg-gray-50"
              />
            </div>
          </div>
        );
      case 'connect-flow':
        return (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Select Flow to trigger</label>
            <select 
              value={data.flowId || ''}
              onChange={(e) => updateNodeData(id, { flowId: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-700 outline-none"
            >
              <option value="">-- Choose Flow --</option>
              <option value="f1">Summer Camp Flow</option>
              <option value="f2">Welcome Journey</option>
            </select>
          </div>
        );
      case 'set-attribute':
        return (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Attribute Name</label>
              <Input 
                value={data.attrName || ''}
                onChange={(e) => updateNodeData(id, { attrName: e.target.value })}
                placeholder="e.g. lead_score" 
                className="h-7 text-xs bg-gray-50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Value</label>
              <Input 
                value={data.attrValue || ''}
                onChange={(e) => updateNodeData(id, { attrValue: e.target.value })}
                placeholder="e.g. +10 or High" 
                className="h-7 text-xs bg-gray-50"
              />
            </div>
          </div>
        );
      case 'add-tag':
        return (
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Tag Name</label>
            <Input 
              value={data.tagName || ''}
              onChange={(e) => updateNodeData(id, { tagName: e.target.value })}
              placeholder="e.g. VIP Customer" 
              className="h-7 text-xs bg-gray-50"
            />
          </div>
        );
      case 'api-request':
        return (
          <div className="flex flex-col gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Method</label>
              <select 
                value={data.apiMethod || 'GET'}
                onChange={(e) => updateNodeData(id, { apiMethod: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-700 outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">URL Endpoint</label>
              <Input 
                value={data.apiUrl || ''}
                onChange={(e) => updateNodeData(id, { apiUrl: e.target.value })}
                placeholder="https://api..." 
                className="h-7 text-xs bg-gray-50"
              />
            </div>
          </div>
        );
      default:
        return <div className="text-xs text-gray-500">Custom Action</div>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-[240px] overflow-visible">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-4 h-4 bg-white border-[3px] border-gray-300 -ml-2" />
      
      <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-100 rounded-t-xl">
        {renderHeaderIcon()}
        <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">{renderHeaderTitle()}</span>
      </div>
      
      <div className="p-3 bg-white flex flex-col gap-3">
        {renderContent()}
      </div>
      
      <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="w-4 h-4 bg-white border-[3px] border-blue-500 -mr-2" />
    </div>
  );
};

export default ActionNode;
