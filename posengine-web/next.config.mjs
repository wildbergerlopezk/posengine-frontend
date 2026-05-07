/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  trailingSlash: true,  
  assetPrefix: "./",    
};

export default nextConfig;