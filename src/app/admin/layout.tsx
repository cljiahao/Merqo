import { requireMerqoTeam } from "@/lib/team";
import { hasActiveVendorAccess } from "@/lib/vendor";
import { getAvatarUrl } from "@/lib/account";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Gate every /admin route once here; child pages re-derive the user cheaply.
  const { user } = await requireMerqoTeam();
  const canSwitch = user.email
    ? await hasActiveVendorAccess(user.email)
    : false;

  return (
    <div className="min-h-screen">
      <AdminNav
        email={user.email}
        avatarUrl={getAvatarUrl(user)}
        canSwitch={canSwitch}
      />
      {children}
    </div>
  );
}
