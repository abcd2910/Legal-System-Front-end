'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cases as casesApi, documents as docsApi, chat as chatApi, tools as toolsApi } from '@/lib/api';
import type { CaseStatus, CaseRole, CaseUpdateBody } from '@/lib/api';
import { useEmbedScriptLoader } from '@/lib/useEmbedScriptLoader';
import { useViasocketEvents } from '@/lib/useViasocketEvents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  ArrowLeft, Send, Plus, FileText, Link2, Type, Upload, Loader2,
  Scale, Calendar, Building2, Hash, Briefcase, MessageSquare,
  Sparkles, FolderOpen, Clock, Wrench, Settings, PanelLeft, Users,
} from 'lucide-react';

export default function CaseDetailPage() {
  const params = useParams();
  const caseId = params?.id as string;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Case data
  const [caseData, setCaseData] = useState<any>(null);
  const [loadingCase, setLoadingCase] = useState(true);

  // Documents
  const [docs, setDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadType, setUploadType] = useState<'PDF' | 'TEXT' | 'LINK'>('PDF');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadContent, setUploadContent] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Chat
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Mobile: which pane is active
  const [mobilePane, setMobilePane] = useState<'chat' | 'info'>('chat');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  // Viasocket Tools Embed
  const [embedToken, setEmbedToken] = useState<string | null>(null);

  useEffect(() => {
    if (caseId) {
      toolsApi.getToken(caseId).then(res => {
        if (res.success && res.data) {
          setEmbedToken(res.data);
        }
      }).catch(err => {
        console.error("Failed to fetch viasocket token:", err);
      });
    }
  }, [caseId]);

  useEmbedScriptLoader(embedToken);

  const [caseTools, setCaseTools] = useState<any[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);

  const fetchTools = async () => {
    if (!caseId) return;
    try {
      const res = await toolsApi.list(caseId);
      setCaseTools(res.data || []);
    } catch (err) {
      console.error('Failed to fetch tools', err);
    } finally {
      setLoadingTools(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, [caseId]);

  useViasocketEvents(caseId, fetchTools);

  const handleOpenViasocket = (scriptId?: string) => {
    if (!embedToken) {
      alert("Viasocket token is not loaded yet. Please wait.");
      return;
    }

    if (typeof window !== 'undefined' && window.openViasocket) {
      try {
        window.openViasocket(scriptId, {
          embedToken: embedToken,
          meta: {
            type: "tool",
            createFrom: "CASE_DASHBOARD"
          }
        });
      } catch (err: any) {
        console.error("Viasocket Embed Error:", err);
        alert("Failed to open Viasocket Builder. Please verify your Viasocket Access Key and configurations in backend/.env are correct.");
      }
    } else {
      alert("Builder is still loading. Please try again in a moment.");
    }
  };

  // Instructions
  const [instructions, setInstructions] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);

  // Edit Case Details States
  const [showEditCase, setShowEditCase] = useState(false);
  const [updatingCase, setUpdatingCase] = useState(false);
  const [editCaseForm, setEditCaseForm] = useState({
    title: '',
    case_number: '',
    court: '',
    case_type: '',
    status: 'OPEN'
  });

  // Members
  const [members, setMembers] = useState<any[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CaseRole>('VIEWER');
  const [inviting, setInviting] = useState(false);

  // Fetch case details
  useEffect(() => {
    if (caseId) {
      casesApi.get(caseId).then(res => {
        setCaseData(res.data);
        setInstructions(res.data?.instructions || '');
        setEditCaseForm({
          title: res.data?.title || '',
          case_number: res.data?.case_number || '',
          court: res.data?.court || '',
          case_type: res.data?.case_type || '',
          status: res.data?.status || 'OPEN'
        });
        setLoadingCase(false);
      }).catch(() => setLoadingCase(false));
    }
  }, [caseId]);

  const handleUpdateCase = async () => {
    setUpdatingCase(true);
    try {
      const res = await casesApi.update(caseId, editCaseForm as CaseUpdateBody);
      setCaseData((prev: any) => ({ ...prev, ...res.data }));
      alert('Case updated successfully.');
      setShowEditCase(false);
    } catch (err: any) {
      alert('Failed to update case: ' + err.message);
    } finally {
      setUpdatingCase(false);
    }
  };

  const handleQuickStatusUpdate = async (newStatus: CaseStatus) => {
    try {
      const res = await casesApi.update(caseId, { status: newStatus });
      setCaseData((prev: any) => ({ ...prev, ...res.data }));
      setEditCaseForm(p => ({ ...p, status: newStatus }));
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleSaveInstructions = async () => {
    setSavingInstructions(true);
    try {
      const res = await casesApi.update(caseId, { instructions });
      setCaseData(res.data || { ...caseData, instructions });
      alert('Instructions saved successfully.');
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSavingInstructions(false);
    }
  };

  // Fetch documents
  useEffect(() => {
    if (caseId) {
      docsApi.list(caseId).then(res => {
        const items = Array.isArray(res.data) ? res.data : (res.data?.resources || []);
        setDocs(items);
        setLoadingDocs(false);
      }).catch(() => setLoadingDocs(false));
    }
  }, [caseId]);

  // Fetch chat threads
  useEffect(() => {
    if (caseId) {
      chatApi.listThreads(caseId).then(res => {
        setThreads(res.data || []);
      }).catch(() => {});
    }
  }, [caseId]);

  // Fetch history when active thread changes
  useEffect(() => {
    if (activeThread) {
      setLoadingHistory(true);
      chatApi.getHistory(caseId, activeThread.id).then(res => {
        setMessages(res.data || []);
        setLoadingHistory(false);
      }).catch(() => {
        setMessages([]);
        setLoadingHistory(false);
      });
    }
  }, [activeThread, caseId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [uploadDescription, setUploadDescription] = useState('');

  const handleUpload = async () => {
    if (!uploadTitle.trim()) {
      alert('Title is required.');
      return;
    }
    if (!uploadDescription.trim()) {
      alert('Description is required.');
      return;
    }
    if (uploadType === 'LINK' && !uploadContent.trim()) {
      alert('URL is required for Link type.');
      return;
    }
    if (uploadType === 'TEXT' && !uploadContent.trim()) {
      alert('Content is required for Text type.');
      return;
    }
    if (uploadType === 'PDF' && !uploadFile) {
      alert('Please select a PDF file.');
      return;
    }
    setUploading(true);
    try {
      if (uploadType === 'PDF' && uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('title', uploadTitle || uploadFile.name);
        formData.append('type', 'PDF');
        if (uploadDescription) formData.append('description', uploadDescription);
        await docsApi.create(caseId, formData);
      } else if (uploadType === 'LINK') {
        await docsApi.create(caseId, {
          type: 'LINK',
          title: uploadTitle,
          url: uploadContent,
          description: uploadDescription,
        });
      } else {
        await docsApi.create(caseId, {
          type: 'TEXT',
          title: uploadTitle,
          content: uploadContent,
          description: uploadDescription,
        });
      }
      // Refresh docs
      const res = await docsApi.list(caseId);
      const items = Array.isArray(res.data) ? res.data : (res.data?.resources || []);
      setDocs(items);
      setShowUpload(false);
      setUploadTitle('');
      setUploadContent('');
      setUploadDescription('');
      setUploadFile(null);
    } catch (err: any) {
      alert('Upload failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleNewThread = async () => {
    const res = await chatApi.createThread(caseId, `Chat ${threads.length + 1}`);
    const newThread = res.chat;
    setThreads(prev => [newThread, ...prev]);
    setActiveThread(newThread);
    setMessages([]);
    // On mobile, switch to chat pane after creating thread
    setMobilePane('chat');
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeThread) return;
    const msg = chatInput.trim();
    setChatInput('');
    setSendingMsg(true);

    // Consolidate optimistic UI update to prevent batching race conditions
    setMessages(prev => [
      ...prev,
      { role: 'user', content: msg },
      { role: 'assistant', content: '' }
    ]);

    try {
      await chatApi.sendMessageStream(
        caseId,
        activeThread.id,
        msg,
        (delta) => {
          console.log("Received delta chunk:", delta);
          // Append each delta chunk to the last assistant message
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + delta };
            } else {
              console.warn("Last message is not assistant! It is:", last);
            }
            return updated;
          });
        }
      );
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant' && last.content === '') {
          updated[updated.length - 1] = { role: 'assistant', content: 'Error: ' + err.message };
        }
        return updated;
      });
    } finally {
      setSendingMsg(false);
    }
  };

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await casesApi.members.list(caseId);
      setMembers(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (showMembers) fetchMembers();
  }, [showMembers]);

  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      alert('Please enter an email address.');
      return;
    }
    setInviting(true);
    try {
      await casesApi.members.add(caseId, { email: inviteEmail.trim(), role: inviteRole });
      alert('Member invited successfully!');
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const statusColor: Record<string, string> = {
    OPEN: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    CLOSED: 'bg-red-500/15 text-red-400 border-red-500/20',
    ARCHIVED: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  };

  if (authLoading || loadingCase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Shared Left Pane Content ──
  const leftPaneContent = (
    <div className="space-y-6">
      {/* Case Info */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Briefcase className="w-3 h-3" /> Case Details
        </h3>
        <div className="space-y-2.5">
          {caseData?.case_number && (
            <div className="flex items-center gap-2 text-sm">
              <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Number:</span>
              <span className="font-mono text-xs">{caseData.case_number}</span>
            </div>
          )}
          {caseData?.court && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Court:</span>
              <span>{caseData.court}</span>
            </div>
          )}
          {caseData?.case_type && (
            <div className="flex items-center gap-2 text-sm">
              <Scale className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Type:</span>
              <span>{caseData.case_type}</span>
            </div>
          )}
          {caseData?.next_hearing_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Next Hearing:</span>
              <span>{new Date(caseData.next_hearing_date).toLocaleDateString()}</span>
            </div>
          )}
          {caseData?.filing_date && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Filed:</span>
              <span>{new Date(caseData.filing_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
        {caseData?.description && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
            {caseData.description}
          </p>
        )}
      </div>

      <Separator className="opacity-30" />

      {/* Case Instructions */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-primary" /> AI Instructions
        </h3>
        <div className="space-y-2">
          <Textarea
            placeholder="E.g. Focus on liability clauses, translate latin terms..."
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
            rows={4}
            className="text-xs bg-background/50 border-white/[0.04] focus:border-primary/50"
          />
          <Button
            onClick={handleSaveInstructions}
            disabled={savingInstructions}
            size="sm"
            className="w-full text-xs font-semibold"
          >
            {savingInstructions ? 'Saving...' : 'Save Instructions'}
          </Button>
        </div>
      </div>

      <Separator className="opacity-30" />

      {/* Documents Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <FolderOpen className="w-3 h-3" /> Documents
          </h3>
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger render={<Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10 hover:text-primary" />}>
              <Plus className="w-3.5 h-3.5" />
            </DialogTrigger>
            <DialogContent className="bg-card/95 backdrop-blur-xl border-white/5 mx-4 max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Document</DialogTitle>
              </DialogHeader>
              <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as any)} className="pt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="PDF" className="flex-1 gap-1.5"><Upload className="w-3.5 h-3.5" />PDF</TabsTrigger>
                  <TabsTrigger value="TEXT" className="flex-1 gap-1.5"><Type className="w-3.5 h-3.5" />Text</TabsTrigger>
                  <TabsTrigger value="LINK" className="flex-1 gap-1.5"><Link2 className="w-3.5 h-3.5" />Link</TabsTrigger>
                </TabsList>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Title <span className="text-red-400">*</span></Label>
                    <Input placeholder="E.g. Witness Statement" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="bg-background/50" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description <span className="text-red-400">*</span></Label>
                    <Input placeholder="Brief description of this document" value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} className="bg-background/50" />
                  </div>
                  <TabsContent value="PDF" className="mt-0 space-y-2">
                    <Label>PDF File <span className="text-red-400">*</span></Label>
                    <Input type="file" accept=".pdf" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="bg-background/50" />
                  </TabsContent>
                  <TabsContent value="TEXT" className="mt-0 space-y-2">
                    <Label>Text Content <span className="text-red-400">*</span></Label>
                    <Textarea placeholder="Paste text content..." value={uploadContent} onChange={e => setUploadContent(e.target.value)} rows={5} className="bg-background/50" />
                  </TabsContent>
                  <TabsContent value="LINK" className="mt-0 space-y-2">
                    <Label>URL <span className="text-red-400">*</span></Label>
                    <Input placeholder="https://..." value={uploadContent} onChange={e => setUploadContent(e.target.value)} className="bg-background/50" />
                  </TabsContent>
                  <Button onClick={handleUpload} disabled={uploading} className="w-full bg-gradient-to-r from-primary to-primary/80 text-white">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Upload
                  </Button>
                </div>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>

        {loadingDocs ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
        ) : docs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No documents yet</p>
        ) : (
          <div className="space-y-1.5">
            {docs.map((doc: any, i: number) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-colors text-sm group">
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate flex-1">{doc.title || doc.name || `Document ${i + 1}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator className="opacity-30" />

      {/* Tools Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Wrench className="w-3 h-3" /> API Tools
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10 hover:text-primary" onClick={() => handleOpenViasocket()}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {loadingTools ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mx-auto" />
        ) : caseTools.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No tools created</p>
        ) : (
          <div className="space-y-1.5">
            {caseTools.map((tool: any, i: number) => (
              <div key={tool.id || i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-colors text-sm group">
                <div className="flex items-center gap-2 truncate flex-1 pr-2">
                  <Settings className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{tool.title || `Tool ${i + 1}`}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={() => handleOpenViasocket(tool.script_id)}
                >
                  <Settings className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Chat Pane Content ──
  const chatPaneContent = (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat Tabs */}
      <div className="h-12 border-b border-white/5 bg-card/20 flex items-center gap-2 px-3 md:px-4 shrink-0 overflow-x-auto">
        <Button variant="ghost" size="sm" onClick={handleNewThread} className="h-7 gap-1.5 text-xs hover:bg-primary/10 hover:text-primary shrink-0">
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Chat</span>
          <span className="sm:hidden">New</span>
        </Button>
        <Separator orientation="vertical" className="h-5 opacity-30" />
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
          {threads.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveThread(t)}
              className={`h-7 px-2 md:px-3 rounded-md text-xs whitespace-nowrap transition-all shrink-0 ${
                activeThread?.id === t.id
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-3 h-3 inline mr-1" />
              <span className="max-w-[80px] md:max-w-none truncate inline-block align-middle">{t.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-3 md:p-5">
        {!activeThread ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12 md:py-20 px-4">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Sparkles className="w-7 h-7 md:w-8 md:h-8 text-primary" />
            </div>
            <h3 className="font-heading font-semibold text-base md:text-lg">AI Legal Assistant</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Start a new chat to ask questions about your case, add hearing updates, or schedule reminders.
            </p>
          </div>
        ) : loadingHistory ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] md:max-w-[80%] px-3 md:px-4 py-2.5 md:py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-primary to-primary/80 text-white rounded-br-md'
                      : 'bg-white/[0.04] border border-white/5 text-foreground rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sendingMsg && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/5">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:0.15s]" />
                    <div className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Chat Input */}
      {activeThread && (
        <div className="p-3 md:p-4 border-t border-white/5 bg-card/20 backdrop-blur-xl shrink-0">
          <div className="flex gap-2 md:gap-3 max-w-3xl mx-auto">
            <Input
              placeholder="Ask about your case..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              disabled={sendingMsg}
              className="flex-1 bg-background/50 text-sm"
            />
            <Button
              onClick={handleSendMessage}
              disabled={sendingMsg || !chatInput.trim()}
              className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25 px-3 md:px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top Bar ── */}
      <header className="h-12 md:h-14 border-b border-white/5 bg-card/30 backdrop-blur-xl flex items-center gap-2 md:gap-4 px-3 md:px-5 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="h-8 w-8 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Scale className="w-4 h-4 text-primary shrink-0 hidden sm:block" />
          <span className="font-heading font-semibold truncate text-sm md:text-base">{caseData?.title}</span>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor[caseData?.status] || ''}`}>
            {caseData?.status}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Quick status change buttons — hidden on very small screens */}
          {caseData?.status === 'OPEN' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hidden sm:inline-flex"
              onClick={() => handleQuickStatusUpdate('CLOSED')}
            >
              Close Case
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 hidden sm:inline-flex"
              onClick={() => handleQuickStatusUpdate('OPEN')}
            >
              Reopen Case
            </Button>
          )}

          {/* Manage Members dialog */}
          <Dialog open={showMembers} onOpenChange={setShowMembers}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs border-primary/20 hover:border-primary/50" />}>
              <span className="hidden sm:inline">Manage Members</span>
              <span className="sm:hidden"><Users className="w-3.5 h-3.5" /></span>
            </DialogTrigger>
            <DialogContent className="bg-card/95 backdrop-blur-xl border-white/5 max-w-2xl mx-4">
              <DialogHeader>
                <DialogTitle>Case Members</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <Input 
                    placeholder="Invite by email address..." 
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="bg-background/50 flex-1"
                  />
                  <div className="flex gap-2">
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as CaseRole)}
                      className="h-9 px-3 rounded-md bg-background/50 border border-border text-sm outline-none focus:border-primary flex-1 sm:flex-none"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="EDITOR">Editor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <Button 
                      onClick={handleInviteMember}
                      disabled={inviting || !inviteEmail.trim()}
                      className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-md shadow-primary/20"
                    >
                      {inviting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Invite
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Current Members</h4>
                  <ScrollArea className="h-[200px] sm:h-[250px] rounded-lg border border-white/5 bg-background/20 p-4">
                    {loadingMembers ? (
                      <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                    ) : members.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No explicit members added.</p>
                    ) : (
                      <div className="space-y-2">
                        {members.map(member => (
                          <div key={member.user_id} className="flex items-center justify-between p-3 rounded-md bg-white/[0.02] border border-white/5">
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-medium truncate">{member.name}</span>
                              <span className="text-xs text-muted-foreground truncate">{member.email}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                {member.role}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Full Case Details Edit dialog */}
          <Dialog open={showEditCase} onOpenChange={setShowEditCase}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs border-primary/20 hover:border-primary/50" />}>
              <span className="hidden sm:inline">Edit Case</span>
              <span className="sm:hidden"><Settings className="w-3.5 h-3.5" /></span>
            </DialogTrigger>
            <DialogContent className="bg-card/95 backdrop-blur-xl border-white/5 mx-4 max-w-lg">
              <DialogHeader>
                <DialogTitle>Update Case Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={editCaseForm.title}
                    onChange={e => setEditCaseForm(p => ({ ...p, title: e.target.value }))}
                    className="bg-background/50"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Case Number</Label>
                    <Input
                      value={editCaseForm.case_number}
                      onChange={e => setEditCaseForm(p => ({ ...p, case_number: e.target.value }))}
                      className="bg-background/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Court</Label>
                    <Input
                      value={editCaseForm.court}
                      onChange={e => setEditCaseForm(p => ({ ...p, court: e.target.value }))}
                      className="bg-background/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Case Type</Label>
                  <Input
                    value={editCaseForm.case_type}
                    onChange={e => setEditCaseForm(p => ({ ...p, case_type: e.target.value }))}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    value={editCaseForm.status}
                    onChange={e => setEditCaseForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full h-9 px-3 rounded-md bg-background/50 border border-border text-sm outline-none focus:border-primary"
                  >
                    <option value="OPEN">Open</option>
                    <option value="CLOSED">Closed</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                <Button onClick={handleUpdateCase} disabled={updatingCase} className="w-full bg-gradient-to-r from-primary to-primary/80 text-white">
                  {updatingCase ? 'Saving...' : 'Save Details'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* ── Desktop: Three-Pane Layout ── */}
      <div className="flex-1 hidden md:flex overflow-hidden">
        {/* LEFT PANE: Case Details */}
        <aside className="w-80 border-r border-white/5 bg-card/30 backdrop-blur-xl flex flex-col shrink-0 overflow-hidden">
          <ScrollArea className="flex-1 p-5">
            {leftPaneContent}
          </ScrollArea>
        </aside>

        {/* MIDDLE PANE: Chat */}
        {chatPaneContent}
      </div>

      {/* ── Mobile: Tabbed Layout ── */}
      <div className="flex-1 flex flex-col md:hidden overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {mobilePane === 'info' ? (
            <ScrollArea className="flex-1 p-4">
              {leftPaneContent}
            </ScrollArea>
          ) : (
            chatPaneContent
          )}
        </div>

        {/* Mobile Bottom Tab Bar */}
        <div className="h-14 border-t border-white/5 bg-card/50 backdrop-blur-xl flex items-center shrink-0">
          <button
            onClick={() => setMobilePane('chat')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              mobilePane === 'chat' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Chat</span>
          </button>
          <div className="w-px h-6 bg-white/5" />
          <button
            onClick={() => setMobilePane('info')}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-colors ${
              mobilePane === 'info' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <PanelLeft className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Case Info</span>
          </button>
        </div>
      </div>
    </div>
  );
}
