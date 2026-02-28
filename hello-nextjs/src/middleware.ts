import { type NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";

const COOKIE_NAME = "auth_token";

export interface AuthUser {
  userId: string;
  email: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = verifyToken(token);
    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const user = await getAuthUser(request);

  const protectedRoutes = ["/projects", "/create"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  const authRoutes = ["/login", "/register"];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
