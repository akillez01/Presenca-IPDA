'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ChevronDown, CheckCircle2, Landmark, Loader2, Lock, Mail, Phone, User, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

function getErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as any).code) : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já possui uma conta. Tente entrar ou recuperar sua senha.';
    case 'auth/invalid-email':
      return 'Informe um e-mail válido.';
    case 'auth/weak-password':
      return 'A senha deve ter pelo menos 6 caracteres.';
    default:
      return 'Não foi possível concluir a solicitação. Tente novamente.';
  }
}

function AcessoHeader({ description }: { description: string }) {
  return (
    <CardHeader className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="relative size-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
          <Landmark className="size-8 text-white" />
        </div>
      </div>
      <div>
        <CardTitle className="text-2xl font-bold">Sede Estadual</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
    </CardHeader>
  );
}

function LoginPanel() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push('/admin/sede-estadual');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Erro ao fazer login');
      }
    } catch {
      setError('Erro inesperado ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="login-email">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Senha</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10"
            required
            disabled={loading}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Entrando...
          </>
        ) : (
          'Entrar'
        )}
      </Button>
    </form>
  );
}

function RequestAccessPanel({ onSubmitted }: { onSubmitted: () => void }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      setError('É necessário aceitar os termos de uso e a política de privacidade.');
      return;
    }

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      await setDoc(doc(db, 'users', credential.user.uid), {
        displayName: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role: 'user',
        status: 'pendente',
        requestedAt: serverTimestamp(),
        termsAcceptedAt: serverTimestamp(),
        privacyAcceptedAt: serverTimestamp(),
      });
      onSubmitted();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Nome completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="pl-10"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Login</Label>
        <div className="relative">
          <UserCircle className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="pl-10"
            placeholder="Como você quer ser identificado no sistema"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-10"
            required
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Telefone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="pl-10"
            placeholder="(XX) XXXXX-XXXX"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar senha</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <Collapsible open={termsOpen} onOpenChange={setTermsOpen} className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
            Termos de uso
            <ChevronDown className={`h-4 w-4 transition-transform ${termsOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 px-3 pb-3 text-xs text-muted-foreground">
          <p>Não compartilhe suas credenciais e comunique a administração caso perceba uso indevido da conta.</p>
          <p>
            O sistema deve ser usado para cadastro, consulta, presença, relatórios e demais rotinas internas
            permitidas pelo perfil liberado. O uso inadequado pode resultar em bloqueio ou cancelamento do acesso.
          </p>
          <p>
            A administração pode aprovar, alterar perfil, rejeitar ou remover acessos conforme a necessidade
            operacional e a segurança das informações.
          </p>
        </CollapsibleContent>
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <Checkbox
            id="terms"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            disabled={loading}
          />
          <Label htmlFor="terms" className="text-sm font-normal">
            Li e concordo com os termos de uso.
          </Label>
        </div>
      </Collapsible>

      <Collapsible open={privacyOpen} onOpenChange={setPrivacyOpen} className="rounded-lg border">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium">
            Política de privacidade
            <ChevronDown className={`h-4 w-4 transition-transform ${privacyOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 px-3 pb-3 text-xs text-muted-foreground">
          <p>
            Os dados informados (nome, login, e-mail e telefone) são usados apenas para identificação e controle de
            acesso ao cadastro da Sede Estadual.
          </p>
          <p>
            Esses dados não são compartilhados com terceiros e ficam visíveis somente para a administração,
            responsável por avaliar e liberar cada solicitação de acesso.
          </p>
        </CollapsibleContent>
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <Checkbox
            id="privacy"
            checked={privacyAccepted}
            onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
            disabled={loading}
          />
          <Label htmlFor="privacy" className="text-sm font-normal">
            Li e concordo com a política de privacidade.
          </Label>
        </div>
      </Collapsible>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          'Solicitar acesso'
        )}
      </Button>
    </form>
  );
}

export default function SedeEstadualAcessoPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="size-14 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Cadastro enviado!</CardTitle>
            <CardDescription>
              Sua solicitação de acesso à Sede Estadual foi registrada. Um administrador precisa liberar sua conta
              antes que você possa entrar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => { setSubmitted(false); setMode('login'); }}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <AcessoHeader
          description={
            mode === 'login'
              ? 'Entre com sua conta liberada para a Sede Estadual.'
              : 'Crie seu usuário. Um administrador libera o perfil para uso.'
          }
        />

        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
                mode === 'signup' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Solicitar acesso
            </button>
          </div>

          {mode === 'login' ? <LoginPanel /> : <RequestAccessPanel onSubmitted={() => setSubmitted(true)} />}
        </CardContent>
      </Card>
    </div>
  );
}
