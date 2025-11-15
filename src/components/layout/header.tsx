"use client";

import { FirebaseStatus } from "@/components/firebase-status";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { getUserType, UserType } from "@/lib/auth";
import { HelpCircle, LogOut, Settings, Shield, User, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      router.push('/login');
    }
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  const getUserName = (email: string) => {
    return email.split('@')[0].replace('.', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getUserTypeLabel = (email: string, overridenUserType?: UserType) => {
    const userType = overridenUserType ?? getUserType(email);
    switch (userType) {
      case UserType.SUPER_USER:
        return { label: 'Super Usuário', color: 'text-green-600' };
      case UserType.EDITOR_USER:
        return { label: 'Editor de Presença', color: 'text-purple-600' };
      case UserType.BASIC_USER:
        return { label: 'Usuário Básico', color: 'text-blue-600' };
      default:
        return { label: 'Desconhecido', color: 'text-gray-600' };
    }
  };
  const claimedUserType = (user as any)?.userType as UserType | undefined;


  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6 print:hidden">
      {/* Botão de menu móvel - sempre visível em mobile */}
      <SidebarTrigger className="lg:hidden" />
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <FirebaseStatus />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              {user ? (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {getInitials(user.email || 'AD')}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <UserCircle className="h-6 w-6" />
              )}
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {user ? (
              <>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {getUserName(user.email || 'Administrador')}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Shield className="h-3 w-3" />
                      <span className={`text-xs font-medium ${getUserTypeLabel(user.email || '', claimedUserType).color}`}>
                        {getUserTypeLabel(user.email || '', claimedUserType).label}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Minha Conta</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Suporte</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuLabel>Visitante</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/login')}>
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Fazer Login</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
