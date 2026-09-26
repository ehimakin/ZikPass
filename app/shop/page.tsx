import { CustomerShell } from "@/components/customer/customer-shell";
import { CardShop } from "@/components/customer/card-shop";

export const metadata = { title: "Physical Zik Card", description: "Get a physical Zik Card at a participating store." };

export default function ShopPage() {
  return <CustomerShell active="wallet" back={{ href: "/wallet", label: "Wallet" }}><CardShop /></CustomerShell>;
}
