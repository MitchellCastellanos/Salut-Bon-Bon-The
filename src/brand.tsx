import Image from "next/image";
import Link from "next/link";
import { officialLogo } from "./brand-server";

/** Official logo when `public/brand/logo.svg` exists, otherwise the typographic wordmark. Never a substitute mark. */
export function BrandLogo({ width = 132, height = 62 }: { width?: number; height?: number }) {
  const logo = officialLogo();
  return logo ? <Image src={logo} width={width} height={height} alt="" unoptimized/> : <><span>Salut</span><small>Bon Bon Thé</small></>;
}

export function Brand({ href }: { href: string }) {
  return <Link href={href} className="brand" aria-label="Salut Bon Bon Thé"><BrandLogo/></Link>;
}
