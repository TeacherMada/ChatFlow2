import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, MessageSquare, HelpCircle, GitBranch, Zap, Play, Menu, X, Keyboard, Image as ImageIcon, List, MousePointerClick, Database, Tag, Settings, Trash2, Plus, BrainCircuit, Undo, Redo } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NodeHeader = ({ id, label, icon: Icon, color }: any) => {
  const { setNodes } = useReactFlow();
  const handleDelete = (e: any) => {
    e.stopPropagation();
    if (confirm('Delete this node?')) {
      setNodes((nds) => nds.filter((n) => n.id !== id));
    }
  };
  return (
    <div className={`bg-${color}-50 p-3 rounded-t-md border-b border-${color}-100 flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 text-${color}-600`} />
        <span className={`font-semibold text-sm text-${color}-900`}>{label}</span>
      </div>
      <button onClick={handleDelete} className={`text-${color}-400 hover:text-red-500 p-1 rounded hover:bg-${color}-100`}>
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
};

const nodeTypes = {
  trigger: ({ id, data }: any) => (
    <div className="bg-white border-2 border-indigo-500 rounded-lg shadow-sm w-64">
      <NodeHeader id={id} label="Trigger" icon={Zap} color="indigo" />
      <div className="p-4">
        <p className="text-sm text-gray-600">{data.label}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
    </div>
  ),
  message: ({ id, data }: any) => (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      <NodeHeader id={id} label="Send Message" icon={MessageSquare} color="gray" />
      <div className="p-4">
        <p className="text-sm text-gray-600">{data.label}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
    </div>
  ),
  ai_response: ({ id, data }: any) => (
    <div className="bg-white border-2 border-violet-500 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-violet-500" />
      <NodeHeader id={id} label="AI Response" icon={BrainCircuit} color="violet" />
      <div className="p-4">
        <p className="text-sm text-gray-600 italic line-clamp-2">{data.prompt || "Use user's message"}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-violet-500" />
    </div>
  ),
  condition: ({ id, data }: any) => (
    <div className="bg-white border-2 border-amber-400 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-amber-400" />
      <NodeHeader id={id} label="Condition" icon={GitBranch} color="amber" />
      <div className="p-4">
        <p className="text-sm text-gray-600">{data.label}</p>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" className="w-3 h-3 bg-green-500 left-1/4" />
      <Handle type="source" position={Position.Bottom} id="false" className="w-3 h-3 bg-red-500 left-3/4" />
    </div>
  ),
  input: ({ id, data }: any) => (
    <div className="bg-white border-2 border-purple-400 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-purple-400" />
      <NodeHeader id={id} label="User Input" icon={Keyboard} color="purple" />
      <div className="p-4">
        <p className="text-sm text-gray-600 italic">"{data.label}"</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-purple-400" />
    </div>
  ),
  image: ({ id, data }: any) => (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-gray-400" />
      <NodeHeader id={id} label="Send Image" icon={ImageIcon} color="gray" />
      <div className="p-4">
        <p className="text-sm text-gray-600 truncate">{data.url || 'No image URL'}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-gray-400" />
    </div>
  ),
  quick_replies: ({ id, data }: any) => (
    <div className="bg-white border border-blue-200 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-400" />
      <NodeHeader id={id} label="Quick Replies" icon={List} color="blue" />
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-2">{data.label}</p>
        <div className="flex flex-wrap gap-1">
          {(data.replies || ['Yes', 'No']).map((r: string, i: number) => (
            <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">{r}</span>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-400" />
    </div>
  ),
  buttons: ({ id, data }: any) => (
    <div className="bg-white border border-blue-200 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-400" />
      <NodeHeader id={id} label="Buttons" icon={MousePointerClick} color="blue" />
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-2">{data.label}</p>
        <div className="flex flex-col gap-1">
          {(data.buttons || ['Click Here']).map((b: string, i: number) => (
            <div key={i} className="px-2 py-1 border border-blue-200 text-blue-600 text-xs rounded text-center">{b}</div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-400" />
    </div>
  ),
  set_variable: ({ id, data }: any) => (
    <div className="bg-white border-2 border-emerald-400 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-400" />
      <NodeHeader id={id} label="Set Variable" icon={Database} color="emerald" />
      <div className="p-4">
        <p className="text-sm text-gray-600"><span className="font-mono bg-gray-100 px-1 rounded">{data.key || 'key'}</span> = {data.value || 'value'}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-400" />
    </div>
  ),
  add_tag: ({ id, data }: any) => (
    <div className="bg-white border-2 border-emerald-400 rounded-lg shadow-sm w-64">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-emerald-400" />
      <NodeHeader id={id} label="Add Tag" icon={Tag} color="emerald" />
      <div className="p-4">
        <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-full">{data.tag || 'new_tag'}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-emerald-400" />
    </div>
  ),
};

const FlowBuilderContent = ({ flow, onBack }: any) => {
  const { setNodes: setNodesRF, setEdges: setEdgesRF, getNodes, getEdges } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [matchType, setMatchType] = useState('exact');
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);

  useEffect(() => {
    if (flow) {
      setNodes(JSON.parse(flow.nodes || '[]'));
      setEdges(JSON.parse(flow.edges || '[]'));
      fetchKeywords();
    }
  }, [flow]);

  const fetchKeywords = async () => {
    try {
      const res = await fetch(`/api/pages/${flow.page_id}/keywords`);
      const data = await res.json();
      setKeywords(data.keywords.filter((k: any) => k.flow_id === flow.id));
    } catch (err) {
      console.error("Failed to fetch keywords", err);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    setIsAddingKeyword(true);
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: flow.page_id,
          keyword: newKeyword,
          matchType,
          flowId: flow.id
        })
      });
      if (res.ok) {
        setNewKeyword('');
        fetchKeywords();
      }
    } catch (err) {
      console.error("Failed to add keyword", err);
    } finally {
      setIsAddingKeyword(false);
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    try {
      await fetch(`/api/keywords/${id}`, { method: 'DELETE' });
      fetchKeywords();
    } catch (err) {
      console.error("Failed to delete keyword", err);
    }
  };

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/flows/${flow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const res = await fetch(`/api/flows/${flow.id}/toggle`, { method: 'POST' });
      if (res.ok) {
        onBack();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addNode = (type: string) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label: `New ${type}` },
    };
    setNodes((nds) => nds.concat(newNode));
    setIsSidebarOpen(false);
  };

  const onNodeDoubleClick = (event: React.MouseEvent, node: any) => {
    if (node.type === 'image') {
      const url = prompt('Enter Image URL:', node.data.url);
      if (url !== null) {
        setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, url } } : n));
      }
    } else if (node.type === 'quick_replies') {
      const label = prompt('Enter Question Text:', node.data.label);
      const replies = prompt('Enter Replies (comma separated):', (node.data.replies || []).join(','));
      if (label !== null || replies !== null) {
        setNodes((nds) => nds.map((n) => n.id === node.id ? { 
          ...n, 
          data: { 
            ...n.data, 
            label: label || n.data.label, 
            replies: replies ? replies.split(',').map((s: string) => s.trim()) : n.data.replies 
          } 
        } : n));
      }
    } else if (node.type === 'buttons') {
      const label = prompt('Enter Message Text:', node.data.label);
      const buttons = prompt('Enter Buttons (comma separated):', (node.data.buttons || []).join(','));
      if (label !== null || buttons !== null) {
        setNodes((nds) => nds.map((n) => n.id === node.id ? { 
          ...n, 
          data: { 
            ...n.data, 
            label: label || n.data.label, 
            buttons: buttons ? buttons.split(',').map((s: string) => s.trim()) : n.data.buttons 
          } 
        } : n));
      }
    } else if (node.type === 'set_variable') {
      const key = prompt('Enter Variable Key:', node.data.key);
      const value = prompt('Enter Variable Value:', node.data.value);
      if (key !== null || value !== null) {
        setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, key: key || n.data.key, value: value || n.data.value } } : n));
      }
    } else if (node.type === 'add_tag') {
      const tag = prompt('Enter Tag Name:', node.data.tag);
      if (tag !== null) {
        setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, tag } } : n));
      }
    } else if (node.type === 'ai_response') {
      const promptText = prompt('Enter System Prompt (leave empty to use default):', node.data.prompt);
      if (promptText !== null) {
        setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, prompt: promptText } } : n));
      }
    } else {
      const newLabel = prompt('Enter new text:', node.data.label);
      if (newLabel) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === node.id) {
              return { ...n, data: { ...n.data, label: newLabel } };
            }
            return n;
          })
        );
      }
    }
  };

  const handleDeleteSelected = () => {
    const selectedNodes = getNodes().filter(n => n.selected);
    const selectedEdges = getEdges().filter(e => e.selected);
    
    if (selectedNodes.length > 0 || selectedEdges.length > 0) {
      if (confirm(`Delete ${selectedNodes.length} nodes and ${selectedEdges.length} edges?`)) {
        setNodes((nds) => nds.filter((n) => !n.selected));
        setEdges((eds) => eds.filter((e) => !e.selected));
      }
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 p-4 gap-4 overflow-y-auto shadow-sm">
      <div className="flex items-center justify-between lg:hidden mb-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add Nodes</h3>
        <button onClick={() => setIsSidebarOpen(false)} className="p-1 text-gray-500 hover:bg-gray-100 rounded-md">
          <X className="w-5 h-5" />
        </button>
      </div>
      <h3 className="hidden lg:block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Add Nodes</h3>
      
      <button onClick={() => addNode('message')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 text-gray-600">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Text</p>
          <p className="text-xs text-gray-500">Simple text message</p>
        </div>
      </button>

      <button onClick={() => addNode('image')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-indigo-100 group-hover:text-indigo-600 text-gray-600">
          <ImageIcon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Image</p>
          <p className="text-xs text-gray-500">Send a picture</p>
        </div>
      </button>

      <button onClick={() => addNode('quick_replies')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 text-gray-600">
          <List className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Quick Replies</p>
          <p className="text-xs text-gray-500">Text with choice chips</p>
        </div>
      </button>

      <button onClick={() => addNode('buttons')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 text-gray-600">
          <MousePointerClick className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Buttons</p>
          <p className="text-xs text-gray-500">Text with CTA buttons</p>
        </div>
      </button>

      <button onClick={() => addNode('condition')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-amber-100 group-hover:text-amber-600 text-gray-600">
          <GitBranch className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Condition</p>
          <p className="text-xs text-gray-500">Split flow based on rules</p>
        </div>
      </button>

      <button onClick={() => addNode('input')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-purple-100 group-hover:text-purple-600 text-gray-600">
          <Keyboard className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">User Input</p>
          <p className="text-xs text-gray-500">Wait for user reply</p>
        </div>
      </button>

      <button onClick={() => addNode('image')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-pink-500 hover:bg-pink-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-pink-100 group-hover:text-pink-600 text-gray-600">
          <ImageIcon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Image</p>
          <p className="text-xs text-gray-500">Send an image</p>
        </div>
      </button>

      <button onClick={() => addNode('quick_replies')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 text-gray-600">
          <List className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Quick Replies</p>
          <p className="text-xs text-gray-500">Multiple choice options</p>
        </div>
      </button>

      <button onClick={() => addNode('buttons')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-cyan-500 hover:bg-cyan-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-cyan-100 group-hover:text-cyan-600 text-gray-600">
          <MousePointerClick className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Buttons</p>
          <p className="text-xs text-gray-500">Interactive buttons</p>
        </div>
      </button>

      <button onClick={() => addNode('set_variable')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-orange-100 group-hover:text-orange-600 text-gray-600">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Set Variable</p>
          <p className="text-xs text-gray-500">Store user data</p>
        </div>
      </button>

      <button onClick={() => addNode('add_tag')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-teal-100 group-hover:text-teal-600 text-gray-600">
          <Tag className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Add Tag</p>
          <p className="text-xs text-gray-500">Tag the user</p>
        </div>
      </button>

      <button onClick={() => addNode('image')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-500 hover:bg-gray-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 group-hover:text-gray-600 text-gray-600">
          <ImageIcon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Image</p>
          <p className="text-xs text-gray-500">Send an image</p>
        </div>
      </button>

      <button onClick={() => addNode('quick_replies')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 group-hover:text-blue-600 text-gray-600">
          <List className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Quick Replies</p>
          <p className="text-xs text-gray-500">Multiple choice options</p>
        </div>
      </button>

      <button onClick={() => addNode('buttons')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-cyan-500 hover:bg-cyan-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-cyan-100 group-hover:text-cyan-600 text-gray-600">
          <MousePointerClick className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Buttons</p>
          <p className="text-xs text-gray-500">Text with buttons</p>
        </div>
      </button>

      <button onClick={() => addNode('add_tag')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-green-100 group-hover:text-green-600 text-gray-600">
          <Tag className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Add Tag</p>
          <p className="text-xs text-gray-500">Tag the user</p>
        </div>
      </button>

      <button onClick={() => addNode('set_variable')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-orange-100 group-hover:text-orange-600 text-gray-600">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Set Variable</p>
          <p className="text-xs text-gray-500">Save data to user</p>
        </div>
      </button>

      <button onClick={() => addNode('set_variable')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-emerald-100 group-hover:text-emerald-600 text-gray-600">
          <Database className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Set Variable</p>
          <p className="text-xs text-gray-500">Save user data</p>
        </div>
      </button>

      <button onClick={() => addNode('add_tag')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-emerald-100 group-hover:text-emerald-600 text-gray-600">
          <Tag className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Add Tag</p>
          <p className="text-xs text-gray-500">Segment users</p>
        </div>
      </button>

      <button onClick={() => addNode('ai_response')} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-all text-left group">
        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center group-hover:bg-violet-100 group-hover:text-violet-600 text-gray-600">
          <BrainCircuit className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">AI Response</p>
          <p className="text-xs text-gray-500">Generate reply with AI</p>
        </div>
      </button>
      
      <div className="mt-auto p-4 bg-indigo-50 rounded-lg border border-indigo-100">
        <h4 className="text-sm font-semibold text-indigo-900 mb-1">Need help?</h4>
        <p className="text-xs text-indigo-700 mb-3">Learn how to build effective chat flows.</p>
        <a href="#" className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          Read Documentation <ArrowLeft className="w-3 h-3 rotate-180" />
        </a>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Flow Settings</h2>
                  <p className="text-sm text-gray-500">Manage triggers and keywords</p>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Keyword Triggers</h3>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="Enter keyword..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <select
                      value={matchType}
                      onChange={(e) => setMatchType(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="exact">Exact Match</option>
                      <option value="contains">Contains</option>
                      <option value="regex">Regex</option>
                    </select>
                    <button
                      onClick={handleAddKeyword}
                      disabled={!newKeyword.trim() || isAddingKeyword}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {keywords.map(kw => (
                      <div key={kw.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{kw.keyword}</p>
                          <p className="text-xs text-gray-500 uppercase">{kw.match_type}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteKeyword(kw.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {keywords.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4 italic">No keywords defined yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate max-w-[150px] sm:max-w-xs">{flow.name}</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Flow Builder</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Settings</span>
          </button>
          <button
            onClick={handleToggleActive}
            className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${flow.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
          >
            {flow.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden h-full bg-white"
              >
                <SidebarContent />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-64 h-full z-10 border-r border-gray-200 bg-white">
          <SidebarContent />
        </div>

        {/* Canvas */}
        <div className="flex-1 relative h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50"
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Panel position="top-left" className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
              <button className="p-2 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-50" title="Undo (Coming Soon)">
                <Undo className="w-4 h-4" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-50" title="Redo (Coming Soon)">
                <Redo className="w-4 h-4" />
              </button>
              <div className="w-px bg-gray-200 mx-1" />
              <button onClick={handleDeleteSelected} className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded" title="Delete Selected">
                <Trash2 className="w-4 h-4" />
              </button>
            </Panel>
            <Controls className="bg-white border border-gray-200 shadow-sm rounded-md m-4" />
            <MiniMap className="bg-white border border-gray-200 shadow-sm rounded-md m-4 hidden sm:block" />
            <Background color="#e5e7eb" gap={16} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function FlowBuilder(props: any) {
  return (
    <ReactFlowProvider>
      <FlowBuilderContent {...props} />
    </ReactFlowProvider>
  );
}
