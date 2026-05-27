import React from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { SplitSquareHorizontal, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

const ConditionNode = ({ id, data, isConnectable }: any) => {
  const { updateNodeData } = useReactFlow();

  const renderConditions = () => (
    <div className="flex flex-col gap-2">
      {data.conditions?.map((cond: any, idx: number) => (
        <div key={idx} className="border border-gray-200 rounded p-2 bg-gray-50 flex flex-col gap-1 relative">
          <button onClick={() => {
            const newConds = data.conditions.filter((_: any, i: number) => i !== idx);
            updateNodeData(id, { conditions: newConds });
          }} className="absolute top-1 right-1 text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
          
          <span className="text-[9px] font-bold text-gray-500 uppercase">Variable</span>
          <Input 
            value={cond.variable || ''}
            onChange={(e) => {
              const newConds = [...data.conditions];
              newConds[idx].variable = e.target.value;
              updateNodeData(id, { conditions: newConds });
            }}
            placeholder="{{variable_name}}" className="h-6 text-[10px]" 
          />
          
          <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">Operator</span>
          <select 
            value={cond.operator || 'equals'}
            onChange={(e) => {
              const newConds = [...data.conditions];
              newConds[idx].operator = e.target.value;
              updateNodeData(id, { conditions: newConds });
            }}
            className="w-full border border-gray-200 rounded px-2 py-1 bg-white text-[10px] text-gray-700 outline-none"
          >
            <option value="equals">Equals To</option>
            <option value="contains">Contains</option>
            <option value="starts_with">Starts With</option>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
          </select>

          <span className="text-[9px] font-bold text-gray-500 uppercase mt-1">Value</span>
          <Input 
            value={cond.value || ''}
            onChange={(e) => {
              const newConds = [...data.conditions];
              newConds[idx].value = e.target.value;
              updateNodeData(id, { conditions: newConds });
            }}
            placeholder="Value" className="h-6 text-[10px]" 
          />
        </div>
      ))}
      <button 
        onClick={() => {
          const currentConds = data.conditions || [];
          updateNodeData(id, { conditions: [...currentConds, { variable: '', operator: 'equals', value: '' }] });
        }}
        className="text-[10px] text-orange-600 font-semibold mt-1 text-left flex items-center gap-1 hover:underline">
        <Plus className="w-3 h-3" /> Add Condition
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-[240px] overflow-visible">
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="w-4 h-4 bg-white border-[3px] border-gray-300 -ml-2" />
      
      <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-100 rounded-t-xl">
        <SplitSquareHorizontal className="w-3.5 h-3.5 text-orange-500" />
        <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">Condition (If/Else)</span>
      </div>
      
      <div className="p-3 bg-white flex flex-col gap-3 relative">
        <div className="text-[10px] text-gray-500 mb-1 leading-tight">Branch the flow if conditions are met.</div>
        {renderConditions()}
        
        <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-3 relative z-10">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 relative">
            True / Match
            <Handle type="source" id="true" position={Position.Right} className="w-3 h-3 bg-white border-2 border-green-500 !-mr-4 !relative !top-0 !transform-none" />
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 relative">
            False / No Match
            <Handle type="source" id="false" position={Position.Right} className="w-3 h-3 bg-white border-2 border-red-500 !-mr-4 !relative !top-0 !transform-none" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionNode;
