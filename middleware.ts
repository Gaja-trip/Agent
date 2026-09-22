import { next } from "@vercel/functions";
import { authorizeRequest, privateHeaders } from "./access-control.mjs";

export const config = { matcher: "/:path*" };

export default async function middleware(request: Request) {
  const response = await authorizeRequest(request);
  return response || next({ headers: privateHeaders });
}
