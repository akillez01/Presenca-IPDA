'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { ArrowLeft, Church, Landmark, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const dynamic = 'force-dynamic';

const BAPTISM_COLLECTION = 'baptism_records';
const SEDE_ESTADUAL_COLLECTION = 'sede_estadual_members';

const BAPTISM_COLOR = '#0ea5e9';
const SEDE_COLOR = '#8b5cf6';

type YearlyCount = { year: string; batismo: number; sede: number };

type DashboardStats = {
  loading: boolean;
  totalBaptism: number;
  totalSede: number;
  yearlyData: YearlyCount[];
};

function extractYear(baptismYear: unknown, createdAt: unknown): string | null {
  const fromBaptismYear = String(baptismYear || '').trim();
  if (/^\d{4}$/.test(fromBaptismYear)) return fromBaptismYear;

  const fromCreatedAt = String(createdAt || '').slice(0, 4);
  if (/^\d{4}$/.test(fromCreatedAt)) return fromCreatedAt;

  return null;
}

function useMembersDashboardStats(enabled: boolean): DashboardStats {
  const [loading, setLoading] = useState(true);
  const [totalBaptism, setTotalBaptism] = useState(0);
  const [totalSede, setTotalSede] = useState(0);
  const [yearlyData, setYearlyData] = useState<YearlyCount[]>([]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      try {
        const [baptismSnap, sedeSnap] = await Promise.all([
          getDocs(collection(db, BAPTISM_COLLECTION)),
          getDocs(collection(db, SEDE_ESTADUAL_COLLECTION)),
        ]);

        if (cancelled) return;

        const yearCounts = new Map<string, { batismo: number; sede: number }>();

        baptismSnap.docs.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const year = extractYear(data.baptismYear, data.createdAt);
          if (!year) return;
          const bucket = yearCounts.get(year) ?? { batismo: 0, sede: 0 };
          bucket.batismo += 1;
          yearCounts.set(year, bucket);
        });

        sedeSnap.docs.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const year = extractYear(undefined, data.createdAt);
          if (!year) return;
          const bucket = yearCounts.get(year) ?? { batismo: 0, sede: 0 };
          bucket.sede += 1;
          yearCounts.set(year, bucket);
        });

        const sortedYears = Array.from(yearCounts.keys()).sort();

        setYearlyData(sortedYears.map((year) => ({ year, ...yearCounts.get(year)! })));
        setTotalBaptism(baptismSnap.size);
        setTotalSede(sedeSnap.size);
      } catch (error) {
        console.error('Não foi possível carregar as estatísticas do painel de Sede Estadual.', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { loading, totalBaptism, totalSede, yearlyData };
}

export default function CadastrosEspeciaisPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const permissions = Array.isArray((user as any)?.permissions) ? (user as any).permissions : [];
  const hasSedeEstadual = permissions.includes('sedeEstadual');
  const hasBaptism = permissions.includes('baptism');

  // Quem só tem uma das duas permissões vai direto para a página correspondente,
  // sem passar por este hub (evita mostrar um card de algo que a pessoa não pode abrir).
  useEffect(() => {
    if (loading) return;
    if (hasSedeEstadual && !hasBaptism) {
      router.replace('/admin/sede-estadual');
    } else if (hasBaptism && !hasSedeEstadual) {
      router.replace('/batismo');
    }
  }, [loading, hasSedeEstadual, hasBaptism, router]);

  const canSeeDashboard = hasSedeEstadual && hasBaptism;
  const stats = useMembersDashboardStats(canSeeDashboard);

  const totalGeral = stats.totalBaptism + stats.totalSede;
  const currentYearData = useMemo(() => {
    const currentYear = new Date().getFullYear().toString();
    return stats.yearlyData.find((item) => item.year === currentYear);
  }, [stats.yearlyData]);

  if (loading || (hasSedeEstadual !== hasBaptism)) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Sede Estadual</h1>
            <p className="text-sm text-muted-foreground">Acesse os cadastros de Sede Estadual e Batismo</p>
          </div>
        </div>
      </div>

      {canSeeDashboard && (
        <Card className="mb-6 shadow-sm">
          <CardHeader className="gap-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" />
              Dashboard de membros
            </CardTitle>
            <CardDescription>
              Visão geral dos cadastros de Batismo e da Sede Estadual, por ano.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.loading ? (
              <div className="flex items-center justify-center gap-3 py-10 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Carregando estatísticas...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Membros batizados
                    </div>
                    <div className="mt-2 text-3xl font-semibold" style={{ color: BAPTISM_COLOR }}>
                      {stats.totalBaptism}
                    </div>
                    {currentYearData && (
                      <p className="mt-1 text-xs text-slate-600">
                        {currentYearData.batismo} cadastro(s) em {new Date().getFullYear()}.
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Membros da Sede Estadual
                    </div>
                    <div className="mt-2 text-3xl font-semibold" style={{ color: SEDE_COLOR }}>
                      {stats.totalSede}
                    </div>
                    {currentYearData && (
                      <p className="mt-1 text-xs text-slate-600">
                        {currentYearData.sede} cadastro(s) em {new Date().getFullYear()}.
                      </p>
                    )}
                  </div>

                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                      Total geral
                    </div>
                    <div className="mt-2 text-3xl font-semibold text-slate-900">{totalGeral}</div>
                    <p className="mt-1 text-xs text-slate-600">Batismo + Sede Estadual, todos os anos.</p>
                  </div>
                </div>

                {stats.yearlyData.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Ainda não há cadastros suficientes para montar o gráfico por ano.
                  </div>
                ) : (
                  <div className="h-72 rounded-lg border border-slate-100 bg-slate-50/60 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={stats.yearlyData}
                        margin={{ top: 16, right: 16, left: -8, bottom: 0 }}
                        barCategoryGap={28}
                      >
                        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="year"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: '#475569', fontSize: 12 }}
                        />
                        <YAxis
                          allowDecimals={false}
                          tickLine={false}
                          axisLine={false}
                          width={28}
                          tick={{ fill: '#64748b', fontSize: 12 }}
                        />
                        <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.10)' }} labelFormatter={(label) => `Ano: ${label}`} />
                        <Legend
                          formatter={(value) => (value === 'batismo' ? 'Membros batizados' : 'Membros da Sede Estadual')}
                        />
                        <Bar dataKey="batismo" name="batismo" fill={BAPTISM_COLOR} radius={[8, 8, 0, 0]} maxBarSize={56} />
                        <Bar dataKey="sede" name="sede" fill={SEDE_COLOR} radius={[8, 8, 0, 0]} maxBarSize={56} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" /> Sede Estadual
            </CardTitle>
            <CardDescription>
              Gerencie os cadastros de membros da Sede Estadual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canSeeDashboard && (
              <Badge variant="outline" className="mb-3 border-slate-300 bg-slate-50 text-slate-700">
                {stats.totalSede} membro(s) cadastrado(s)
              </Badge>
            )}
            <Button asChild className="w-full">
              <Link href="/admin/sede-estadual">
                Abrir Sede Estadual
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Church className="h-5 w-5 text-primary" /> Batismo
            </CardTitle>
            <CardDescription>
              Gerencie os registros de batismo e a geração do documento preenchido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canSeeDashboard && (
              <Badge variant="outline" className="mb-3 border-slate-300 bg-slate-50 text-slate-700">
                {stats.totalBaptism} membro(s) batizado(s)
              </Badge>
            )}
            <Button asChild className="w-full">
              <Link href="/batismo">
                Abrir Batismo
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
