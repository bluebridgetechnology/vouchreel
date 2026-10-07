# What Vouchreel keeps, for how long, and why

This is a description of what the software does today. It is not legal advice: **it needs review by whoever
is responsible for privacy and legal matters before it is published or relied on** (register item B11).

## People with an account

| Data | Kept | Removed when |
|---|---|---|
| Account (name, email, password hash, sign-in sessions, two-factor secret and backup codes) | While the account exists | The person deletes the account (Settings, Delete account): immediate after they confirm from an email link. |
| Spaces, testimonials, forms, submissions, widgets, brand kit, settings, reviews, API keys, webhooks, notifications, team links | While the account exists | Same deletion; the database removes them together. |
| Uploaded and generated files (testimonial videos, thumbnails, social exports, AI videos, review videos) | While the row that owns them exists | Queued for deletion in the same step as the row; a background job removes them (retried until it succeeds). |
| Subscription | While the account exists | At deletion the subscription is first cancelled with Stripe or Dodo; if the provider refuses, nothing is deleted and the person can retry. |
| A "download my data" zip | 7 days | Deleted automatically after 7 days (and when the account is deleted). Only its owner can download it. |

Deleting an account is refused while it still has team members, and for the only platform admin.

## People who gave a testimonial (not account holders)

Their name, email, words and video are held by the account owner who collected them. The owner can:

- see each person's consent record (the wording version, when, how, whether withdrawn) and download them all as CSV (Testimonials page);
- delete one testimonial, or use Settings, "Remove a customer's data" to delete everything held for one email: submissions, the testimonials made from them, consents, and every video made from them, with files queued for removal.

A person who agreed to an AI-narrated video can withdraw from the link in their receipt email; the videos made under
that consent are removed. Testimonials typed in by hand carry no email, so they cannot be found by email.

## Records kept after deletion

- **Admin audit log**: who changed a plan, suspended an account, reset two-factor, and so on. The row stays; the admin's account reference is cleared when that admin is deleted. It holds account emails inside summaries, so it should be treated as personal data and reviewed against your own retention rules.
- **Payment records**: Stripe and Dodo keep their own records as the law requires. Vouchreel does not hold card numbers.
- **Logs and error reports**: scrubbed of emails, tokens and customer text before they are written (see `lib/observability/scrub.ts`). Log retention is set by your host or the self-hosted stack (default 14 days for logs, 30 days for errors).
- **Backups**: **deleted data can remain in database backups until those backups expire.** Backup retention is a deployment choice; set it, and write it here.
- **Analytics events** (widget views and clicks) describe site visitors, not account holders. They are tied to a space and removed with it; they are not included in a data export.

## Not decided here

- Whether deletion should have a grace period (today: immediate after the email confirmation).
- How long the audit log should be kept.
- Backup retention.
