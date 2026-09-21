import logoUrl from "@/assets/muno-logo.png";

export function BrandLogo({ className = "h-10 w-10" }: { className?: string }) {
  return <img src={logoUrl} alt="MUNO logo" className={`${className} object-contain`} />;
}
