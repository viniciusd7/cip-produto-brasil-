import Image from "next/image";

export function BrandLogo({
  variant = "full",
  priority = false,
  className = "",
}: {
  variant?: "full" | "mark";
  priority?: boolean;
  className?: string;
}) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/cip-logo.png"
        alt="CIP"
        width={120}
        height={36}
        priority={priority}
        className={`brand-logo brand-logo--mark ${className}`.trim()}
        style={{ width: "auto", height: 28, objectFit: "contain" }}
      />
    );
  }

  return (
    <Image
      src="/brand/cip-logo.png"
      alt="Centro de Inteligência Pública"
      width={220}
      height={66}
      priority={priority}
      className={`brand-logo ${className}`.trim()}
      style={{ width: "auto", height: 40, objectFit: "contain" }}
    />
  );
}
