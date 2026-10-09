# test/app

Application boundary tests using mocked Supabase and shared UI dependencies. Cover login and recovery validation, shared-profile field patches, admin overview failures and team access states. These tests verify call ownership and UI behavior; database policies are exercised separately by pgTAP and authenticated workflows by browser tests.
