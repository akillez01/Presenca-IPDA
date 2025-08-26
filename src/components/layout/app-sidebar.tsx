"use client";

import { BarChart3, Church, Cog, LayoutDashboard, UserPlus, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

// Links para usuários básicos (acesso limitado)
const basicUserMenuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/presencadecadastrados", label: "Presença de Cadastrados", icon: Users },
  { href: "/register", label: "Cadastrar Membros", icon: UserPlus },
  { href: "/cartaderecomendacao", label: "Carta de Recomendação", icon: Church },
  { href: "/cartaderecomendacao1dia", label: "Carta 1 Dia", icon: Church },
];

// Links completos para super usuários
const superUserMenuItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/presencadecadastrados", label: "Presença de Cadastrados", icon: Users },
  { href: "/reports", label: "Relatórios", icon: BarChart3 },
  { href: "/register", label: "Cadastrar Membros", icon: UserPlus },
  { href: "/cartaderecomendacao", label: "Carta de Recomendação", icon: Church },
  { href: "/cartaderecomendacao1dia", label: "Carta 1 Dia", icon: Church },
  { href: "/admin/users", label: "Gerenciar Usuários", icon: Users },
  { href: "/config", label: "Configurações", icon: Cog },
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
  const { user } = useAuth();
  if (!user) return null;

  // Determinar quais links mostrar baseado no tipo de usuário
  const userType = getUserType(user.email || '');
  const menuItems = userType === UserType.SUPER_USER 
    ? superUserMenuItems
    : basicUserMenuItems;

  return (
    <Sidebar className="border-r bg-sidebar text-sidebar-foreground print:hidden" collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoComponent />
          <div className="transition-opacity duration-200 group-data-[state=collapsed]:opacity-0">
            <h1 className="font-bold text-lg text-sidebar-foreground">
              IPDA - Presença
            </h1>
            {userType === UserType.BASIC_USER && (
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
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
