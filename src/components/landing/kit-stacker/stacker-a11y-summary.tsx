import { KIT_NODES, activeEdges, nodeBySlug } from "@/lib/ecosystem";

/** Screen-reader text equivalent of the graph, kept in sync with the stack.
 *  The visual SVG is decorative; this is the accessible source of truth. */
export function StackerA11ySummary({
  stacked,
}: {
  stacked: ReadonlySet<string>;
}) {
  const nodes = KIT_NODES.filter((n) => stacked.has(n.slug));
  const edges = activeEdges(stacked);
  return (
    <div className="sr-only" aria-live="polite">
      <p>
        Your stack has {nodes.length} kit{nodes.length === 1 ? "" : "s"}:{" "}
        {nodes.map((n) => n.short).join(", ")}.
      </p>
      {edges.length > 0 ? (
        <ul>
          {edges.map((e) => (
            <li key={`${e.from}-${e.to}`}>
              {nodeBySlug(e.from)!.short} connects to {nodeBySlug(e.to)!.short}:{" "}
              {e.desc}
            </li>
          ))}
        </ul>
      ) : (
        <p>No connections yet — add another kit to see how it links to qkit.</p>
      )}
    </div>
  );
}
