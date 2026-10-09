# Dashboard actions

Shared dashboard logic sits alongside the signed-in (app) route group and the profile redirect shim.

markTourSeen resolves the authenticated user through the session client and delegates to stampTourSeen. The browser action supplements the layout's initial stamp. Both use the same cosmetic preference write; rejected authentication and database errors must not interrupt navigation.

The stamp is best-effort rather than guaranteed durable state. RLS restricts preference ownership, and tests assert the actor, write shape and failure paths. DashboardTour owns the browser interaction through its shared UI adapter.
