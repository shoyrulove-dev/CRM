import Image from "next/image";

export function NichieiBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`nichiei-brand ${compact ? "compact" : ""}`}>
      <span className="nichiei-logo">
        <Image
          src="/brand/nichiei-asia-logo.png"
          alt="Nichiei Asia"
          width={479}
          height={430}
          priority
        />
      </span>
      <span className="nichiei-wordmark">
        <strong>NICHIEI ASIA</strong>
        <small>Customer Relationship Management</small>
      </span>
    </div>
  );
}
