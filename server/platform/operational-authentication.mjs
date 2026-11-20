// Service boundary for real staff login. The transport must derive network
// identity from a trusted proxy and enforce CSRF, origin and cookie settings.
export class OperationalAuthenticationService {
  constructor({ limiter, mfa }) {
    if (!limiter?.checkLogin || !mfa?.authenticate)
      throw new Error("Dependências obrigatórias ausentes.");
    this.limiter = limiter;
    this.mfa = mfa;
  }
  async login({ email, password, code, trustedNetworkAddress }) {
    if (typeof email !== "string" || email.length > 254 ||
        typeof trustedNetworkAddress !== "string" ||
        !trustedNetworkAddress || trustedNetworkAddress.length > 128)
      return { authenticated: false, retryAfterSeconds: 0 };
    // Always debit both identities, even if the password is invalid.
    // Database outages reject the request; do not fall back to local counters.
    const allowance = await this.limiter.checkLogin(email, trustedNetworkAddress);
    if (!allowance.allowed)
      return { authenticated: false, retryAfterSeconds: allowance.retryAfterSeconds };
    const session = await this.mfa.authenticate(email, password, code);
    return session
      ? { authenticated: true, session, retryAfterSeconds: 0 }
      : { authenticated: false, retryAfterSeconds: 0 };
  }
}
