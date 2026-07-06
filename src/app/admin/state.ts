// Non-"use server" module: a server-actions file may only export async
// functions, so the shared state type + idle constant live here.

export type AddTeamState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const ADD_TEAM_IDLE: AddTeamState = { status: "idle" };
