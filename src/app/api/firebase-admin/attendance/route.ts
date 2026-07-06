import { NextResponse } from "next/server";

export const dynamic = "force-static";

export async function GET() {
  // Endpoint reservado para futura integracao (ex.: leitura de presencas via Admin SDK).
  return NextResponse.json(
    { success: false, message: "Not implemented" },
    { status: 501 }
  );
}

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Not implemented" },
    { status: 501 }
  );
}
