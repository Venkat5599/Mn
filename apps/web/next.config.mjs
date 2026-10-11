const ORACLE_URL = process.env.ORACLE_URL ?? "http://187.127.137.136:9796";
const AGENT_URL = process.env.AGENT_URL ?? "http://187.127.137.136:9795";

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@hyperhedge/sdk"],
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  // The oracle API is plain HTTP on the VPS; proxying it keeps the HTTPS site free of mixed content.
  async rewrites() {
    return [
      { source: "/api/oracle/:path*", destination: `${ORACLE_URL}/:path*` },
      { source: "/api/agent/health", destination: `${AGENT_URL}/health` },
    ];
  },
  webpack(config, { webpack }) {
    // wagmi's connector bundle reaches optional server/payment packages a browser wallet app never loads
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};
