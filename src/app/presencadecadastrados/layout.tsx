// Layout customizado para a página de presença de cadastrados, sem menu lateral ou header
import React from "react";

export default function PresencaCadastradosLayout({ children }: { children: React.ReactNode }) {
  return (
    // No mobile, centralizar deixa "estranho" e pode quebrar responsividade.
    <div className="bg-background min-h-screen w-full" suppressHydrationWarning>
      {children}
    </div>
  );
}
