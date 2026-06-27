import { WaitlistsTable } from '@/components/admin/WaitlistsTable';
import { listWaitlistGroups } from '@/server/queries/admin-waitlists';

export default async function AdminWaitlistsPage() {
  const groups = await listWaitlistGroups();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl text-ink">Waitlists</h1>
        <p className="text-sm text-muted">
          Fans waiting on sold-out variants. Restocking a variant queues them for the next
          notify-waitlist run.
        </p>
      </div>
      <WaitlistsTable groups={groups} />
    </div>
  );
}
