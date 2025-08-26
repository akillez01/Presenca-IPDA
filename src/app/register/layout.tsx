// Este layout garante que a página /register não tenha menu lateral nem header global
import React from "react"

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return (
      <>{children}</>
    )
}
