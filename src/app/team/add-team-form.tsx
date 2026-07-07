"use client";
import { useActionState } from "react";
import { addTeamMemberAction } from "./actions";
import { ADD_TEAM_IDLE } from "./state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddTeamForm() {
  const [state, action, pending] = useActionState(
    addTeamMemberAction,
    ADD_TEAM_IDLE,
  );
  return (
    <div>
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="team-email" className="sr-only">
          Team member email
        </label>
        <Input
          id="team-email"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="person@merqo.sg"
          className="sm:max-w-xs"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add member"}
        </Button>
      </form>
      {state.status !== "idle" && (
        <p
          role="status"
          className={
            state.status === "success"
              ? "mt-2 text-sm text-primary"
              : "mt-2 text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
