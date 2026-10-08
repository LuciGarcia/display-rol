import { authApi } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (request: Request) => authApi.login(request);
export const DELETE = () => authApi.logout();
