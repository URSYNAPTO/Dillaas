# Security Specification for DILLAAS AI

## 1. Data Invariants
- A user document must specify the correct `uid` (matching the auth user).
- Usage history must be linked to the authenticated user.
- Users can only read their own profile and history.
- Admin users (identified by a collection `/admins/`) can see all data.
- Timestamps must be server-generated.

## 2. The "Dirty Dozen" Payloads (Blocked)

1. **Identity Spoofing**: Creating a user document with a different `uid`.
2. **Privilege Escalation**: Setting `isAdmin: true` in the user document (if stored there).
3. **Shadow Update**: Adding a field `unauthorizedField: "hacker"` to a user document.
4. **ID Poisoning**: Injecting a 2KB string as a document ID.
5. **Timestamp Tampering**: Providing a manual `createdAt` in the past.
6. **Orphaned Writes**: Writing history logs to another user's collection.
7. **Negative usageCount**: Attempting to set `usageCount` to `-100`.
8. **Invalid Plan**: Setting `plan` to `"platinum_ultra"`.
9. **Large Strings**: Sending a 1MB string for `displayName`.
10. **State Skipping**: Updating a terminal status (if we had one).
11. **Bulk Scrape**: Unauthorized list query on all users.
12. **PII Leak**: Guest user attempting to read another user's private info.

## 3. Test Runner Concept
The `firestore.rules.test.ts` will verify these rejections.
