# Integrations

| Integration | Current behavior | Next prerequisite |
| --- | --- | --- |
| PostgreSQL | Local persistent PGlite, compatible pg connection path | Verify migration and queries against an isolated Neon branch |
| Stripe | Clearly labeled simulated payment, local only | Stripe test credentials, verified webhook and unique event IDs |
| Resend | No messages sent | Approved demo recipients and Salut sender domain |
| Twilio | No messages sent | Salut sender and approved demo recipients |
| Updates | Five-second database-backed polling | Measure query load before choosing a push provider |
| Vercel | Target platform | Private test project, Neon, environment settings and smoke tests |
