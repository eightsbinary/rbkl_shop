import type { WaitlistGroup } from '@/server/queries/admin-waitlists';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export function WaitlistsTable({ groups }: { groups: WaitlistGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-muted">No one is waiting right now.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Product</th>
            <th className="px-4 py-3 font-medium">Waiting</th>
            <th className="px-4 py-3 font-medium">Since</th>
            <th className="px-4 py-3 font-medium">Stock</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const restockReady = g.stockAvailable > 0;
            return (
              <tr key={g.variantId} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink">
                  {g.productName}
                  {g.optionLabel && <span className="text-muted"> · {g.optionLabel}</span>}
                </td>
                <td className="px-4 py-3 font-medium text-ink">{g.count}</td>
                <td className="px-4 py-3 text-muted">{dateFmt.format(new Date(g.earliest))}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      restockReady ? 'bg-success/15 text-success' : 'bg-muted/15 text-muted'
                    }`}
                  >
                    {restockReady ? `${g.stockAvailable} in stock — will notify` : 'sold out'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
