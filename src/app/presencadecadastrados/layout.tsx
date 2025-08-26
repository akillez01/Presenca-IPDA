// Layout customizado para a página de presença de cadastrados, sem menu lateral ou header
import React from "react";

export default function PresencaCadastradosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}
