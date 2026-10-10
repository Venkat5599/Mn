const ORACLE_URL = process.env.ORACLE_URL ?? "http://187.127.137.136:9796";

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@hyperhedge/sdk"],
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  // The oracle API is plain HTTP on the VPS; proxying it keeps the HTTPS site free of mixed content.
  async rewrites() {
    return [{ source: "/api/oracle/:path*", destination: `${ORACLE_URL}/:path*` }];
  },
};
