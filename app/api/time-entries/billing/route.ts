import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/app/_utils/api-utils";
import {
  getBillingSettings,
  saveBillingSettings,
} from "@/app/_server/actions/time-entries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    try {
      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get("taskId");

      if (!taskId) {
        return NextResponse.json(
          { error: "taskId is required" },
          { status: 400 },
        );
      }

      const result = await getBillingSettings(taskId, user.username);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: result.data });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Internal server error",
        },
        { status: 500 },
      );
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    try {
      const body = await request.json();
      const { taskId, hourlyRate, currency } = body;

      if (!taskId) {
        return NextResponse.json(
          { error: "taskId is required" },
          { status: 400 },
        );
      }
      if (hourlyRate === undefined || !currency) {
        return NextResponse.json(
          { error: "hourlyRate and currency are required" },
          { status: 400 },
        );
      }

      const result = await saveBillingSettings(
        taskId,
        { hourlyRate, currency },
        user.username,
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Internal server error",
        },
        { status: 500 },
      );
    }
  });
}
