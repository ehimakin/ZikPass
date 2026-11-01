"use client";
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/customer/ui';

type Detector = { detect(video: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type DetectorConstructor = { new(options: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };
/** Camera is started only by a click; late permission grants and unmounts also stop tracks. */
export function CardScanner({ onScan, disabled }: { onScan: (payload: string) => void; disabled: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  function stop() {
    generation.current++;
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setScanning(false);
  }
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', stop);
    return () => { stop(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', stop); };
  }, []);
  async function start() {
    stop(); setError(''); setScanning(true);
    const epoch = generation.current;
    try {
      const Constructor = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (!Constructor) throw new Error('Camera barcode scanning is unavailable in this browser. Enter the printed serial below.');
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS (or localhost). Enter the serial below.');
      const supported = await Constructor.getSupportedFormats();
      const formats = ['qr_code', 'code_128', 'code_39'].filter(format => supported.includes(format));
      if (!formats.length) throw new Error('Supported card scanners are unavailable. Enter the serial below.');
      if (epoch !== generation.current) return;
      const detector = new Constructor({ formats });
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      if (epoch !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      const read = async () => {
        if (epoch !== generation.current || !video.current) return;
        try {
          const found = await detector.detect(video.current);
          if (epoch !== generation.current) return;
          if (found[0]?.rawValue) { stop(); onScan(found[0].rawValue); return; }
          timer.current = setTimeout(() => void read(), 250);
        } catch { stop(); setError('Could not read the camera. Try again or enter the serial below.'); }
      };
      void read();
    } catch (reason) {
      if (epoch !== generation.current) return;
      stop();
      setError(reason instanceof DOMException && reason.name === 'NotAllowedError' ? 'Camera permission denied. Allow camera access in browser settings, or enter the serial below.' : reason instanceof DOMException && reason.name === 'NotFoundError' ? 'No camera found. Enter the serial below.' : reason instanceof Error ? reason.message : 'Camera unavailable. Enter the serial below.');
    }
  }
  return <div className="space-y-3">
    <video ref={video} muted playsInline hidden={!scanning} className="aspect-video w-full rounded-lg bg-black object-cover" aria-label="Card scanner camera preview" />
    {scanning ? <Button variant="secondary" onClick={stop}>Stop camera</Button> : <Button variant="secondary" disabled={disabled} onClick={() => void start()}>Scan card with camera</Button>}
    {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
  </div>;
}
