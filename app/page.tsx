import Link from "next/link";

const primary =
  "inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground";
const secondary =
  "inline-flex h-12 w-full items-center justify-center rounded-xl bg-card px-4 text-base font-bold ring-1 ring-border";

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-8">
        <header>
          <p className="text-sm font-extrabold tracking-wide text-muted-foreground">Family Car Booker</p>
          <h1 className="mt-2 text-[2.7rem] leading-[1.02]">Who has the car?</h1>
          <p className="mt-4 text-lg leading-relaxed">
            One link for the household. Kids request a time. An admin approves. No install, no account.
          </p>
        </header>

        <article className="overflow-hidden rounded-2xl bg-card shadow-[0_10px_28px_rgba(28,25,21,0.05)] ring-1 ring-foreground/10">
          <div className="flex">
            <div className="w-2 bg-[#2f6f8f]" />
            <div className="flex-1 p-4">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Example</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <h2 className="text-2xl">Civic</h2>
                <span className="rounded-full bg-booked-bg px-2.5 py-1 text-sm font-bold text-booked">Out</span>
              </div>
              <p className="mt-2 text-[1.65rem] leading-tight font-bold text-booked">With Jake until 9:30 pm</p>
              <p className="mt-1 text-sm text-muted-foreground">Practice, then dinner · Riverside High</p>
            </div>
          </div>
        </article>

        <div className="grid gap-3">
          <Link href="/setup" className={primary}>
            Set up a household
          </Link>
          <Link href="/demo" className={secondary}>
            Try the demo garage
          </Link>
        </div>

        <section className="grid gap-3">
          <h2 className="text-2xl">How a request goes</h2>
          <ol className="grid gap-3 text-base">
            <li className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <strong>1. Set up once.</strong> Add the cars and the drivers. Mark one or two admins.
            </li>
            <li className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <strong>2. Text the family link.</strong> Everyone picks their name on their own phone.
            </li>
            <li className="rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <strong>3. Admins use a second link.</strong> Approve, decline, or suggest another time. The family link cannot approve.
            </li>
          </ol>
          <p className="text-sm text-muted-foreground">
            When the car is back in the driveway, anyone with the link can mark it returned.
          </p>
        </section>
      </main>
    </div>
  );
}
