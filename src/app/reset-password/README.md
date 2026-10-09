# src/app/reset-password

Recovery form for the session established by the auth callback. passwordChangeSchema validates both fields before updateUser; repeated submissions are blocked while pending. Returned and thrown failures retain the form and show feedback; successful updates navigate to /post-login. DOM tests verify validation, error recovery and pending-state reset.
