import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/app/_utils/api-utils";
import {
  stopTimeEntry,
  stopCategoryEntry,
  updateTimeEntry,
  updateCategoryEntry,
  deleteTimeEntry,
  deleteCategoryEntry,
} from "@/app/_server/actions/time-entries";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  return withApiAuth(request, async (user) => {
    try {
      const { entryId } = await params;
      const body = await request.json();
      const { taskId, category, action, description, start, end } = body;

      if (!taskId && !category) {
        return NextResponse.json(
          { error: "taskId or category is required" },
          { status: 400 },
        );
      }

      if (action === "stop") {
        const result = taskId
          ? await stopTimeEntry(taskId, entryId, user.username)
          : await stopCategoryEntry(category, entryId, user.username);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, data: result.data });
      }

      if (
        description !== undefined ||
        start !== undefined ||
        end !== undefined
      ) {
        const updates = { description, start, end };
        const result = taskId
          ? await updateTimeEntry(taskId, entryId, updates, user.username)
          : await updateCategoryEntry(
              category,
              entryId,
              updates,
              user.username,
            );
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, data: result.data });
      }

      return NextResponse.json(
        { error: "No valid action provided" },
        { status: 400 },
      );
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  return withApiAuth(request, async (user) => {
    try {
      const { entryId } = await params;
      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get("taskId");
      const category = searchParams.get("category");

      if (!taskId && !category) {
        return NextResponse.json(
          { error: "taskId or category is required" },
          { status: 400 },
        );
      }

      const result = taskId
        ? await deleteTimeEntry(taskId, entryId, user.username)
        : await deleteCategoryEntry(category!, entryId, user.username);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
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
