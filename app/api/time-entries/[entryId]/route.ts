import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/app/_utils/api-utils";
import {
  stopTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
} from "@/app/_server/actions/time-entries";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  return withApiAuth(request, async () => {
    try {
      const { entryId } = await params;
      const body = await request.json();
      const { taskId, action, description } = body;

      if (!taskId) {
        return NextResponse.json({ error: "taskId is required" }, { status: 400 });
      }

      if (action === "stop") {
        const result = await stopTimeEntry(taskId, entryId);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, data: result.data });
      }

      if (description !== undefined) {
        const result = await updateTimeEntry(taskId, entryId, description);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: "No valid action provided" }, { status: 400 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      );
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  return withApiAuth(request, async () => {
    try {
      const { entryId } = await params;
      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get("taskId");

      if (!taskId) {
        return NextResponse.json({ error: "taskId is required" }, { status: 400 });
      }

      const result = await deleteTimeEntry(taskId, entryId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      );
    }
  });
}
