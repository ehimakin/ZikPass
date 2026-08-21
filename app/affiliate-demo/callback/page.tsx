import { AffiliateCallbackScreen } from "@/components/affiliate-callback-screen";

export default async function AffiliateCallbackPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen bg-[#0b0710] px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-4xl">
        <AffiliateCallbackScreen code={getParam(params.code) ?? null} state={getParam(params.state) ?? null} />
      </div>
    </main>
  );
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
