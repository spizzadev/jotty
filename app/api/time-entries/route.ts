import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/app/_utils/api-utils";
import {
  getTimeEntries,
  startTimeEntry,
} from "@/app/_server/actions/time-entries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApiAuth(request, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get("taskId");

      if (!taskId) {
        return NextResponse.json({ error: "taskId is required" }, { status: 400 });
      }

      const result = await getTimeEntries(taskId);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json(result.data);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch time entries" },
        { status: 500 },
      );
    }
  });
}

export async function POST(request: NextRequest) {
  return withApiAuth(request, async () => {
    try {
      const body = await request.json();
      const { taskId, description } = body;

      if (!taskId || !description) {
        return NextResponse.json(
          { error: "taskId and description are required" },
          { status: 400 },
        );
      }

      const result = await startTimeEntry(taskId, description);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, data: result.data }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Internal server error" },
        { status: 500 },
      );
    }
  });
}
