import { CustomerShell } from "@/components/customer/customer-shell";
import { ApplicationScreen } from "@/components/customer/vault/application-screen";

export default function ZikIdApplyPage() {
  return <CustomerShell active="pass" title="Apply for Zik ID"><ApplicationScreen /></CustomerShell>;
}
