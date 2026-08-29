'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { organisations as orgApi, cases as casesApi } from '@/lib/api';
import type { OrgRole } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Scale, Plus, Building2, Briefcase, LogOut, Loader2, ChevronRight,
  Users, Calendar, Search, Sparkles, Menu, X,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [orgs, setOrgs] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [casesList, setCasesList] = useState<any[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingCases, setLoadingCases] = useState(false);
  const [search, setSearch] = useState('');

  // Mobile sidebar toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dialogs
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [showNewCase, setShowNewCase] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [newCase, setNewCase] = useState({ title: '', description: '', case_number: '', court: '', case_type: '' });

  // Invite member dialog
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('VIEWER');
  const [inviting, setInviting] = useState(false);

  const handleInviteMember = async () => {
    if (!inviteEmail.trim() || !selectedOrg) return;
    setInviting(true);
    try {
      await orgApi.members.add(selectedOrg.id, { email: inviteEmail.trim(), role: inviteRole });
      alert('Member invited successfully!');
      setShowInvite(false);
      setInviteEmail('');
      setInviteRole('VIEWER');
    } catch (err: any) {
      alert('Failed to invite: ' + err.message);
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      orgApi.list().then(res => {
        setOrgs(res.data || []);
        setLoadingOrgs(false);
      }).catch(() => setLoadingOrgs(false));
    }
  }, [user]);

  useEffect(() => {
    if (selectedOrg) {
      setLoadingCases(true);
      casesApi.list(selectedOrg.id).then(res => {
        setCasesList(res.data || []);
        setLoadingCases(false);
      }).catch(() => setLoadingCases(false));
    }
  }, [selectedOrg]);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    const res = await orgApi.create({ name: newOrgName, description: newOrgDesc });
    setOrgs(prev => [...prev, { ...res.data, role: 'ADMIN' }]);
    setShowNewOrg(false);
    setNewOrgName('');
    setNewOrgDesc('');
  };

  const handleCreateCase = async () => {
    if (!newCase.title.trim() || !selectedOrg) return;
    const res = await casesApi.create(selectedOrg.id, newCase);
    setCasesList(prev => [...prev, { ...res.data, role: 'ADMIN' }]);
    setShowNewCase(false);
    setNewCase({ title: '', description: '', case_number: '', court: '', case_type: '' });
  };

  const filteredCases = casesList.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.case_number?.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor: Record<string, string> = {
    OPEN: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    CLOSED: 'bg-red-500/15 text-red-400 border-red-500/20',
    ARCHIVED: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  };

  const handleSelectOrg = (org: any) => {
    setSelectedOrg(org);
    setSidebarOpen(false); // Close drawer on mobile after selection
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  // ── Sidebar Content (shared between desktop sidebar and mobile drawer) ──
  const sidebarContent = (
    <>
      <div className="p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <Scale className="w-5 h-5 text-white" />
        </div>
        <span className="font-heading font-semibold text-lg tracking-tight">LegalDesk</span>
        {/* Close button only on mobile */}
        <button onClick={() => setSidebarOpen(false)} className="ml-auto md:hidden p-1 rounded-md hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>

      <Separator className="opacity-50" />

      <div className="p-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Organisations</span>
        <Dialog open={showNewOrg} onOpenChange={setShowNewOrg}>
          <DialogTrigger render={<Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-indigo-500/10 hover:text-indigo-400" />}>
            <Plus className="w-4 h-4" />
          </DialogTrigger>
          <DialogContent className="bg-card/95 backdrop-blur-xl border-white/5">
            <DialogHeader>
              <DialogTitle>New Organisation</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="Doe & Associates" value={newOrgName} onChange={e => setNewOrgName(e.target.value)} className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="Corporate law firm" value={newOrgDesc} onChange={e => setNewOrgDesc(e.target.value)} className="bg-background/50" />
              </div>
              <Button onClick={handleCreateOrg} className="w-full bg-gradient-to-r from-primary to-primary/80 text-white">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1 px-3">
        {loadingOrgs ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No organisations yet</p>
        ) : (
          <div className="space-y-1">
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => handleSelectOrg(org)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all duration-200 group ${
                  selectedOrg?.id === org.id
                    ? 'bg-primary/10 text-primary shadow-sm font-semibold'
                    : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{org.name}</span>
                <Badge variant="outline" className="text-[10px] opacity-60 hidden sm:inline-flex">{org.role}</Badge>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator className="opacity-50" />
      <div className="p-4">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── Mobile Overlay Backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar: hidden on mobile, visible on md+ ── */}
      <aside className="hidden md:flex w-72 border-r border-white/5 bg-card/50 backdrop-blur-xl flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* ── Mobile Drawer Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-card/95 backdrop-blur-2xl border-r border-white/5 flex flex-col transform transition-transform duration-300 ease-in-out md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 md:h-16 border-b border-white/5 bg-card/30 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Hamburger button for mobile */}
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-1.5 rounded-lg hover:bg-white/10 shrink-0">
              <Menu className="w-5 h-5" />
            </button>
            {selectedOrg ? (
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 text-primary shrink-0 hidden sm:block" />
                <span className="font-semibold truncate max-w-[120px] sm:max-w-none">{selectedOrg.name}</span>
                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 hidden sm:block" />
                <span className="text-muted-foreground text-sm hidden sm:inline">Cases</span>
                
                <Dialog open={showInvite} onOpenChange={setShowInvite}>
                  <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 text-xs border-primary/20 hover:border-primary/50 gap-1 ml-2 hidden sm:inline-flex" />}>
                    <Users className="w-3.5 h-3.5" />
                    Invite
                  </DialogTrigger>
                  <DialogContent className="bg-card/95 backdrop-blur-xl border-white/5 mx-4">
                    <DialogHeader>
                      <DialogTitle>Invite to {selectedOrg.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Email Address</Label>
                        <Input
                          placeholder="lawyer@firm.com"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <select
                          value={inviteRole}
                          onChange={e => setInviteRole(e.target.value as OrgRole)}
                          className="w-full h-8 px-2 rounded-lg bg-background/50 border border-border text-sm outline-none focus:border-primary"
                        >
                          <option value="VIEWER">Viewer</option>
                          <option value="EDITOR">Editor</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                      <Button onClick={handleInviteMember} disabled={inviting} className="w-full bg-gradient-to-r from-primary to-primary/80 text-white">
                        {inviting ? 'Inviting...' : 'Send Invitation'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <span className="text-muted-foreground text-sm">Select an organisation</span>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Mobile invite button */}
            {selectedOrg && (
              <Dialog open={showInvite} onOpenChange={setShowInvite}>
                <DialogTrigger render={<Button variant="outline" size="icon" className="h-8 w-8 border-primary/20 sm:hidden" />}>
                  <Users className="w-4 h-4" />
                </DialogTrigger>
              </Dialog>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-primary/10">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>

        {/* Cases Grid */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {!selectedOrg ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 md:w-10 md:h-10 text-primary" />
              </div>
              <h2 className="text-xl md:text-2xl font-heading font-semibold">Welcome to LegalDesk</h2>
              <p className="text-muted-foreground max-w-sm text-sm md:text-base">
                {/* Slightly different message on mobile */}
                <span className="hidden md:inline">Select an organisation from the sidebar to view your cases, or create a new one to get started.</span>
                <span className="md:hidden">Tap the <Menu className="w-4 h-4 inline" /> menu to select an organisation, or create a new one.</span>
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 md:mb-6">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search cases..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 bg-background/50"
                  />
                </div>
                <Dialog open={showNewCase} onOpenChange={setShowNewCase}>
                  <DialogTrigger render={<Button className="bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/25 w-full sm:w-auto" />}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Case
                  </DialogTrigger>
                  <DialogContent className="bg-card/95 backdrop-blur-xl border-white/5 mx-4">
                    <DialogHeader>
                      <DialogTitle>Create New Case</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Title *</Label>
                        <Input placeholder="Doe vs State" value={newCase.title} onChange={e => setNewCase(p => ({ ...p, title: e.target.value }))} className="bg-background/50" />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Case Number</Label>
                          <Input placeholder="CIV-2024-001" value={newCase.case_number} onChange={e => setNewCase(p => ({ ...p, case_number: e.target.value }))} className="bg-background/50" />
                        </div>
                        <div className="space-y-2">
                          <Label>Court</Label>
                          <Input placeholder="High Court" value={newCase.court} onChange={e => setNewCase(p => ({ ...p, court: e.target.value }))} className="bg-background/50" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Case Type</Label>
                        <Input placeholder="Civil / Criminal / Corporate" value={newCase.case_type} onChange={e => setNewCase(p => ({ ...p, case_type: e.target.value }))} className="bg-background/50" />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input placeholder="Brief case description..." value={newCase.description} onChange={e => setNewCase(p => ({ ...p, description: e.target.value }))} className="bg-background/50" />
                      </div>
                      <Button onClick={handleCreateCase} className="w-full bg-gradient-to-r from-primary to-primary/80 text-white">Create Case</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {loadingCases ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
              ) : filteredCases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
                  <Briefcase className="w-12 h-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No cases found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
                  {filteredCases.map(c => (
                    <Card
                      key={c.id}
                      onClick={() => router.push(`/cases/${c.id}`)}
                      className="cursor-pointer border-white/5 bg-card/65 backdrop-blur-sm hover:bg-card/90 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors line-clamp-1">{c.title}</CardTitle>
                          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColor[c.status] || ''}`}>
                            {c.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {c.case_number && (
                          <p className="text-xs text-muted-foreground font-mono">{c.case_number}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {c.court && (
                            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.court}</span>
                          )}
                          {c.next_hearing_date && (
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(c.next_hearing_date).toLocaleDateString()}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-[10px]">{c.role}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
