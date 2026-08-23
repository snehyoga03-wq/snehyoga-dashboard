import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { MessageSquare, Image as ImageIcon, Plus, Paperclip, Type, List as ListIcon, ShoppingBag, Package, FileText, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

const MessageNode = ({ id, data, isConnectable }: any) => {
  const { updateNodeData } = useReactFlow();
  const subtype = data.subtype || 'media-buttons';

  const [fetchedTemplates, setFetchedTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  useEffect(() => {
    if (subtype !== 'template') return;
    const fetchTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const { data, error } = await supabase
          .from('session_settings')
          .select('wa_api_token, wa_waba_id')
          .maybeSingle();

        if (error || !data?.wa_api_token) return;

        const wabaId = (data as any)?.wa_waba_id || localStorage.getItem('wa_waba_id') || "1564657775051850";
        if (!wabaId) return;

        const url = `https://graph.facebook.com/v20.0/${wabaId}/message_templates?fields=name,status,category,components&limit=100&access_token=${data.wa_api_token}`;
        
        const res = await fetch(url);
        const json = await res.json();
        
        if (res.ok && json.data) {
          const formatted = json.data.map((t: any) => {
            const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
            const vars = bodyComp?.text ? (bodyComp.text.match(/\{\{\d+\}\}/g) || []) : [];
            const uniqueVars = Array.from(new Set(vars));
            
            return {
              id: t.id,
              name: t.name,
              category: t.category,
              status: t.status,
              body: bodyComp?.text || '',
              variables: uniqueVars as string[],
            };
          });
          setFetchedTemplates(formatted);
        }
      } catch (err) {
        console.error("Error fetching templates:", err);
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [subtype]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateNodeData(id, { text: e.target.value });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeData(id, { mediaUrl: e.target.value });
  };

  const handleMediaTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { mediaType: e.target.value });
  };

  const renderHeaderIcon = () => {
    switch (subtype) {
      case 'text-buttons': return <Type className="w-3.5 h-3.5 text-emerald-600" />;
      case 'media-buttons': return <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />;
      case 'list': return <ListIcon className="w-3.5 h-3.5 text-emerald-600" />;
      case 'catalogue': return <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />;
      case 'single-product': 
      case 'multi-product': return <Package className="w-3.5 h-3.5 text-emerald-600" />;
      case 'template': return <FileText className="w-3.5 h-3.5 text-emerald-600" />;
      default: return <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  const renderHeaderTitle = () => {
    switch (subtype) {
      case 'text-buttons': return 'Text Buttons';
      case 'media-buttons': return 'Media Buttons';
      case 'list': return 'List Message';
      case 'catalogue': return 'Catalogue';
      case 'single-product': return 'Single Product';
      case 'multi-product': return 'Multi Product';
      case 'template': return 'Template';
      default: return 'Message';
    }
  };

  const renderKeywords = () => (
    <div>
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Type / press enter to add AI Keyword</label>
      <Input 
        value={data.aiKeyword || ''}
        onChange={(e) => updateNodeData(id, { aiKeyword: e.target.value })}
        placeholder="Enter AI keywords" 
        className="h-8 text-xs bg-gray-50 border-gray-200 focus-visible:ring-emerald-500"
      />
    </div>
  );

  const renderTextArea = () => (
    <div className="border border-gray-200 rounded-lg overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all bg-gray-50">
      <textarea 
        value={data.text || ''}
        onChange={handleTextChange}
        className="w-full text-xs p-2 min-h-[80px] bg-transparent resize-none focus:outline-none text-gray-700"
        placeholder="Enter message text..."
      />
      <div className="bg-gray-100 px-2 py-1 flex items-center justify-between border-t border-gray-200">
        <div className="flex gap-2 text-gray-400">
          <span className="cursor-pointer hover:text-gray-600 font-bold">B</span>
          <span className="cursor-pointer hover:text-gray-600 italic">I</span>
          <span className="cursor-pointer hover:text-gray-600 line-through">S</span>
          <Paperclip className="w-3.5 h-3.5 cursor-pointer hover:text-gray-600 ml-1" />
        </div>
        <span className="text-[9px] text-gray-400 font-medium">{(data.text || '').length}/1024</span>
      </div>
    </div>
  );

  const renderButtons = () => (
    <div className="flex flex-col gap-2">
      {data.buttons?.map((btn: any, idx: number) => (
        <div key={idx} className="border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-lg py-1.5 px-3 text-xs font-bold flex justify-between items-center">
          <input
            value={btn.text}
            onChange={(e) => {
              const newBtns = [...data.buttons];
              newBtns[idx] = { ...newBtns[idx], text: e.target.value };
              updateNodeData(id, { buttons: newBtns });
            }}
            className="bg-transparent outline-none w-full text-emerald-700"
            placeholder="Button text"
          />
          <button onClick={() => {
            const newBtns = data.buttons.filter((_: any, i: number) => i !== idx);
            updateNodeData(id, { buttons: newBtns });
          }} className="text-emerald-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      {(!data.buttons || data.buttons.length < 3) && (
        <button 
          onClick={() => {
            const currentBtns = data.buttons || [];
            updateNodeData(id, { buttons: [...currentBtns, { text: 'New Button' }] });
          }}
          className="border border-dashed border-emerald-300 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 rounded-lg py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Add Button
        </button>
      )}
    </div>
  );

  const renderMediaOptions = () => (
    <>
      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Select media type</label>
        <select 
          value={data.mediaType || 'IMAGE'} 
          onChange={handleMediaTypeChange}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-700 outline-none"
        >
          <option value="IMAGE">IMAGE</option>
          <option value="VIDEO">VIDEO</option>
          <option value="DOCUMENT">DOCUMENT</option>
        </select>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Enter a valid url</label>
        <Input 
          value={data.mediaUrl || ''}
          onChange={handleUrlChange}
          placeholder="https://..." 
          className="h-8 text-xs bg-gray-50 border-gray-200 focus-visible:ring-emerald-500"
        />
      </div>

      {data.mediaUrl && data.mediaType === 'IMAGE' && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 relative aspect-video flex items-center justify-center">
          <img src={data.mediaUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
      )}
    </>
  );

  const renderListSections = () => (
    <div className="flex flex-col gap-3">
      {data.sections?.map((sec: any, sIdx: number) => (
        <div key={sIdx} className="border border-gray-200 rounded-lg p-2 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <input 
              value={sec.title || ''}
              onChange={(e) => {
                const newSecs = [...data.sections];
                newSecs[sIdx].title = e.target.value;
                updateNodeData(id, { sections: newSecs });
              }}
              placeholder="Section Title"
              className="text-xs font-bold bg-transparent outline-none w-full"
            />
            <button onClick={() => {
              const newSecs = data.sections.filter((_: any, i: number) => i !== sIdx);
              updateNodeData(id, { sections: newSecs });
            }} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
          </div>
          <div className="flex flex-col gap-1">
            {sec.rows?.map((row: any, rIdx: number) => (
              <div key={rIdx} className="flex gap-2 items-center bg-white p-1.5 rounded border border-gray-100">
                <input 
                  value={row.title}
                  onChange={(e) => {
                    const newSecs = [...data.sections];
                    newSecs[sIdx].rows[rIdx].title = e.target.value;
                    updateNodeData(id, { sections: newSecs });
                  }}
                  placeholder="Row Title"
                  className="text-[10px] bg-transparent outline-none flex-1"
                />
                <button onClick={() => {
                  const newSecs = [...data.sections];
                  newSecs[sIdx].rows = newSecs[sIdx].rows.filter((_: any, i: number) => i !== rIdx);
                  updateNodeData(id, { sections: newSecs });
                }} className="text-gray-300 hover:text-red-500"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <button 
              onClick={() => {
                const newSecs = [...data.sections];
                if (!newSecs[sIdx].rows) newSecs[sIdx].rows = [];
                newSecs[sIdx].rows.push({ title: 'New Row' });
                updateNodeData(id, { sections: newSecs });
              }}
              className="text-[10px] text-emerald-600 font-semibold mt-1 text-left hover:underline">
              + Add Row
            </button>
          </div>
        </div>
      ))}
      <button 
        onClick={() => {
          const currentSecs = data.sections || [];
          updateNodeData(id, { sections: [...currentSecs, { title: 'New Section', rows: [] }] });
        }}
        className="border border-dashed border-emerald-300 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 rounded-lg py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-colors">
        <Plus className="w-3.5 h-3.5" />
        Add Section
      </button>
    </div>
  );

  const renderCatalogue = () => (
    <>
      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Select Catalog</label>
        <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-700 outline-none">
          <option>Sneha Yoga Primary Catalog</option>
          <option>Summer Camp Products</option>
        </select>
      </div>
      {renderTextArea()}
    </>
  );

  const renderProduct = (isMulti: boolean) => (
    <>
      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Select Catalog</label>
        <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-700 outline-none mb-3">
          <option>Sneha Yoga Primary Catalog</option>
        </select>
      </div>
      <div>
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">{isMulti ? 'Product Retailer IDs (comma separated)' : 'Product Retailer ID'}</label>
        <Input 
          value={data.retailerId || ''}
          onChange={(e) => updateNodeData(id, { retailerId: e.target.value })}
          placeholder={isMulti ? "sku_1, sku_2" : "sku_12345"} 
          className="h-8 text-xs bg-gray-50 border-gray-200 focus-visible:ring-emerald-500"
        />
      </div>
      {renderTextArea()}
    </>
  );

  const renderTemplate = () => {
    const selectedTemplate = fetchedTemplates.find(t => t.name === data.templateName);
    
    return (
      <>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Select Template</label>
          <div className="relative">
            <select 
              value={data.templateName || ''}
              onChange={(e) => {
                const t = fetchedTemplates.find(temp => temp.name === e.target.value);
                if (t) {
                  // Initialize variables object
                  const varsObj = t.variables.reduce((acc: any, v: string) => ({...acc, [v]: ''}), {});
                  updateNodeData(id, { templateId: t.id, templateName: t.name, variables: varsObj });
                }
              }}
              className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-1.5 bg-gray-50 text-xs font-semibold text-gray-700 outline-none appearance-none"
              disabled={isLoadingTemplates}
            >
              <option value="">{isLoadingTemplates ? "Loading templates..." : "-- Choose Template --"}</option>
              {fetchedTemplates.map(t => (
                <option key={t.id} value={t.name}>{t.name} ({t.status})</option>
              ))}
            </select>
            {isLoadingTemplates && <Loader2 className="w-3 h-3 animate-spin absolute right-3 top-2 text-gray-400" />}
          </div>
        </div>
        
        {selectedTemplate && selectedTemplate.variables.length > 0 && (
          <div className="bg-emerald-50 p-2 rounded border border-emerald-100 mt-2">
            <p className="text-[10px] text-emerald-800 font-semibold mb-1">Template Variables</p>
            <div className="flex flex-col gap-1">
              {selectedTemplate.variables.map((v: string) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-8">{v}</span>
                  <Input 
                    placeholder={`Value for ${v}`} 
                    className="h-6 text-[10px]" 
                    value={data.variables?.[v] || ''}
                    onChange={(e) => {
                      updateNodeData(id, { 
                        variables: { ...(data.variables || {}), [v]: e.target.value } 
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        
        {selectedTemplate && (
          <div className="mt-2 text-[9px] text-gray-500 italic border-l-2 border-gray-200 pl-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
            {selectedTemplate.body}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 w-[280px] overflow-visible">
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-4 h-4 bg-white border-[3px] border-gray-300 -ml-2"
      />
      
      {/* Header */}
      <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 border-b border-gray-100 rounded-t-xl">
        {renderHeaderIcon()}
        <span className="text-gray-700 font-bold text-xs uppercase tracking-wide">{renderHeaderTitle()}</span>
      </div>
      
      {/* Content */}
      <div className="p-3 bg-white flex flex-col gap-4">
        {renderKeywords()}

        {subtype === 'media-buttons' && renderMediaOptions()}
        
        {(subtype === 'text-buttons' || subtype === 'media-buttons') && renderTextArea()}
        {(subtype === 'text-buttons' || subtype === 'media-buttons') && renderButtons()}

        {subtype === 'list' && renderTextArea()}
        {subtype === 'list' && renderListSections()}

        {subtype === 'catalogue' && renderCatalogue()}
        {subtype === 'single-product' && renderProduct(false)}
        {subtype === 'multi-product' && renderProduct(true)}
        
        {subtype === 'template' && renderTemplate()}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-4 h-4 bg-white border-[3px] border-emerald-500 -mr-2"
      />
    </div>
  );
};

export default MessageNode;
