import React, { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { 
  MessageSquare, Image as ImageIcon, Plus, Paperclip, Type, List as ListIcon, 
  ShoppingBag, Package, FileText, X, Loader2, Link as LinkIcon, Phone, ExternalLink,
  RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_WHATSAPP_TEMPLATES, WhatsAppTemplate } from '../data/defaultTemplates';

const DEFAULT_META_TOKEN = "EAAX2HQ7QpvUBSZAK3krfGE7pLN8pW3WoUZCSJZCJsZB4oallIQNagAXwCqENBRZBO3kOGbABFyeI0IqrkZAsuA5lft4kVWrtuoy9MylP9RDz2BV5uEFLjNFBNuU9CJqzFMEMYLZBTn8ZCswZCE8CubZCg0KliOITU9t43FlGZA6HBSyS819nxhAdvTZBOl8IhT5tbV2LHQZDZD";
const DEFAULT_META_WABA_ID = "1564657775051850";

const MessageNode = ({ id, data, isConnectable }: any) => {
  const { updateNodeData } = useReactFlow();
  const subtype = data.subtype || 'media-buttons';

  const [fetchedTemplates, setFetchedTemplates] = useState<WhatsAppTemplate[]>(DEFAULT_WHATSAPP_TEMPLATES);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [liveApiConnected, setLiveApiConnected] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchLiveTemplates = async () => {
    setIsLoadingTemplates(true);
    setSyncMessage(null);
    try {
      // Fetch WhatsApp API credentials directly from Database session_settings table
      const { data: sessionData, error: dbError } = await supabase
        .from('session_settings')
        .select('wa_api_token, wa_waba_id, wa_phone_number_id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dbError) {
        console.warn("DB Session Settings fetch notice:", dbError);
      }

      const currentToken = (
        sessionData?.wa_api_token || 
        localStorage.getItem('wa_api_token') || 
        localStorage.getItem('pabbly_token') || 
        DEFAULT_META_TOKEN
      ).trim();

      const currentWabaId = (
        (sessionData as any)?.wa_waba_id || 
        localStorage.getItem('wa_waba_id') || 
        DEFAULT_META_WABA_ID
      ).trim();

      if (!currentToken) {
        setLiveApiConnected(false);
        setSyncMessage("⚠️ WhatsApp API Token not found. Please click 'Save Config' in CRM WhatsApp Settings.");
        const markedPresets = DEFAULT_WHATSAPP_TEMPLATES.map(dt => ({ ...dt, source: 'preset' as const }));
        setFetchedTemplates(markedPresets);
        setIsLoadingTemplates(false);
        return;
      }

      const url = `https://graph.facebook.com/v20.0/${currentWabaId}/message_templates?fields=name,status,category,language,components&limit=100&access_token=${currentToken}`;
      
      const res = await fetch(url);
      const json = await res.json();
      
      if (res.ok && json.data && Array.isArray(json.data)) {
        const apiTemplates: WhatsAppTemplate[] = json.data.map((t: any) => {
          const bodyComp = t.components?.find((c: any) => c.type === 'BODY');
          const headerComp = t.components?.find((c: any) => c.type === 'HEADER');
          const footerComp = t.components?.find((c: any) => c.type === 'FOOTER');
          const buttonsComp = t.components?.find((c: any) => c.type === 'BUTTONS');

          const vars = bodyComp?.text ? (bodyComp.text.match(/\{\{\d+\}\}/g) || []) : [];
          const uniqueVars = Array.from(new Set(vars)) as string[];
          
          const parsedButtons = (buttonsComp?.buttons || []).map((b: any, bIdx: number) => ({
            id: `api_btn_${bIdx}`,
            type: b.type || 'QUICK_REPLY',
            text: b.text || 'Button',
            url: b.url,
            phoneNumber: b.phone_number
          }));

          return {
            id: t.id || t.name,
            name: t.name,
            category: t.category || 'MARKETING',
            status: t.status || 'APPROVED',
            language: t.language || 'en',
            headerType: headerComp?.format || (headerComp ? 'TEXT' : 'NONE'),
            headerContent: headerComp?.text || '',
            body: bodyComp?.text || '',
            variables: uniqueVars,
            footer: footerComp?.text || '',
            buttons: parsedButtons,
            source: 'meta'
          };
        });

        if (apiTemplates.length > 0) {
          setLiveApiConnected(true);
          setFetchedTemplates(apiTemplates);
          setSyncMessage(`🟢 Synced ${apiTemplates.length} Live Meta WABA Templates!`);
          setIsLoadingTemplates(false);
          return;
        } else {
          setSyncMessage("ℹ️ Meta API connected, but 0 templates found in WABA account.");
        }
      } else if (json.error) {
        console.warn("Meta Graph API Error:", json.error);
        setSyncMessage(`❌ Meta API Error: ${json.error.message || 'Invalid Token or WABA ID'}`);
      }
    } catch (err: any) {
      console.error("Error fetching WABA templates from DB credentials:", err);
      setSyncMessage(`❌ Connection error: ${err.message || 'Failed to reach Meta API'}`);
    }

    setLiveApiConnected(false);
    const markedPresets = DEFAULT_WHATSAPP_TEMPLATES.map(dt => ({ ...dt, source: 'preset' as const }));
    setFetchedTemplates(markedPresets);
    setIsLoadingTemplates(false);
  };

  useEffect(() => {
    if (subtype === 'template') {
      fetchLiveTemplates();
    }
  }, [subtype]);

  // Ensure initial template selection
  useEffect(() => {
    if (subtype === 'template' && !data.templateName && fetchedTemplates.length > 0) {
      const defaultTpl = fetchedTemplates[0];
      const varsObj = defaultTpl.variables.reduce((acc: any, v: string) => ({...acc, [v]: ''}), {});
      updateNodeData(id, {
        templateId: defaultTpl.id,
        templateName: defaultTpl.name,
        variables: varsObj,
        buttons: defaultTpl.buttons
      });
    }
  }, [subtype, fetchedTemplates, data.templateName, id, updateNodeData]);

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
      case 'template': return 'WhatsApp Template';
      default: return 'Message';
    }
  };

  const renderKeywords = () => (
    <div>
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Trigger AI Keywords</label>
      <Input 
        value={data.aiKeyword || ''}
        onChange={(e) => updateNodeData(id, { aiKeyword: e.target.value })}
        placeholder="e.g. hello, info, book" 
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

  // Custom Buttons with per-button source Handle
  const renderCustomButtons = () => {
    const buttons = data.buttons || [
      { id: 'btn_1', text: 'Option 1' },
      { id: 'btn_2', text: 'Option 2' }
    ];

    return (
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Interactive Buttons</label>
        {buttons.map((btn: any, idx: number) => {
          const handleId = `btn-${idx}`;
          return (
            <div key={idx} className="relative flex items-center">
              <div className="w-full border border-emerald-400 text-emerald-800 bg-emerald-50/80 rounded-lg py-1.5 px-3 text-xs font-bold flex justify-between items-center shadow-sm hover:bg-emerald-100 transition-colors">
                <input
                  value={btn.text}
                  onChange={(e) => {
                    const newBtns = [...buttons];
                    newBtns[idx] = { ...newBtns[idx], text: e.target.value };
                    updateNodeData(id, { buttons: newBtns });
                  }}
                  className="bg-transparent outline-none w-full text-emerald-800 font-semibold"
                  placeholder="Button label"
                />
                <button 
                  onClick={() => {
                    const newBtns = buttons.filter((_: any, i: number) => i !== idx);
                    updateNodeData(id, { buttons: newBtns });
                  }} 
                  className="text-emerald-400 hover:text-red-500 ml-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Per-button connection handle */}
              <Handle
                type="source"
                position={Position.Right}
                id={handleId}
                isConnectable={isConnectable}
                className="w-3.5 h-3.5 !bg-emerald-500 !border-2 !border-white shadow-md hover:scale-125 transition-transform !-mr-2"
                title={`Connect flow for "${btn.text}"`}
              />
            </div>
          );
        })}

        {buttons.length < 3 && (
          <button 
            onClick={() => {
              const newBtns = [...buttons, { id: `btn_${Date.now()}`, text: `Button ${buttons.length + 1}` }];
              updateNodeData(id, { buttons: newBtns });
            }}
            className="border border-dashed border-emerald-400 text-emerald-600 bg-emerald-50/40 hover:bg-emerald-50 rounded-lg py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-colors mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Button
          </button>
        )}
      </div>
    );
  };

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
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Enter media URL</label>
        <Input 
          value={data.mediaUrl || ''}
          onChange={handleUrlChange}
          placeholder="https://images.unsplash.com/..." 
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

  const renderListSections = () => {
    const sections = data.sections || [
      {
        title: 'Options',
        rows: [
          { id: 'row_1', title: 'Hatha Yoga Class' },
          { id: 'row_2', title: 'Pranayama & Meditation' }
        ]
      }
    ];

    return (
      <div className="flex flex-col gap-3">
        {sections.map((sec: any, sIdx: number) => (
          <div key={sIdx} className="border border-gray-200 rounded-lg p-2.5 bg-gray-50/80 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <input 
                value={sec.title || ''}
                onChange={(e) => {
                  const newSecs = [...sections];
                  newSecs[sIdx].title = e.target.value;
                  updateNodeData(id, { sections: newSecs });
                }}
                placeholder="Section Title"
                className="text-xs font-bold bg-transparent outline-none w-full text-gray-800"
              />
              <button onClick={() => {
                const newSecs = sections.filter((_: any, i: number) => i !== sIdx);
                updateNodeData(id, { sections: newSecs });
              }} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="flex flex-col gap-1.5">
              {sec.rows?.map((row: any, rIdx: number) => {
                const handleId = `list-row-${sIdx}-${rIdx}`;
                return (
                  <div key={rIdx} className="relative flex items-center">
                    <div className="flex-1 flex gap-2 items-center bg-white p-2 rounded-md border border-gray-200 shadow-sm">
                      <input 
                        value={row.title}
                        onChange={(e) => {
                          const newSecs = [...sections];
                          newSecs[sIdx].rows[rIdx].title = e.target.value;
                          updateNodeData(id, { sections: newSecs });
                        }}
                        placeholder="Row Option Title"
                        className="text-xs font-medium bg-transparent outline-none flex-1 text-gray-700"
                      />
                      <button onClick={() => {
                        const newSecs = [...sections];
                        newSecs[sIdx].rows = newSecs[sIdx].rows.filter((_: any, i: number) => i !== rIdx);
                        updateNodeData(id, { sections: newSecs });
                      }} className="text-gray-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>

                    {/* Per-row handle */}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={handleId}
                      isConnectable={isConnectable}
                      className="w-3 h-3 !bg-emerald-600 !border-2 !border-white shadow-md hover:scale-125 transition-transform !-mr-2"
                      title={`Connect for "${row.title}"`}
                    />
                  </div>
                );
              })}
              <button 
                onClick={() => {
                  const newSecs = [...sections];
                  if (!newSecs[sIdx].rows) newSecs[sIdx].rows = [];
                  newSecs[sIdx].rows.push({ id: `row_${Date.now()}`, title: `Option ${newSecs[sIdx].rows.length + 1}` });
                  updateNodeData(id, { sections: newSecs });
                }}
                className="text-[11px] text-emerald-600 font-semibold mt-1 text-left hover:underline flex items-center gap-1">
                + Add Option Row
              </button>
            </div>
          </div>
        ))}
        <button 
          onClick={() => {
            updateNodeData(id, { sections: [...sections, { title: 'New Section', rows: [] }] });
          }}
          className="border border-dashed border-emerald-300 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 rounded-lg py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Add Section
        </button>
      </div>
    );
  };

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
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">{isMulti ? 'Product Retailer IDs' : 'Product Retailer ID'}</label>
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
    const selectedTemplate = fetchedTemplates.find(t => t.name === data.templateName) || fetchedTemplates[0];

    return (
      <div className="flex flex-col gap-3">
        {/* WABA Live Status & Refresh Button */}
        <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {liveApiConnected ? (
              <span className="flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> WABA Live Synced
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-700 font-bold text-[10px] bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                <AlertCircle className="w-3 h-3 text-amber-600" /> Presets Active
              </span>
            )}
          </div>
          
          <button
            onClick={fetchLiveTemplates}
            disabled={isLoadingTemplates}
            className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-md transition-colors whitespace-nowrap"
            title="Fetch live templates from Database WABA credentials"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingTemplates ? 'animate-spin text-emerald-700' : ''}`} />
            Refresh
          </button>
        </div>

        {syncMessage && (
          <div className="text-[10px] text-emerald-900 bg-emerald-50/90 border border-emerald-200 p-2 rounded-lg font-medium leading-tight whitespace-normal break-words">
            {syncMessage}
          </div>
        )}

        <div>
          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Select WhatsApp Template</label>
          <div className="relative">
            <select 
              value={selectedTemplate?.name || ''}
              onChange={(e) => {
                const t = fetchedTemplates.find(temp => temp.name === e.target.value);
                if (t) {
                  const varsObj = t.variables.reduce((acc: any, v: string) => ({...acc, [v]: ''}), {});
                  updateNodeData(id, { 
                    templateId: t.id, 
                    templateName: t.name, 
                    variables: varsObj,
                    buttons: t.buttons 
                  });
                }
              }}
              className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 bg-gray-50 text-xs font-semibold text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
              disabled={isLoadingTemplates}
            >
              {fetchedTemplates.map(t => (
                <option key={t.id || t.name} value={t.name}>
                  {t.source === 'meta' ? '⚡ ' : '📁 '} {t.name} ({t.category})
                </option>
              ))}
            </select>
            {isLoadingTemplates && <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-2.5 text-emerald-600" />}
          </div>
        </div>

        {selectedTemplate && (
          <div className="border border-emerald-100 rounded-xl p-3 bg-emerald-50/40 flex flex-col gap-2.5">
            {/* Header Preview */}
            {selectedTemplate.headerType === 'IMAGE' && selectedTemplate.headerContent && (
              <div className="aspect-video rounded-lg overflow-hidden border border-emerald-200">
                <img src={selectedTemplate.headerContent} alt="Header" className="w-full h-full object-cover" />
              </div>
            )}
            {selectedTemplate.headerType === 'TEXT' && selectedTemplate.headerContent && (
              <div className="text-xs font-bold text-emerald-900 border-b border-emerald-100 pb-1">
                {selectedTemplate.headerContent}
              </div>
            )}

            {/* Template Body */}
            <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
              {selectedTemplate.body}
            </div>

            {/* Template Footer */}
            {selectedTemplate.footer && (
              <div className="text-[10px] text-gray-400 italic">
                {selectedTemplate.footer}
              </div>
            )}

            {/* Variables Input Mapping */}
            {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div className="bg-white p-2.5 rounded-lg border border-emerald-200/60 mt-1">
                <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider mb-2">Map Template Variables</p>
                <div className="flex flex-col gap-2">
                  {selectedTemplate.variables.map((v: string) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">{v}</span>
                      <Input 
                        placeholder={`e.g. {{user_name}} or Customer`} 
                        className="h-7 text-xs bg-gray-50 focus-visible:ring-emerald-500" 
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
          </div>
        )}

        {/* Template Buttons & Handles */}
        {selectedTemplate?.buttons && selectedTemplate.buttons.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Template Buttons & Branch Handles</label>
            {selectedTemplate.buttons.map((btn, idx) => {
              const handleId = `tpl-btn-${idx}`;
              return (
                <div key={btn.id || idx} className="relative flex items-center">
                  <div className="w-full border border-emerald-500 bg-emerald-600 text-white rounded-lg py-2 px-3 text-xs font-bold flex items-center justify-between shadow-sm">
                    <span className="truncate flex items-center gap-1.5">
                      {btn.type === 'URL' && <ExternalLink className="w-3 h-3 text-emerald-200" />}
                      {btn.type === 'PHONE_NUMBER' && <Phone className="w-3 h-3 text-emerald-200" />}
                      {btn.text}
                    </span>
                    <span className="text-[9px] bg-emerald-700 px-1.5 py-0.5 rounded text-emerald-100 uppercase font-mono">
                      {btn.type === 'QUICK_REPLY' ? 'Quick Reply' : btn.type}
                    </span>
                  </div>

                  {/* Per-button Handle */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={handleId}
                    isConnectable={isConnectable}
                    className="w-3.5 h-3.5 !bg-emerald-500 !border-2 !border-white shadow-md hover:scale-125 transition-transform !-mr-2"
                    title={`Branch flow on "${btn.text}" click`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-[300px] overflow-visible transition-all hover:shadow-2xl">
      {/* Target Connection Handle (Input from previous step) */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-4 h-4 !bg-white !border-[3px] !border-gray-400 -ml-2 shadow-sm hover:scale-110"
      />
      
      {/* Node Header */}
      <div className="bg-gradient-to-r from-gray-50 to-emerald-50/50 px-3.5 py-2.5 flex items-center justify-between border-b border-gray-100 rounded-t-2xl">
        <div className="flex items-center gap-2">
          {renderHeaderIcon()}
          <span className="text-gray-800 font-extrabold text-xs tracking-wide uppercase">{renderHeaderTitle()}</span>
        </div>
        {subtype === 'template' && (
          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
            Official
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className="p-3.5 bg-white flex flex-col gap-4">
        {renderKeywords()}

        {subtype === 'media-buttons' && renderMediaOptions()}
        
        {(subtype === 'text-buttons' || subtype === 'media-buttons') && renderTextArea()}
        {(subtype === 'text-buttons' || subtype === 'media-buttons') && renderCustomButtons()}

        {subtype === 'list' && renderTextArea()}
        {subtype === 'list' && renderListSections()}

        {subtype === 'catalogue' && renderCatalogue()}
        {subtype === 'single-product' && renderProduct(false)}
        {subtype === 'multi-product' && renderProduct(true)}
        
        {subtype === 'template' && renderTemplate()}
      </div>
      
      {/* Fallback default handle for sequential flow */}
      <Handle
        type="source"
        id="default-next"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-4 h-4 !bg-emerald-600 !border-[3px] !border-white -mr-2 shadow-md hover:scale-110"
        title="Default next step handle"
      />
    </div>
  );
};

export default MessageNode;
