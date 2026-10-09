# Team

Team-gated membership management. Server actions validate input, enforce team authorization and prevent self-removal. RemoveMember supplies the member ID and existing copy to ConfirmAdminAction; returned or thrown failures retain the dialog for retry, and pending operations block dismissal. Add-team form state remains separate.
