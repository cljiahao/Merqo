# telegram

Merqo's shared Telegram bot serves customer consent/notifications and vendor
activity alerts. It replaces the retired per-kit vendor bots.

`webhook/route.ts` receives Telegram updates after webhook-secret validation.
Customer and vendor connect-token endpoints mint link tokens; the webhook
consumes them and records the appropriate connection. Customer consent can be
withdrawn with `/stop`. The bot must receive user contact before private alerts
can be sent; reconnecting to the shared bot establishes that contact.

See the [webhook README](webhook/README.md) for command and failure behavior,
and deployment instructions for webhook registration. There is no local
outbound call to this webhook.

## Parent

[api](../README.md)
