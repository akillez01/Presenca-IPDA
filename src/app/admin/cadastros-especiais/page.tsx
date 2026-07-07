'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Church, Landmark } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function CadastrosEspeciaisPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
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
