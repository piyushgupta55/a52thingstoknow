// Master switch for the email-verification gate.
// FALSE = testers (including admin/Chirag) can create accounts and books freely,
// even with fake emails. FLIP TO TRUE before inviting real end users.
//
// When true:
//   - Unverified logged-in users get bounced to <VerifyEmailGate /> and can't
//     reach the dashboard, book editor, or admin.
//   - Sign-up will require email confirmation (also disable auto-confirm in
//     backend auth settings at the same time).
export const EMAIL_VERIFICATION_REQUIRED = false;
