import { NextRequest, NextResponse } from "next/server";
import { deleteServer, updateServer } from "@/lib/servers/store";
import { serverCreateSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const patch = serverCreateSchema.partial().parse(body);
    const server = await updateServer(id, patch);
    return NextResponse.json({ server });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update server" },
      { status: 400 }
    );
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteServer(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete server" },
      { status: 404 }
    );
  }
}
