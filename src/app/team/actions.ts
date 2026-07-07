"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireMerqoTeam } from "@/lib/team";
import { addTeamMemberByEmail, removeTeamMember } from "@/lib/admin";
import type { AddTeamState } from "./state";

const emailSchema = z.string().trim().toLowerCase().email();

export async function removeTeamMemberAction(
  formData: FormData,
): Promise<void> {
  const { user } = await requireMerqoTeam();
  const userId = z.string().min(1).parse(formData.get("user_id"));
  // Guard against locking yourself out of the operator surface.
  if (userId === user.id) throw new Error("You can't remove yourself.");
  await removeTeamMember(userId);
  revalidatePath("/team");
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
