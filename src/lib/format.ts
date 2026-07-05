/** Cents → a plain "$1,234" string. Shared by the team overview + product cards. */
export const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;
