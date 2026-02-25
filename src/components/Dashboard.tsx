import React, { useState, useEffect } from 'react';
import { MessageSquare, Settings, LogOut, Plus, Activity, Power, PowerOff, Edit, Menu, X, User, Shield, Trash2, LayoutTemplate, UserPlus, Headphones, BrainCircuit, Save, BarChart3, PieChart, Facebook } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { templates } from '../data/templates';

const WebchatPreview = ({ pageId }: { pageId: string }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [userId] = useState(() => localStorage.getItem('webchat_user_id') || Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    localStorage.setItem('webchat_user_id', userId);
    
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/webchat/messages?pageId=${pageId}&userId=${userId}`);
        const data = await res.json();
        if (Array.isArray(data)) setMessages(data);
      } catch (e) {}
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [pageId, userId]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    
    // Optimistic update
    // setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }]);

    await fetch('/api/webchat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, userId, text })
    });
    // Fetch immediately
    const res = await fetch(`/api/webchat/messages?pageId=${pageId}&userId=${userId}`);
    const data = await res.json();
    if (Array.isArray(data)) setMessages(data);
  };

  return (
    <div className="flex flex-col h-[600px] border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden max-w-md mx-auto">
      <div className="bg-indigo-600 p-4 text-white font-semibold flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <span>Chat with us</span>
        </div>
        <span className="text-xs bg-indigo-500 px-2 py-1 rounded">Preview</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((m: any) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
              m.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10">
            Start a conversation...
          </div>
        )}
      </div>
      <div className="p-4 bg-white border-t border-gray-200 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button 
          onClick={sendMessage}
          className="bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default function Dashboard({ user, onLogout, onSelectFlow }: any) {
  const [pages, setPages] = useState<any[]>([]);
  const [flows, setFlows] = useState<any[]>([]);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [view, setView] = useState<'flows' | 'settings'>('flows');
  const [activeTab, setActiveTab] = useState<'flows' | 'analytics' | 'settings' | 'webchat'>('flows');
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [apiKeys, setApiKeys] = useState({ openai: '', anthropic: '', gemini: '' });

  useEffect(() => {
    fetchPages();
  }, []);

  useEffect(() => {
    if (selectedPage) {
      setAiPrompt(selectedPage.ai_prompt || 'You are a helpful assistant.');
      if (selectedPage.ai_config) {
        try {
          const config = JSON.parse(selectedPage.ai_config);
          setApiKeys({
            openai: config.openai_keys || '',
            anthropic: config.anthropic_keys || '',
            gemini: config.gemini_keys || ''
          });
        } catch (e) {
          console.error("Error parsing AI config", e);
        }
      } else {
        setApiKeys({ openai: '', anthropic: '', gemini: '' });
      }
    }
  }, [selectedPage]);

  const handleSaveApiKeys = async () => {
    if (!selectedPage) return;
    try {
      const res = await fetch(`/api/pages/${selectedPage.id}/ai-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openai_keys: apiKeys.openai,
          anthropic_keys: apiKeys.anthropic,
          gemini_keys: apiKeys.gemini
        })
      });
      if (res.ok) {
        alert('API Keys saved successfully!');
        fetchPages(); // Refresh page data
      }
    } catch (err) {
      console.error("Failed to save API keys", err);
    }
  };

  const fetchPages = async () => {
    const res = await fetch(`/api/pages?userId=${user.id}`);
    const data = await res.json();
    setPages(data.pages);
  };

  const fetchFlows = async (pageId: string) => {
    const res = await fetch(`/api/pages/${pageId}/flows`);
    const data = await res.json();
    setFlows(data.flows);
  };

  const handleSyncPages = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/pages/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (res.ok) {
        fetchPages();
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTogglePage = async (pageId: string) => {
    const res = await fetch(`/api/pages/${pageId}/toggle`, { method: 'POST' });
    if (res.ok) {
      fetchPages();
      if (selectedPage?.id === pageId) {
        setSelectedPage({ ...selectedPage, is_active: !selectedPage.is_active });
      }
    }
  };

  const handleToggleAI = async (enabled: boolean) => {
    const res = await fetch(`/api/pages/${selectedPage.id}/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_enabled: enabled, ai_prompt: aiPrompt })
    });
    if (res.ok) {
      setSelectedPage({ ...selectedPage, ai_enabled: enabled });
      fetchPages();
    }
  };

  const handleSaveAIPrompt = async () => {
    const res = await fetch(`/api/pages/${selectedPage.id}/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_enabled: selectedPage.ai_enabled, ai_prompt: aiPrompt })
    });
    if (res.ok) {
      setSelectedPage({ ...selectedPage, ai_prompt: aiPrompt });
      fetchPages();
      alert('AI Settings Saved!');
    }
  };

  const fetchAnalytics = async (pageId: string) => {
    const res = await fetch(`/api/pages/${pageId}/analytics`);
    const data = await res.json();
    setAnalyticsData(data);
  };

  const handleSelectPage = (page: any) => {
    setSelectedPage(page);
    fetchFlows(page.id);
    setView('flows');
    setActiveTab('flows');
    setIsSidebarOpen(false);
  };

  const handleCreateFlow = async (templateId: string = 'blank') => {
    const name = prompt("Enter Flow Name:");
    if (!name) return;
    
    const template = templates.find(t => t.id === templateId);
    
    const res = await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        pageId: selectedPage.id, 
        name,
        nodes: template?.nodes,
        edges: template?.edges
      })
    });
    
    if (res.ok) {
      fetchFlows(selectedPage.id);
      setIsTemplateModalOpen(false);
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm("Are you sure you want to delete this flow?")) return;
    
    const res = await fetch(`/api/flows/${flowId}`, {
      method: 'DELETE'
    });
    
    if (res.ok) {
      fetchFlows(selectedPage.id);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'UserPlus': return <UserPlus className="w-6 h-6" />;
      case 'Headphones': return <Headphones className="w-6 h-6" />;
      case 'MessageSquare': return <MessageSquare className="w-6 h-6" />;
      default: return <Plus className="w-6 h-6" />;
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
          <MessageSquare className="w-6 h-6" />
          ChatFlow
        </h1>
        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">My Pages</h2>
            <button onClick={handleSyncPages} disabled={isSyncing} className="text-indigo-600 hover:text-indigo-800 disabled:opacity-50 p-1 hover:bg-indigo-50 rounded">
              <Activity className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <ul className="space-y-1">
            {pages.map(page => (
              <li key={page.id}>
                <button
                  onClick={() => handleSelectPage(page)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center justify-between transition-colors ${selectedPage?.id === page.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <span className="truncate">{page.name}</span>
                  <div className={`w-2 h-2 rounded-full ${page.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                </button>
              </li>
            ))}
            {pages.length === 0 && (
              <li className="text-sm text-gray-500 italic px-3 py-2">No pages connected</li>
            )}
          </ul>
        </div>
      </div>
      
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.plan} Plan</p>
          </div>
        </div>
        <button onClick={() => setView('settings')} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 w-full px-2 py-2 rounded-md hover:bg-gray-100 mb-1">
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button onClick={onLogout} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 w-full px-2 py-2 rounded-md hover:bg-red-50">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Template Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Create New Flow</h2>
                  <p className="text-sm text-gray-500">Choose a template to get started quickly</p>
                </div>
                <button onClick={() => setIsTemplateModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleCreateFlow(template.id)}
                      className="flex flex-col text-left bg-white p-6 rounded-xl border-2 border-transparent hover:border-indigo-500 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="w-12 h-12 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        {getIcon(template.icon)}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{template.name}</h3>
                      <p className="text-sm text-gray-500">{template.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              className="fixed inset-y-0 left-0 w-64 z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 h-full">
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full overflow-hidden">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-indigo-600 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              ChatFlow
            </h1>
          </div>
        </div>

        {view === 'settings' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h2>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-500" />
                    Profile Information
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <p className="mt-1 text-gray-900">{user.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <p className="mt-1 text-gray-900">{user.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Facebook User ID</label>
                    <p className="mt-1 text-gray-500 font-mono text-sm">{user.fb_user_id}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-gray-500" />
                    Plan & Usage
                  </h3>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Current Plan</p>
                      <p className="text-xl font-bold text-indigo-600">{user.plan}</p>
                    </div>
                    <button className="px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors">
                      Upgrade Plan
                    </button>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Monthly Messages</span>
                      <span className="text-sm text-gray-500">{user.message_count} / {user.plan === 'Starter' ? '1,000' : user.plan === 'Business' ? '10,000' : '100,000'}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full" 
                        style={{ width: `${Math.min((user.message_count / (user.plan === 'Starter' ? 1000 : user.plan === 'Business' ? 10000 : 100000)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : selectedPage ? (
          <>
            <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{selectedPage.name}</h2>
                <p className="text-sm text-gray-500 mt-1">Manage flows and settings for this page</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTogglePage(selectedPage.id)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors w-full sm:w-auto ${selectedPage.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                >
                  {selectedPage.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  {selectedPage.is_active ? 'Deactivate Bot' : 'Activate Bot'}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-8">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('flows')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'flows' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Chat Flows
                </button>
                <button
                  onClick={() => { setActiveTab('analytics'); fetchAnalytics(selectedPage.id); }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => setActiveTab('webchat')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'webchat' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Webchat
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Settings
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              {activeTab === 'webchat' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900">Webchat Integration</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Preview</h3>
                      <WebchatPreview pageId={selectedPage.id} />
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Installation</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Copy and paste this code into your website's HTML to add the chat widget.
                        </p>
                        <div className="bg-gray-900 rounded-lg p-4 relative group">
                          <code className="text-sm text-gray-300 font-mono break-all">
                            {`<script src="${window.location.origin}/webchat.js?pageId=${selectedPage.id}"></script>`}
                          </code>
                          <button 
                            onClick={() => navigator.clipboard.writeText(`<script src="${window.location.origin}/webchat.js?pageId=${selectedPage.id}"></script>`)}
                            className="absolute top-2 right-2 p-2 bg-gray-800 text-gray-400 rounded hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <span className="text-xs">Copy</span>
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                        <h3 className="text-lg font-medium text-blue-900 mb-2">Multi-Channel Support</h3>
                        <p className="text-sm text-blue-700">
                          This webchat uses the same flows and AI as your Messenger bot. 
                          Changes made in the Flow Builder apply instantly to all channels.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'analytics' && analyticsData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">Total Messages</h3>
                        <MessageSquare className="w-5 h-5 text-indigo-600" />
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{analyticsData.totalMessages}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">Active Users</h3>
                        <User className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{analyticsData.activeUsers}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">Flows Triggered</h3>
                        <Activity className="w-5 h-5 text-orange-600" />
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{analyticsData.totalFlows}</p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-6">Message Activity (Last 7 Days)</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analyticsData.messagesOverTime}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'settings' ? (
                /* AI Settings Section */
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600">
                          <BrainCircuit className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">AI Assistant</h3>
                          <p className="text-sm text-gray-500">Enable AI to handle unmatched messages</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={selectedPage.ai_enabled || false}
                          onChange={(e) => handleToggleAI(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                      </label>
                    </div>
                    
                    {selectedPage.ai_enabled && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Default System Prompt</label>
                        <textarea
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-violet-500 focus:border-violet-500 text-sm"
                          rows={3}
                          placeholder="You are a helpful assistant..."
                        />
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={handleSaveAIPrompt}
                            className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 text-white rounded-md text-sm hover:bg-violet-700"
                          >
                            <Save className="w-4 h-4" />
                            Save Prompt
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* API Keys Configuration */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">AI Provider Keys</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Configure API keys for external providers. Separate multiple keys with commas for rotation.
                      Gemini is provided by default, but you can add your own keys for higher limits.
                    </p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">OpenAI API Keys (GPT-4, GPT-3.5)</label>
                        <input
                          type="password"
                          value={apiKeys.openai}
                          onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                          placeholder="sk-..., sk-..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Keys (Claude 3)</label>
                        <input
                          type="password"
                          value={apiKeys.anthropic}
                          onChange={(e) => setApiKeys({ ...apiKeys, anthropic: e.target.value })}
                          placeholder="sk-ant-..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                       <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Google Gemini API Keys</label>
                        <input
                          type="password"
                          value={apiKeys.gemini}
                          onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                          placeholder="AIza..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button 
                          onClick={handleSaveApiKeys}
                          className="px-4 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-800"
                        >
                          Save Keys
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* AI Test Section */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Test AI Configuration</h3>
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Provider / Model</label>
                        <select id="test-provider" className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                          <option value="google:gemini-3-flash-preview">Google Gemini (Flash)</option>
                          <option value="openai:gpt-4o">OpenAI (GPT-4o)</option>
                          <option value="anthropic:claude-3-opus-20240229">Anthropic (Claude 3)</option>
                        </select>
                      </div>
                      <button 
                        onClick={async () => {
                          const select = document.getElementById('test-provider') as HTMLSelectElement;
                          const [provider, model] = select.value.split(':');
                          try {
                            const res = await fetch(`/api/pages/${selectedPage.id}/ai/test`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ provider, model, message: "Hello, are you working?" })
                            });
                            const data = await res.json();
                            if (data.error) alert(`Error: ${data.error}`);
                            else alert(`Success! Response: ${data.response}`);
                          } catch (e) {
                            alert('Test failed');
                          }
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700"
                      >
                        Test Connection
                      </button>
                    </div>
                  </div>

                  {/* Facebook App Setup Guide */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <Facebook className="w-5 h-5 text-[#1877F2]" />
                      Facebook App Setup Guide
                    </h3>
                    <div className="space-y-4 text-sm text-gray-600">
                      <p>Ensure your Facebook App is configured with the following settings in the Meta Developers Portal:</p>
                      
                      <div className="bg-gray-50 p-4 rounded-lg space-y-3 font-mono text-xs">
                        <div>
                          <p className="text-gray-500 mb-1 uppercase font-bold">OAuth Redirect URI</p>
                          <code className="bg-white p-1 border border-gray-200 rounded block">
                            {window.location.origin}/api/auth/facebook/callback
                          </code>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1 uppercase font-bold">Webhook URL</p>
                          <code className="bg-white p-1 border border-gray-200 rounded block">
                            {window.location.origin}/webhook
                          </code>
                        </div>
                        <div>
                          <p className="text-gray-500 mb-1 uppercase font-bold">Webhook Verify Token</p>
                          <code className="bg-white p-1 border border-gray-200 rounded block">
                            pagebot
                          </code>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="font-medium text-gray-900">Required Permissions:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>pages_messaging</li>
                          <li>pages_show_list</li>
                          <li>pages_manage_metadata</li>
                          <li>pages_read_engagement</li>
                        </ul>
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                        <p className="font-bold mb-1">Important:</p>
                        <p>If you are in "Development Mode", only App Admins/Testers can connect. Switch to "Live Mode" for public access.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Flows Tab Content */
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h3 className="text-lg font-medium text-gray-900">Chat Flows</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/pages/${selectedPage.id}/flows/default`, { method: 'POST' });
                            const data = await res.json();
                            if (data.success) {
                              alert('Default AI Flow created successfully!');
                              // Refresh flows
                              const flowsRes = await fetch(`/api/pages/${selectedPage.id}/flows`);
                              const flowsData = await flowsRes.json();
                              setFlows(flowsData.flows);
                            } else {
                              alert(data.message || 'Failed to create flow');
                            }
                          } catch (e) {
                            alert('Error creating flow');
                          }
                        }}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-md text-sm font-medium hover:bg-violet-700 transition-colors w-full sm:w-auto"
                      >
                        <BrainCircuit className="w-4 h-4" />
                        Create Default AI Flow
                      </button>
                      <button
                        onClick={() => setIsTemplateModalOpen(true)}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors w-full sm:w-auto"
                      >
                        <Plus className="w-4 h-4" />
                        Create Flow
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {flows.map(flow => (
                      <div key={flow.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group relative">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteFlow(flow.id); }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Activity className="w-5 h-5" />
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${flow.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {flow.is_active ? 'Active' : 'Draft'}
                          </span>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-1 truncate pr-8">{flow.name}</h4>
                        <p className="text-sm text-gray-500 mb-6">Last updated recently</p>
                        
                        <button
                          onClick={() => onSelectFlow(flow)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Flow
                        </button>
                      </div>
                    ))}
                    {flows.length === 0 && (
                      <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No flows yet</h3>
                        <p className="text-sm text-gray-500 mb-4">Create your first chat flow to get started.</p>
                        <button
                          onClick={() => setIsTemplateModalOpen(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Create Flow
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
            <div className="text-center max-w-md w-full">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to ChatFlow</h2>
              <p className="text-gray-500 mb-6">Select a Facebook page from the sidebar or connect a new one to start building your chat automation.</p>
              <button
                onClick={handleSyncPages}
                disabled={isSyncing}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
              >
                <Activity className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Facebook Pages'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
