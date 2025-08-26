// Layout customizado para a página de relatórios, sem menu lateral ou header
import React from "react";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-body bg-background antialiased min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}
