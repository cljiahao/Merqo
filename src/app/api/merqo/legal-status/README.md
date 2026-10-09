# Legal status

GET provides the latest terms, privacy and pilot acceptance versions for a calling kit. Verify the shared bearer secret before creating the service client. Trim and validate the email query parameter with Zod; malformed input returns 400 and failed authorization returns 401.

latestLegalVersions reads the lowercased email's acceptance rows in accepted_at order and selects the newest acceptance per document type. Missing documents return null. A failed database read returns 500 instead of claiming that the customer has never accepted the documents. Calling kits own their short-TTL cache.

route.test.ts covers authentication, malformed emails, newest-acceptance ordering and database failures. The legal acceptance table and shared document version constants remain the sources of truth.
