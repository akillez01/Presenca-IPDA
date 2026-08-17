'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { getAccessProfileConfig, getAccessProfileOptions, ManagedAccessProfile } from '@/lib/user-access';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp, updateDoc } from 'firebase/firestore';
import { Check, RefreshCw, ShieldAlert, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type RequestStatus = 'pendente' | 'aprovado' | 'reprovado';

interface AccessRequest {
  uid: string;
  displayName: string;
  username: string;
  email: string;
  phone: string;
  status: RequestStatus;
  requestedAt: Date | null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function formatDateTime(value: Date | null) {
  if (!value) return '-';
  return value.toLocaleString('pt-BR');
}

const STATUS_BADGE: Record<RequestStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
  aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 hover:bg-green-200' },
  reprovado: { label: 'Reprovado', className: 'bg-red-100 text-red-800 hover:bg-red-200' },
};

export function AccessRequestsPanel() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Record<string, ManagedAccessProfile>>({});
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('requestedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: AccessRequest[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status !== 'pendente' && data.status !== 'aprovado' && data.status !== 'reprovado') return;
          if (!data.requestedAt) return; // ignora contas legadas sem solicitação registrada
          items.push({
            uid: docSnap.id,
            displayName: typeof data.displayName === 'string' ? data.displayName : '-',
            username: typeof data.username === 'string' ? data.username : '-',
            email: typeof data.email === 'string' ? data.email : '-',
            phone: typeof data.phone === 'string' ? data.phone : '',
            status: data.status,
            requestedAt: toDate(data.requestedAt),
          });
        });
        setRequests(items);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar solicitações de acesso:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pendente').length, [requests]);

  function getSelectedProfile(uid: string) {
    return selectedProfile[uid] ?? 'editor';
  }

  async function handleApprove(request: AccessRequest) {
    const profile = getSelectedProfile(request.uid);
    const config = getAccessProfileConfig(profile);
    // Hoje a única porta de entrada de solicitações é /sede-estadual/acesso, então a aprovação
    // padrão libera só a aba Sede Estadual (nada de Dashboard/outras abas), a não ser que o
    // perfil escolhido seja Administrador (acesso completo é o próprio propósito dessa opção).
    const permissions = profile === 'admin' ? config.permissions : ['sedeEstadual' as const];

    setProcessingUid(request.uid);
    try {
      await updateDoc(doc(db, 'users', request.uid), {
        status: 'aprovado',
        role: config.role,
        userType: config.userType,
        permissions,
        accessProfile: config.accessProfile,
      });
      toast({ title: 'Acesso aprovado', description: `${request.displayName} agora tem perfil ${config.label}.` });
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao aprovar', description: 'Não foi possível atualizar a solicitação.', variant: 'destructive' });
    } finally {
      setProcessingUid(null);
    }
  }

  async function handleReject(request: AccessRequest) {
    setProcessingUid(request.uid);
    try {
      await updateDoc(doc(db, 'users', request.uid), { status: 'reprovado' });
      toast({ title: 'Acesso reprovado', description: `${request.displayName} ficará bloqueado ao entrar no sistema.` });
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao reprovar', description: 'Não foi possível atualizar a solicitação.', variant: 'destructive' });
    } finally {
      setProcessingUid(null);
    }
  }

  async function handleDelete(request: AccessRequest) {
    if (!confirm(`Excluir a solicitação de "${request.displayName}"? Isso remove o perfil, mas a conta de login (e-mail/senha) continua existindo no Firebase Authentication.`)) {
      return;
    }

    setProcessingUid(request.uid);
    try {
      await deleteDoc(doc(db, 'users', request.uid));
      toast({ title: 'Solicitação excluída' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao excluir', description: 'Não foi possível remover a solicitação.', variant: 'destructive' });
    } finally {
      setProcessingUid(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>Usuários e aprovações</CardTitle>
            <CardDescription>
              Aprove solicitações de acesso e defina o nível de permissão de cada pessoa.
            </CardDescription>
          </div>
          {pendingCount > 0 ? (
            <Badge className="bg-amber-500 hover:bg-amber-600">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando solicitações...</p>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <ShieldAlert className="h-6 w-6 text-muted-foreground" />
            Nenhuma solicitação de acesso até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Solicitado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const isProcessing = processingUid === request.uid;
                  const badge = STATUS_BADGE[request.status];
                  return (
                    <TableRow key={request.uid}>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-green-700"
                            disabled={isProcessing}
                            onClick={() => handleApprove(request)}
                          >
                            {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            <span className="ml-1">Aprovar</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-red-700"
                            disabled={isProcessing}
                            onClick={() => handleReject(request)}
                          >
                            <X className="h-4 w-4" />
                            <span className="ml-1">Reprovar</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isProcessing}
                            onClick={() => handleDelete(request)}
                            title="Remove só o registro do perfil; a conta de login no Firebase continua existindo."
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={badge.className}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{request.displayName}</TableCell>
                      <TableCell>{request.username}</TableCell>
                      <TableCell>{request.email}</TableCell>
                      <TableCell>{request.phone || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={getSelectedProfile(request.uid)}
                          onValueChange={(value) =>
                            setSelectedProfile((prev) => ({ ...prev, [request.uid]: value as ManagedAccessProfile }))
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getAccessProfileOptions().map((option) => (
                              <SelectItem key={option.accessProfile} value={option.accessProfile}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(request.requestedAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
