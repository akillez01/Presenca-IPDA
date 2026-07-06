"use client";

import { BarChart3, Church, LayoutDashboard, QrCode, Settings, UserPlus, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { getUserType, UserType } from "@/lib/auth";
import {
  getAccessProfileConfig,
  getAccessProfileFromRole,
  NavigationPermission,
  normalizeNavigationPermissions,
} from "@/lib/user-access";

const DEBUG_SIDEBAR =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_SIDEBAR === "true";

// Tipo para os itens do menu
interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: NavigationPermission;
  inDevelopment?: boolean;
}

const navigationMenuItems: MenuItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/presencadecadastrados", label: "Presença de Cadastrados", icon: Users, permission: "presencadecadastrados" },
  { href: "/reports", label: "Relatórios", icon: BarChart3, permission: "reports" },
  { href: "/scanner", label: "Scanner QR Code", icon: QrCode, permission: "scanner" },
  { href: "/register", label: "Cadastrar Membros", icon: UserPlus, permission: "register" },
  { href: "/batismo", label: "Batismo", icon: Church, permission: "baptism" },
  { href: "/config", label: "Configurações", icon: Settings, permission: "config", inDevelopment: true },
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
  
  if (DEBUG_SIDEBAR) {
    console.log("🗂️ AppSidebar Debug:", {
      user: !!user,
      userEmail: user?.email,
      loading,
      pathname,
    });
  }
  
  // Se está carregando, não renderizar ainda
  if (loading) {
    if (DEBUG_SIDEBAR) console.log("🗂️ AppSidebar: Carregando autenticação...");
    return (
      <Sidebar className="border-r bg-sidebar text-sidebar-foreground print:hidden" collapsible="icon">
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center min-w-[40px] max-w-[40px] h-[32px] group-data-[state=collapsed]:min-w-[32px] group-data-[state=collapsed]:max-w-[32px] group-data-[state=collapsed]:h-[24px] transition-all duration-200">
              <Skeleton className="h-8 w-10" />
            </div>
            <div className="transition-opacity duration-200 group-data-[state=collapsed]:opacity-0">
              <Skeleton className="h-5 w-32" />
              <div className="h-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {Array.from({ length: 7 }).map((_, idx) => (
              <SidebarMenuItem key={idx}>
                <div className="flex items-center gap-2 rounded-md p-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-28 group-data-[state=collapsed]:hidden" />
                </div>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    );
  }
  
  // Se não há usuário após o carregamento, não mostrar sidebar
  if (!user) {
    if (DEBUG_SIDEBAR) console.log("🗂️ AppSidebar: Sem usuário autenticado");
    // Ainda assim montamos um Sidebar minimo para o drawer existir no mobile.
    return (
      <Sidebar className="border-r bg-sidebar text-sidebar-foreground print:hidden" collapsible="icon">
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoComponent />
            <div className="transition-opacity duration-200 group-data-[state=collapsed]:opacity-0">
              <h1 className="font-bold text-lg text-sidebar-foreground">
                IPDA - Presença
              </h1>
              <span className="text-xs text-sidebar-muted-foreground">
                Visitante
              </span>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={{ children: "Fazer Login", side: "right", align: "center" }}
                className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
              >
                <Link href="/login">
                  <Users className="size-4" />
                  <span className="flex items-center gap-2">Fazer Login</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    );
  }

  // Determinar quais links mostrar baseado no tipo de usuário
  // Alguns ambientes podem definir um tipo legado via claims (ex.: "ADMIN_USER").
  type ExtendedUserType = UserType | "ADMIN_USER";
  const claimedUserType = (user as any).userType as ExtendedUserType | undefined;
  const userType: ExtendedUserType = claimedUserType ?? getUserType(user.email || "");
  const userRole = typeof (user as any).role === "string" ? ((user as any).role as string) : undefined;
  const userPermissions = Array.isArray((user as any).permissions)
    ? ((user as any).permissions as string[])
    : [];
  const accessProfile = getAccessProfileFromRole(userRole);
  const navigationPermissions = normalizeNavigationPermissions(
    userPermissions,
    accessProfile
  );
  
  // Verificar se é admin (SUPER_USER ou ADMIN_USER)
  const isAdmin = userType === UserType.SUPER_USER || userType === 'ADMIN_USER';
  const isEditor = userType === UserType.EDITOR_USER;
  const isBaptismOperator = userType === UserType.BAPTISM_USER;

  const effectivePermissions = isAdmin
    ? getAccessProfileConfig('admin').permissions
    : navigationPermissions;

  const menuItems =
    navigationMenuItems.filter((item) => effectivePermissions.includes(item.permission));

  if (DEBUG_SIDEBAR) {
    console.log("🗂️ AppSidebar: Renderizando sidebar", {
      userType,
      userRole,
      accessProfile,
      isAdmin,
      isEditor,
      isBaptismOperator,
      menuItemsCount: menuItems.length,
    });
  }

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
            {isBaptismOperator && !isAdmin && !isEditor && (
              <span className="text-xs text-amber-600 font-medium">
                Operador de Batismo
              </span>
            )}
            {!isAdmin && !isEditor && !isBaptismOperator && (
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
