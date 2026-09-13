import { CustomerShell } from "@/components/customer/customer-shell";
import { ZikIdScreen } from "@/components/customer/zik-id-screen";

export default function ZikIdPage() {
  return <CustomerShell active="pass" title="Zik ID"><ZikIdScreen /></CustomerShell>;
}
