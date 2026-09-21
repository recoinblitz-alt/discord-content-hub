import logoAsset from "@/assets/muno-logo.png.asset.json";

export function BrandLogo({ className = "h-10 w-10" }: { className?: string }) {
  return <img src={logoAsset.url} alt="MUNO logo" className={`${className} object-contain`} />;
}