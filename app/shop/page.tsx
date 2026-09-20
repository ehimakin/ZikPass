import { CustomerShell } from "@/components/customer/customer-shell";
import { CardShop } from "@/components/customer/card-shop";

export const metadata = { title: "Zik Card shop", description: "Explore designer and custom Zik Cards and the Zik Card Tracker concept / demo." };

export default function ShopPage() {
  return <CustomerShell active="wallet" back={{ href: "/wallet", label: "Wallet" }}><CardShop /></CustomerShell>;
}
