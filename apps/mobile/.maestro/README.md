# Private-beta Maestro smoke flows

Run these against an internal build and a non-production test account:

```bash
CUSTOMER_EMAIL='...' CUSTOMER_PASSWORD='...' maestro test customer-core.yaml
BARBER_EMAIL='...' BARBER_PASSWORD='...' maestro test barber-core.yaml
```

The automated smoke flows verify role routing, authentication, core tabs, customer discovery
controls, barber appointments, the calendar, and the online-payment entry point. The full booking,
journey, arrival, payment, live-tracking, and push-open gates depend on seeded appointment state,
provider test infrastructure, two physical devices, and OS permission prompts. Run those from the
field-test checklist in `docs/MOBILE.md`; do not substitute Expo Go for the minimized/locked tests.
