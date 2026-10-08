import { authApi } from "@/app/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (request: Request) => authApi.session(request);
