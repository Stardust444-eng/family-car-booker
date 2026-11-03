# Family Car Booker

A household link for families with more drivers than cars. Kids open one link, pick their name, and request a car. Admins approve, decline, or suggest another time from a separate link. Nobody installs an app or creates an account.

The Chen family garage is illustrative demo data and is labeled Demo. Those people and cars are not real.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

- Demo garage: [http://127.0.0.1:4317/demo](http://127.0.0.1:4317/demo)
- Demo approval link: [http://127.0.0.1:4317/demo/admin](http://127.0.0.1:4317/demo/admin)

```bash
npm test
npm run lint
```

## How the links work

Creating a household stores it in `data/garage.sqlite` (created on first run, not committed). You get two URLs:

- Family link, `/h/<id>` — see who has each car, request one, and mark a car returned.
- Approval link, `/a/<token>` — approve, decline, or suggest another time.

The family link cannot approve. Save the approval link. It is not shown on the family board. On the labeled demo only, the family board includes a preview of the approval link.

Times are wall-clock times in the timezone chosen at setup (the phone timezone). The demo uses America/Chicago. Run the server in the household timezone if you want “now” to match the driveway.

A request that overlaps an existing booking can still be sent. The overlap is flagged on the form and again on the approval card.

“Copy a text to send” fills the group chat. “Add to calendar” downloads an `.ics` file. There are no push notifications.

## What this prototype leaves out

Mileage, cost splitting, GPS, push notifications, and editing a household after it is created.
