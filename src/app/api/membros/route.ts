import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  // Endpoint reservado para futura integracao (ex.: listar membros via backend).
  return NextResponse.json(
    { success: false, message: "Not implemented" },
    { status: 501 }
  );
}
