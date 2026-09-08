import { CustomerShell } from "@/components/customer/customer-shell";
import { HelpScreen } from "@/components/customer/help-screen";

export default function HelpPage() {
  return (
    <CustomerShell active="help">
      <HelpScreen />
    </CustomerShell>
  );
}
