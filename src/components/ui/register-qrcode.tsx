import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useState } from "react";

export function RegisterQRCode({ url }: { url: string }) {
  const [qrUrl, setQrUrl] = useState(url);

  useEffect(() => {
    setQrUrl(url);
  }, [url]);

  return (
    <div style={{ textAlign: "center", margin: "2rem 0" }}>
      <h2 style={{ marginBottom: "1rem" }}>Acesse o formulário pelo QR Code</h2>
      <QRCodeCanvas value={qrUrl} size={180} />
      <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>{qrUrl}</div>
    </div>
  );
}
