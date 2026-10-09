import Link from "next/link";
import { CUP_BASE_PATH } from "@/lib/michuCup";

export default function CupNav({ active }: { active: "fixtures" | "table" }) {
  const tab = (key: "fixtures" | "table", label: string) => (
    <Link
      href={`${CUP_BASE_PATH}/${key}`}
      style={{
        padding: "0.4rem 0.9rem",
        borderRadius: 6,
        textDecoration: "none",
        color: "inherit",
        border: "1px solid #333",
        background: active === key ? "#1c2530" : "transparent",
        fontWeight: active === key ? 600 : 400,
      }}
    >
      {label}
    </Link>
  );

  return (
    <nav style={{ display: "flex", gap: "0.5rem", margin: "1rem 0 1.5rem" }}>
      {tab("fixtures", "Fixtures")}
      {tab("table", "Tables")}
    </nav>
  );
}