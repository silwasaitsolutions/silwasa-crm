import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];

/**
 * Coarse gate for the admin area (Next.js 16 "proxy", formerly middleware).
 * It only checks that a session cookie exists so anonymous visitors are redirected early;
 * real verification happens in the protected layout and, authoritatively, in the Express API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!isPublic && !request.cookies.has("sw_access")) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Let server layouts know which URL was requested (used for the post-login redirect).
  const forwarded = new Headers(request.headers);
  forwarded.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers: forwarded } });
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
