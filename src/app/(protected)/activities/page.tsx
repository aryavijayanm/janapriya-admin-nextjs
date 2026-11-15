import { requireUser } from "@/app/_lib/session";
import { getDayActivities } from "@/server/services/activities.service";
import { activitiesQuerySchema } from "@/server/validators/activities";
import { todayInKerala } from "@/server/domain/age";
import { ActivitiesView } from "@/features/activities/ActivitiesView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// What happened on a day (?day=yyyy-mm-dd, default today; future days allowed).
// Opened from the navbar ACTIVITIES button, a date in the calendar, and the
// dashboard card. Thin: read the URL, fetch the day, hand over.
export default async function ActivitiesPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    // A repeated param (?day=..&day=..) arrives as an array; take the first.
    const raw = Object.fromEntries(
        Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    );
    const query = activitiesQuerySchema.parse(raw);
    const today = todayInKerala();
    const day = query.day ?? today;

    const activities = await getDayActivities(db, user, day);

    return <ActivitiesView day={day} today={today} tab={query.tab} activities={activities} />;
}
