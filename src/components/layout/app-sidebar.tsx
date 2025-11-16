"use client";

import { BarChart3, Church, LayoutDashboard, QrCode, Settings, UserPlus, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { getUserType, UserType } from "@/lib/auth";

// Tipo para os itens do menu
interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  inDevelopment?: boolean;
}

// Links para usuários básicos (acesso limitado)
const basicUserMenuItems: MenuItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/presencadecadastrados", label: "Presença de Cadastrados", icon: Users },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/scanner", label: "Scanner QR Code", icon: QrCode },
  { href: "/register", label: "Cadastrar Membros", icon: UserPlus },
  { href: "/cartaderecomendacao", label: "Carta de Recomendação", icon: Church, inDevelopment: true },
  { href: "/cartaderecomendacao1dia", label: "Carta 1 Dia", icon: Church, inDevelopment: true },
];

// Links para usuários editores (podem editar presenças)
const editorUserMenuItems: MenuItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/presencadecadastrados", label: "Presença de Cadastrados", icon: Users },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/scanner", label: "Scanner QR Code", icon: QrCode },
  { href: "/register", label: "Cadastrar Membros", icon: UserPlus },
  { href: "/cartaderecomendacao", label: "Carta de Recomendação", icon: Church, inDevelopment: true },
  { href: "/cartaderecomendacao1dia", label: "Carta 1 Dia", icon: Church, inDevelopment: true },
];

// Links para administradores (acesso total)
const superUserMenuItems: MenuItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/presencadecadastrados", label: "Presença de Cadastrados", icon: Users },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/scanner", label: "Scanner QR Code", icon: QrCode },
  { href: "/register", label: "Cadastrar Membros", icon: UserPlus },
  { href: "/cartaderecomendacao", label: "Carta de Recomendação", icon: Church, inDevelopment: true },
  { href: "/cartaderecomendacao1dia", label: "Carta 1 Dia", icon: Church, inDevelopment: true },
  { href: "/config", label: "Configurações", icon: Settings, inDevelopment: true },
];

// Componente para logo com fallback
function LogoComponent() {
  return (
    <div className="relative flex items-center justify-center min-w-[40px] max-w-[40px] h-[32px] group-data-[state=collapsed]:min-w-[32px] group-data-[state=collapsed]:max-w-[32px] group-data-[state=collapsed]:h-[24px] transition-all duration-200">
      <Image
        src="/images/logodeuseamor.png"
        alt="Igreja Pentecostal Deus é Amor"
        width={40}
        height={32}
        className="object-contain transition-all duration-200"
        style={{ 
          width: "auto", 
          height: "auto",
          maxWidth: "40px",
          maxHeight: "32px"
        }}
        sizes="(max-width: 768px) 32px, 40px"
        priority
        onError={(e) => {
          // Fallback para ícone se a imagem não carregar
          e.currentTarget.style.display = 'none';
          const fallback = e.currentTarget.parentElement?.querySelector('.fallback-icon');
          if (fallback) {
            fallback.classList.remove('opacity-0');
          }
        }}
      />
      <Church className="size-6 text-blue-600 absolute opacity-0 fallback-icon transition-opacity duration-200" />
    </div>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  
  console.log('🗂️ AppSidebar Debug:', { 
    user: !!user, 
    userEmail: user?.email, 
    loading, 
    pathname 
  });
  
  // Se está carregando, não renderizar ainda
  if (loading) {
    console.log('🗂️ AppSidebar: Carregando autenticação...');
    return null;
  }
  
  // Se não há usuário após o carregamento, não mostrar sidebar
  if (!user) {
    console.log('🗂️ AppSidebar: Sem usuário autenticado');
    return null;
  }

  // Determinar quais links mostrar baseado no tipo de usuário
  const claimedUserType = (user as any).userType as UserType | undefined;
  const userType = claimedUserType || getUserType(user.email || '');
  
  // Verificar se é admin (SUPER_USER ou ADMIN_USER)
  const isAdmin = userType === UserType.SUPER_USER || userType === 'ADMIN_USER';
  const isEditor = userType === UserType.EDITOR_USER || userType === 'EDITOR_USER';
  
  const menuItems = isAdmin
    ? superUserMenuItems
    : isEditor
    ? editorUserMenuItems  
    : basicUserMenuItems;

  console.log('🗂️ AppSidebar: Renderizando sidebar', { userType, isAdmin, isEditor, menuItemsCount: menuItems.length });

  return (
    <Sidebar className="border-r bg-sidebar text-sidebar-foreground print:hidden" collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoComponent />
          <div className="transition-opacity duration-200 group-data-[state=collapsed]:opacity-0">
            <h1 className="font-bold text-lg text-sidebar-foreground">
              IPDA - Presença
            </h1>
            {isAdmin && (
              <span className="text-xs text-blue-400 font-semibold">
                Administrador
              </span>
            )}
            {isEditor && !isAdmin && (
              <span className="text-xs text-sidebar-muted-foreground">
                Editor de Presença
              </span>
            )}
            {!isAdmin && !isEditor && (
              <span className="text-xs text-sidebar-muted-foreground">
                Usuário Básico
              </span>
            )}
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={{ children: item.label, side: "right", align: "center" }}
                className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
              >
                <Link href={item.href}>
                  <item.icon className="size-4" />
                  <span className="flex items-center gap-2">
                    {item.label}
                    {item.inDevelopment && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 hidden sm:inline-flex lg:inline-flex group-data-[state=collapsed]:hidden">
                        Em Desenvolvimento
                      </Badge>
                    )}
                    {item.inDevelopment && (
                      <Badge variant="secondary" className="text-xs px-1 py-0.5 sm:hidden">
                        Dev
                      </Badge>
                    )}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
