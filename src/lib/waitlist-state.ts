export type WaitlistState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const WAITLIST_IDLE: WaitlistState = { status: "idle" };
