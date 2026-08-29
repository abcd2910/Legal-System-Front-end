'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Scale, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(name, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--background),_oklch(0.05_0.015_240))]">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <Card className="w-full max-w-md mx-4 border-white/[0.03] bg-card/60 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-xl shadow-primary/20">
            <Scale className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-3xl font-heading font-semibold tracking-tight text-white bg-clip-text">Create an account</CardTitle>
          <CardDescription className="text-muted-foreground/90">
            Get started with LegalDesk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-muted-foreground font-medium text-xs tracking-wide uppercase">Full Name</Label>
              <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required className="bg-background/40 border-white/[0.04] focus:border-primary/50 transition-all duration-300" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-muted-foreground font-medium text-xs tracking-wide uppercase">Email</Label>
              <Input id="email" type="email" placeholder="you@lawfirm.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background/40 border-white/[0.04] focus:border-primary/50 transition-all duration-300" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-muted-foreground font-medium text-xs tracking-wide uppercase">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background/40 border-white/[0.04] focus:border-primary/50 transition-all duration-300" />
            </div>
            <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/95 hover:to-primary/85 text-white shadow-lg shadow-primary/10 transition-all duration-300 py-5 text-sm font-semibold rounded-xl" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Account
            </Button>
            <p className="text-center text-sm text-muted-foreground pt-2">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:text-primary/90 font-semibold transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
