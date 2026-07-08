# Barber Operations

## Schedule to Slots

A barber defines one recurring schedule row per working weekday. Times are local wall-clock values;
the API performs no timezone conversion. Replacing a schedule upserts submitted weekdays and removes
omitted weekdays.

Slot generation advances by `slotDurationMinutes` and never emits a slot past closing time. A
database uniqueness constraint on barber, date, and start time makes generation idempotent. Existing
booked slots survive schedule changes.

## Blocked Dates

Blocking a date records the reason and changes only `AVAILABLE` slots to `BLOCKED`. Booked slots and
appointments are not cancelled automatically. Unblocking restores blocked slots and generates any
missing slots from the recurring schedule.

## Appointment Lifecycle

```text
PENDING -> CONFIRMED or CANCELLED
CONFIRMED -> IN_PROGRESS, CANCELLED, or NO_SHOW
IN_PROGRESS -> COMPLETED
```

Completed, cancelled, and no-show appointments are terminal. Cancelling releases the linked slot.

## Demo Accounts

After `pnpm db:seed`, use password `password123` with:

```text
barber1@example.com
barber2@example.com
barber3@example.com
client1@example.com
```
