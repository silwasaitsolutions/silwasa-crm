/** Only same-site relative admin paths are allowed as a post-login destination (no open redirects). */
export function safeNext(next: string | null | undefined): string {
  return next && /^\/admin(\/[A-Za-z0-9\-_/]*)?$/.test(next) ? next : "/admin";
}
