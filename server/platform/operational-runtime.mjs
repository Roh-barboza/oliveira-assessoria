import { OperationalAccounts } from "./operational-accounts.mjs";
import { OperationalMfa } from "./operational-mfa.mjs";
import { OperationalLoginLimiter } from "./operational-login-limiter.mjs";
import { OperationalAuthenticationService } from "./operational-authentication.mjs";
import { OperationalCases } from "./operational-cases.mjs";
import { OperationalContracts } from "./operational-contracts.mjs";
import { OperationalInvitations } from "./operational-invitations.mjs";
import { OperationalDocuments } from "./operational-documents.mjs";
import { createOperationalHttp } from "./operational-http.mjs";

// This composes already-tested operational services into one HTTP application.
// Schema migration, secrets, first-user enrollment and verified proxy routing
// are prerequisites, not silent runtime side effects.
export function composeOperationalApp({
  database,
  encryptionKey,
  rateLimitSecret,
  allowedOrigin,
  networkIdentity,
  sandboxEnv = {},
  teamInvitesEnabled = false,
  documentsPreviewEnabled = false,
  documentScanner = null,
}) {
  if (!database?.query || !encryptionKey || !rateLimitSecret)
    throw new Error("Banco e segredos operacionais obrigatórios.");
  const accounts = new OperationalAccounts(database);
  const mfa = new OperationalMfa(accounts, encryptionKey);
  const limiter = new OperationalLoginLimiter(database, rateLimitSecret);
  const authentication = new OperationalAuthenticationService({ limiter, mfa });
  const cases = new OperationalCases(database, encryptionKey);
  const contracts = new OperationalContracts({ database, encryptionKey, cases, sandboxEnv });
  const invites = teamInvitesEnabled
    ? new OperationalInvitations(database, encryptionKey, rateLimitSecret) : null;
  const documents = documentsPreviewEnabled ? new OperationalDocuments({
    database, encryptionKey, cases, scanner:documentScanner,
  }) : null;
  return createOperationalHttp({
    authentication,
    accounts,
    cases,
    contracts,
    invites,
    documents,
    allowedOrigin,
    networkIdentity,
  });
}
