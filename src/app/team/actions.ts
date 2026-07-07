"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMerqoTeam } from "@/lib/team";
import { addTeamMemberByEmail, removeTeamMember } from "@/lib/admin";
import type { ActionResult } from "@/lib/action-result";
import type { AddTeamState } from "./state";

const emailSchema = z.string().trim().toLowerCase().email();

export async function removeTeamMemberAction(
  formData: FormData,
): Promise<ActionResult> {
  const { user } = await requireMerqoTeam();
  const parsed = z.string().min(1).safeParse(formData.get("user_id"));
  if (!parsed.success) {
    return { success: false, error: "Missing member reference." };
  }
  // Guard against locking yourself out of the operator surface.
  if (parsed.data === user.id) {
    return { success: false, error: "You can't remove yourself." };
  }
  try {
    await removeTeamMember(parsed.data);
  } catch {
    return { success: false, error: "Couldn't remove the member. Try again." };
  }
  revalidatePath("/team");
  return { success: true };
}

export async function addTeamMemberAction(
  _prev: AddTeamState,
  formData: FormData,
): Promise<AddTeamState> {
  await requireMerqoTeam();
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }
  try {
    const added = await addTeamMemberByEmail(parsed.data);
    if (!added) {
      return {
        status: "error",
        message:
          "No Merqo account for that email yet — they must sign in once first.",
      };
    }
    revalidatePath("/team");
    return { status: "success", message: `Added ${parsed.data} to the team.` };
  } catch {
    return { status: "error", message: "Something went wrong. Try again." };
  }
}
