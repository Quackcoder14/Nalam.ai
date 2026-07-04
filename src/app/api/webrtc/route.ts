import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getSessionFromRequest } from "@/lib/auth";

// Dedicated client to bypass stale cached module after schema migrations
const webrtcPrisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { patient_id, hospital, type, offer } = await request.json();

    const call = await webrtcPrisma.teleconsultation.create({
      data: {
        patient_id,
        hospital,
        type,
        status: "ringing",
        offer_json: JSON.stringify(offer),
        ice_caller_json: "[]",
        ice_callee_json: "[]",
      },
    });

    return NextResponse.json({ call_id: call.id });
  } catch (error) {
    console.error("WebRTC POST Error:", error);
    return NextResponse.json({ error: "Failed to create call" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { call_id, answer, status } = await request.json();

    const updateData: Record<string, string> = {};
    if (answer) updateData.answer_json = JSON.stringify(answer);
    if (status) updateData.status = status;

    await webrtcPrisma.teleconsultation.update({
      where: { id: call_id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WebRTC PUT Error:", error);
    return NextResponse.json({ error: "Failed to update call" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { call_id, candidate, side } = await request.json();

    const call = await webrtcPrisma.teleconsultation.findUnique({ where: { id: call_id } });
    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    const field = side === "caller" ? "ice_caller_json" : "ice_callee_json";
    const rawField = (call as any)[field] as string | null;
    const currentCandidates: any[] = rawField ? JSON.parse(rawField) : [];

    const isDuplicate = currentCandidates.some((c: any) => c.candidate === candidate.candidate);

    if (!isDuplicate) {
      currentCandidates.push(candidate);
      await webrtcPrisma.teleconsultation.update({
        where: { id: call_id },
        data: { [field]: JSON.stringify(currentCandidates) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("WebRTC PATCH Error:", error);
    return NextResponse.json({ error: "Failed to add ICE candidate" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const call_id = searchParams.get("call_id");
    const hospital = searchParams.get("hospital");
    const status = searchParams.get("status");

    if (call_id) {
      const call = await webrtcPrisma.teleconsultation.findUnique({ where: { id: call_id } });
      return NextResponse.json({ call });
    } else if (hospital && status) {
      // No auth guard — hospital desk polls this every 3s from a background timer
      const calls = await webrtcPrisma.teleconsultation.findMany({
        where: { hospital, status },
        orderBy: { created_at: "asc" },
      });
      return NextResponse.json({ calls });
    }

    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  } catch (error) {
    console.error("WebRTC GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}