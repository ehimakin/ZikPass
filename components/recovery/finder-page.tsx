"use client";

import { useEffect, useState } from "react";
import { ZikLogoMark } from "@/components/zik-logo";
import { Alert, Button, Card } from "@/components/customer/ui";
import { ConversationView } from "@/components/customer/recovery/conversation-view";
import { generateRecoveryKeyPair } from "@/lib/shared/recovery/crypto";
import { decode, encode } from "@/lib/shared/vault";
import * as api from "@/lib/client/recovery/api";

type PublicCard = Awaited<ReturnType<typeof api.getPublicCard>>;

type FinderSession = {
  conversationId: string;
  finderSessionToken: string;
  ownerPublicKey: string;
  secretKey: Uint8Array;
};

function sessionKey(cardId: string) {
  return `zik-recovery-finder:${cardId}`;
}

function loadSession(cardId: string): FinderSession | undefined {
  try {
    const raw = sessionStorage.getItem(sessionKey(cardId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return {
      conversationId: parsed.conversationId,
      finderSessionToken: parsed.finderSessionToken,
      ownerPublicKey: parsed.ownerPublicKey,
      secretKey: decode(parsed.secretKey, 32)
    };
  } catch {
    return undefined;
  }
}

function saveSession(cardId: string, session: FinderSession) {
  try {
    sessionStorage.setItem(
      sessionKey(cardId),
      JSON.stringify({
        conversationId: session.conversationId,
        finderSessionToken: session.finderSessionToken,
        ownerPublicKey: session.ownerPublicKey,
        secretKey: encode(session.secretKey)
      })
    );
  } catch {
    // sessionStorage can be unavailable in private browsing; the chat still works for this page load.
  }
}

export function FinderPage({ cardId }: { cardId: string }) {
  const [card, setCard] = useState<PublicCard | undefined>(undefined);
  const [session, setSession] = useState<FinderSession | undefined>(undefined);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void api.getPublicCard(cardId).then(setCard).catch((err) => setError(err instanceof Error ? err.message : "This recovery card is not recognised."));
    setSession(loadSession(cardId));
  }, [cardId]);

  async function start() {
    setStarting(true);
    setError("");
    try {
      const { publicKey, secretKey } = generateRecoveryKeyPair();
      const result = await api.startConversation(cardId, publicKey);
      const next: FinderSession = {
        conversationId: result.conversationId,
        finderSessionToken: result.finderSessionToken,
        ownerPublicKey: result.ownerPublicKey,
        secretKey
      };
      saveSession(cardId, next);
      setSession(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start a conversation.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--zk-canvas)]">
      <div className="mx-auto flex w-full max-w-[480px] flex-col px-4 py-8">
        <div className="flex items-center gap-2">
          <ZikLogoMark className="h-7 w-7" />
          <span className="text-[15px] font-extrabold tracking-tight text-[#28623c]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-df872f356fe5-1" : undefined}>Zik</span>
        </div>

        {!card ? (
          error ? (
            <div className="mt-6"><Alert tone="critical" title="This recovery card is not recognised">{error}</Alert></div>
          ) : (
            <p className="mt-6 text-[14px] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-df872f356fe5-2" : undefined}>Loading…</p>
          )
        ) : card.revoked ? (
          <div className="mt-6">
            <Alert tone="caution" title="This recovery card is no longer active">
              Its owner has revoked this card. There is no way to contact them through it any more.
            </Alert>
          </div>
        ) : session ? (
          <div className="mt-6">
            <ConversationView
              conversationId={session.conversationId}
              role="finder"
              token={session.finderSessionToken}
              secretKey={session.secretKey}
              peerPublicKey={session.ownerPublicKey}
              onBack={() => setSession(undefined)}
            />
          </div>
        ) : (
          <div className="mt-6">
            <h1 className="text-[24px] font-bold tracking-[-0.02em]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-df872f356fe5-3" : undefined}>Found this phone?</h1>
            <p className="mt-2 text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-df872f356fe5-4" : undefined}>
              Scan-to-contact for its owner. You don&apos;t need an account or an app — start a private, end-to-end encrypted conversation right here. The owner never sees your identity, and you never see theirs unless they choose to share it.
            </p>

            {card.public_return_details?.note ? (
              <Card className="mt-4 p-4">
                <p className="text-[13px] font-semibold text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-df872f356fe5-5" : undefined}>A note from the owner</p>
                <p className="mt-1 text-[14px]">{card.public_return_details.note}</p>
              </Card>
            ) : null}
            {card.public_return_details?.address ? (
              <Card className="mt-3 p-4">
                <p className="text-[13px] font-semibold text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-df872f356fe5-6" : undefined}>Suggested return location</p>
                <p className="mt-1 text-[14px]">{card.public_return_details.address}</p>
              </Card>
            ) : null}

            <div className="mt-4">
              <Alert tone="info" title="If this phone has no power">
                A screen-based code only works while a screen can show it. If you&apos;re holding a printed card or a sticker instead, the same code and link work exactly the same way.
              </Alert>
            </div>

            {error ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{error}</p> : null}

            <Button type="button" size="lg" className="mt-5" loading={starting} onClick={() => void start()}>
              I found this phone
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
