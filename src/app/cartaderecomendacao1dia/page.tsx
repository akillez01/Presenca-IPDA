"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import html2pdf from "html2pdf.js";
import { useRef, useState } from "react";

export default function CartaRecomendacao1DiaPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [nomePregador, setNomePregador] = useState("");
  const [congregacao, setCongregacao] = useState("");
  const [ipdaDestino, setIpdaDestino] = useState("");

  // ===============================================================
  // CORREÇÃO APLICADA AQUI
  // A função agora clona a área de impressão para garantir 100% que os
  // dados preenchidos sejam capturados pelo PDF.
  // ===============================================================
  async function handleSavePDF() {
    if (printRef.current) {
      const elementToPrint = printRef.current.cloneNode(true) as HTMLDivElement;
      document.body.appendChild(elementToPrint);

      html2pdf()
        .set({
          margin: 0,
          filename: "carta-recomendacao-ipda.pdf",
          image: { type: "jpeg", quality: 1 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
          pagebreak: { mode: ["avoid"] },
        })
        .from(elementToPrint)
        .save()
        .then(() => {
          document.body.removeChild(elementToPrint);
        });
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      {/* NENHUMA ALTERAÇÃO FEITA AQUI */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
          }
          .print-container, .print-container * {
            visibility: visible !important;
          }
           body * {
            visibility: hidden;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
          }
          .print-hidden {
             display: none;
          }
        }
      `}</style>

      <Card className="w-full max-w-7xl mx-auto shadow-lg">
        {/* NENHUMA ALTERAÇÃO FEITA AQUI */}
        <CardHeader className="print:hidden">
          <CardTitle>Carta de Recomendação para 1 Dia - IPDA</CardTitle>
        </CardHeader>

        <CardContent>
          {/* NENHUMA ALTERAÇÃO FEITA AQUI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-blue-50 rounded-lg print:hidden">
            <div>
              <Label htmlFor="pregador">Nome do Pregador(a)</Label>
              <Input
                id="pregador"
                value={nomePregador}
                onChange={(e) => setNomePregador(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="congregacao">Nome da Congregação</Label>
              <Input
                id="congregacao"
                value={congregacao}
                onChange={(e) => setCongregacao(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ipda-destino">IPDA de Destino</Label>
              <Input
                id="ipda-destino"
                value={ipdaDestino}
                onChange={(e) => setIpdaDestino(e.target.value)}
              />
            </div>
          </div>
          
          {/* NENHUMA ALTERAÇÃO FEITA AQUI */}
          <div
            ref={printRef}
            className="print-container bg-white print:bg-white print:p-0 print:rounded-none print:shadow-none"
            style={{
              width: "297mm",
              height: "210mm",
              margin: "0 auto",
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center", // centraliza verticalmente
              boxSizing: "border-box",
              padding: 0,
            }}
          >
            {[1, 2].map((via) => (
              <div
                key={via}
                className="print-via"
                style={{
                  width: "calc(50% - 2px)",
                  minWidth: "calc(50% - 2px)",
                  maxWidth: "calc(50% - 2px)",
                  height: "100%",
                  boxSizing: "border-box",
                  border: "2px solid black",
                  padding: "8px",
                  fontSize: "9pt",
                  lineHeight: 1.2,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                }}
              >
                <div className="flex flex-col items-center justify-center mb-4">
                  <img src="/images/logo_ipda.png" alt="Logo IPDA" style={{ maxWidth: "90%", height: "150px", objectFit: "contain", display: "block", margin: "0 auto 4px auto" }} />
                  <h3 className="text-base font-bold text-center underline">
                    Carta de Recomendação para um dia
                  </h3>
                </div>
                <p>Informamos que este pregador(a)</p>
                {/* ===============================================================
                  CORREÇÃO APLICADA AQUI
                  Adicionado "pb-1" para a linha não cortar o texto.
                  =============================================================== */}
                <div className="border-b border-black text-center pb-1">
                  <span>{nomePregador ? nomePregador : "________________"}</span>
                </div>
                <p>o qual congrega nesta congregação</p>
                <div className="border-b border-black text-center pb-1">
                  <span>{congregacao ? congregacao : "________________"}</span>
                </div>
                <p>
                  sendo Presbítero ( ), Diácono ( ), Cooperador(a) ( ) ou membro
                  ( ), desde ___/___/_______, foi enviado para pregar a Palavra
                  de Deus na IPDA de{" "}
                  <span className="border-b border-black">
                    {ipdaDestino ? ipdaDestino : "________________"}
                  </span>{" "}
                  nesta data ___/___/_______. Por conseguinte, recomendamos que
                  o(a) receba com alegria, na comunhão expressa pelos santos: "A
                  graça do Senhor Jesus Cristo, e o amor de Deus, e a comunhão
                  do Espírito Santo seja com todos vós. Amém"
                </p>
                <p className="text-center font-semibold">(2Co 13.13)</p>
                <p>Cidade: ________________________ UF ________.</p>
                <p>Dia ____ de _________________ de _________.</p>
                <div className="mt-4">
                  <div className="border-b border-black w-full mb-1">&nbsp;</div>
                  <p className="text-xs text-center">Dirigente</p>
                  <p className="text-xs text-center">(Nome por extenso)</p>
                </div>
                <div className="text-xs mt-2">
                  <p>
                    <strong>Obs:</strong> É proibido tirar fotocópias desta
                    carta. Somente será aceita a original.
                  </p>
                  <p>* Deve-se assinalar a respectiva função do pregador(a).</p>
                  <p>
                    * O pregador(a) levará duas cartas à congregação que está
                    destinado a pregar: uma via branca e a outra amarela.
                  </p>
                  <p>
                    * As duas, em seus versos, deverão ser datadas, carimbadas
                    com o endereço da IPDA e assinadas pelo dirigente.
                  </p>
                  <p>
                    * O pregador(a) terá de deixar a carta (via amarela) na IPDA
                    a qual foi enviado e trazer a branca à sua congregação e
                    entregá-la ao seu dirigente.
                  </p>
                  <p>* Esta Carta só vale um dia, ou seja, nesta data.</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* NENHUMA ALTERAÇÃO FEITA AQUI */}
          <div className="mt-6 flex gap-4 justify-end print:hidden">
            <Button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Imprimir Carta
            </Button>
            <Button
              onClick={handleSavePDF}
              className="bg-green-600 hover:bg-green-700"
            >
              Salvar PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}