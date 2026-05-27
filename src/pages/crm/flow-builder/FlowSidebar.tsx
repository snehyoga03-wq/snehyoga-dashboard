import React from 'react';
import { Type, Image as ImageIcon, List as ListIcon, ShoppingBag, Package, FileText, ChevronRight, AlertTriangle, Link as LinkIcon, SplitSquareHorizontal, Waypoints, MapPin, Navigation, HelpCircle, UploadCloud, FileEdit, Tag, Server } from 'lucide-react';

const FlowSidebar = () => {
  const onDragStart = (event: React.DragEvent, nodeType: string, subtype?: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (subtype) {
      event.dataTransfer.setData('application/subtype', subtype);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const DraggableItem = ({ icon: Icon, label, type, subtype, colorClass }: any) => (
    <div
      className="flex flex-col items-center justify-center p-3 bg-white border border-gray-100 rounded-xl cursor-grab hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50/30 transition-all group aspect-square text-center gap-2"
      onDragStart={(event) => onDragStart(event, type, subtype)}
      draggable
    >
      <Icon className={`w-6 h-6 ${colorClass} group-hover:scale-110 transition-transform`} strokeWidth={1.5} />
      <span className="text-[10px] font-semibold text-gray-600 leading-tight group-hover:text-emerald-800">{label}</span>
    </div>
  );

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col h-full shadow-[4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10 relative overflow-hidden">
      <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar">
        
        {/* Messages */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors">
            <h4 className="text-sm font-bold text-gray-800">Message types</h4>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <DraggableItem icon={Type} label="Text Buttons" type="messageNode" subtype="text-buttons" colorClass="text-emerald-600" />
            <DraggableItem icon={ImageIcon} label="Media Buttons" type="messageNode" subtype="media-buttons" colorClass="text-emerald-600" />
            <DraggableItem icon={ListIcon} label="List" type="messageNode" subtype="list" colorClass="text-emerald-600" />
            <DraggableItem icon={ShoppingBag} label="Catalogue Message" type="messageNode" subtype="catalogue" colorClass="text-emerald-600" />
            <DraggableItem icon={Package} label="Single Product" type="messageNode" subtype="single-product" colorClass="text-emerald-600" />
            <DraggableItem icon={Package} label="Multi Product" type="messageNode" subtype="multi-product" colorClass="text-emerald-600" />
            <DraggableItem icon={FileText} label="Template" type="messageNode" subtype="template" colorClass="text-emerald-600" />
          </div>
        </div>

        {/* Actions */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-4 cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors">
            <h4 className="text-sm font-bold text-gray-800">Actions</h4>
            <ChevronRight className="w-4 h-4 text-gray-400 rotate-90" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <DraggableItem icon={AlertTriangle} label="Request Intervention" type="actionNode" subtype="request-intervention" colorClass="text-emerald-600" />
            <DraggableItem icon={Waypoints} label="Meta Conversions Api" type="actionNode" subtype="meta-capi" colorClass="text-emerald-600" />
            <DraggableItem icon={SplitSquareHorizontal} label="Condition" type="conditionNode" subtype="condition" colorClass="text-emerald-600" />
            <DraggableItem icon={LinkIcon} label="Connect Flow" type="actionNode" subtype="connect-flow" colorClass="text-emerald-600" />
            <DraggableItem icon={MapPin} label="Ask Address" type="inputNode" subtype="ask-address" colorClass="text-emerald-600" />
            <DraggableItem icon={Navigation} label="Ask Location" type="inputNode" subtype="ask-location" colorClass="text-emerald-600" />
            <DraggableItem icon={HelpCircle} label="Ask Question" type="inputNode" subtype="ask-question" colorClass="text-emerald-600" />
            <DraggableItem icon={UploadCloud} label="Ask Media" type="inputNode" subtype="ask-media" colorClass="text-emerald-600" />
            <DraggableItem icon={FileEdit} label="Set Attribute" type="actionNode" subtype="set-attribute" colorClass="text-emerald-600" />
            <DraggableItem icon={Tag} label="Add Tag" type="actionNode" subtype="add-tag" colorClass="text-emerald-600" />
            <DraggableItem icon={Server} label="API Request" type="actionNode" subtype="api-request" colorClass="text-emerald-600" />
          </div>
        </div>

      </div>
    </aside>
  );
};

export default FlowSidebar;
