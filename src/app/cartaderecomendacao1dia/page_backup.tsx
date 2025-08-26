"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRef, useState } from "react";

export default function CartaRecomendacao1DiaPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [nomePregador, setNomePregador] = useState("");
  const [congregacao, setCongregacao] = useState("");
  const [ipdaDestino, setIpdaDestino] = useState("");

  function handlePrint() {
    if (printRef.current) {
      // Criar o HTML completo da carta
      const cartaHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title></title>
          <meta charset="utf-8">
          <style>
            @media print {
              @page {
                size: A4 landscape;
                margin: 0.2in;
              }
              button {
                display: none !important;
              }
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-print-color-adjust: exact;
              color-adjust: exact;
            }
            
            body {
              font-family: Arial, sans-serif;
              background: white;
              width: 100%;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0.1in;
              transform: scale(1.05);
              transform-origin: center center;
            }
            
            .grid {
              display: flex !important;
              flex-direction: row !important;
              gap: 0.4rem !important;
              width: 100% !important;
              max-width: 11in !important;
              align-items: flex-start !important;
              justify-content: center !important;
            }
            
            .border-2.border-black {
              width: 49.5% !important;
              border: 2px solid black !important;
              padding: 0.5rem !important;
              font-size: 14px !important;
              line-height: 1.4 !important;
              background: white !important;
            }
            
            .border-2.border-black img {
              height: 45px !important;
              width: auto !important;
            }
            
            .border-2.border-black h2 {
              font-size: 16px !important;
              margin: 4px 0 !important;
              font-weight: bold !important;
            }
            
            .border-2.border-black h3 {
              font-size: 15px !important;
              margin: 3px 0 !important;
              font-weight: bold !important;
              text-decoration: underline !important;
            }
            
            .border-2.border-black p {
              font-size: 13px !important;
              margin: 3px 0 !important;
              line-height: 1.4 !important;
            }
            
            .text-xs {
              font-size: 12px !important;
              line-height: 1.3 !important;
            }
            
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .underline { text-decoration: underline; }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .border-b { border-bottom: 1px solid black; }
            .inline-block { display: inline-block; }
            .w-full { width: 100%; }
            .mb-4 { margin-bottom: 0.4rem; }
            .mb-3 { margin-bottom: 0.3rem; }
            .mb-2 { margin-bottom: 0.2rem; }
            .mb-1 { margin-bottom: 0.1rem; }
            .mr-2 { margin-right: 0.2rem; }
            .mt-6 { margin-top: 0.5rem; }
            .mt-3 { margin-top: 0.3rem; }
            .gap-4 { gap: 0.4rem; }
            .gap-2 { gap: 0.2rem; }
            .space-y-2 > * + * { margin-top: 0.15rem; }
            .space-y-1 > * + * { margin-top: 0.08rem; }
            .min-h-\\[20px\\] { min-height: 16px; }
            .min-h-\\[16px\\] { min-height: 14px; }
            .min-w-\\[200px\\] { min-width: 150px; }
            .min-w-\\[120px\\] { min-width: 100px; }
            .h-12 { height: 35px; }
            .h-8 { height: 35px; }
            .text-lg { font-size: 16px; }
            .text-base { font-size: 15px; }
            .text-sm { font-size: 14px; }
            strong { font-weight: bold; }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
          
          <button onclick="window.print()" style="
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          ">🖨️ Imprimir</button>
        </body>
        </html>
      `;
      
      // Criar URL blob sem mostrar localhost
      const blob = new Blob([cartaHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  }
      
      if (printWindow) {
        const printContent = printRef.current.innerHTML;
        
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title></title>
            <meta charset="utf-8">
            <meta name="robots" content="noindex">
            <style>
              @media print {
                @page {
                  size: A4 landscape;
                  margin: 0.2in 0.2in 0.2in 0.2in;
                }
                
                /* Esconder todos os botões na impressão */
                button {
                  display: none !important;
                }
                
                /* Forçar remoção de qualquer cabeçalho/rodapé */
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                }
              }
              
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
              }
              
              body {
                font-family: Arial, sans-serif;
                background: white;
                width: 100%;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0.1in;
                transform: scale(1.05);
                transform-origin: center center;
              }
              
              .grid.grid-cols-1.lg\\:grid-cols-2,
              .grid {
                display: flex !important;
                flex-direction: row !important;
                gap: 0.4rem !important;
                width: 100% !important;
                max-width: 11in !important;
                align-items: flex-start !important;
                justify-content: center !important;
              }
              
              .border-2.border-black {
                width: 49.5% !important;
                border: 2px solid black !important;
                padding: 0.5rem !important;
                font-size: 14px !important;
                line-height: 1.4 !important;
                background: white !important;
              }
              
              .border-2.border-black img {
                height: 45px !important;
                width: auto !important;
              }
              
              .border-2.border-black h2 {
                font-size: 16px !important;
                margin: 4px 0 !important;
                font-weight: bold !important;
              }
              
              .border-2.border-black h3 {
                font-size: 15px !important;
                margin: 3px 0 !important;
                font-weight: bold !important;
                text-decoration: underline !important;
              }
              
              .border-2.border-black p {
                font-size: 13px !important;
                margin: 3px 0 !important;
                line-height: 1.4 !important;
              }
              
              .text-xs {
                font-size: 12px !important;
                line-height: 1.3 !important;
              }
              
              .text-center {
                text-align: center;
              }
              
              .font-bold {
                font-weight: bold;
              }
              
              .font-semibold {
                font-weight: 600;
              }
              
              .underline {
                text-decoration: underline;
              }
              
              .flex {
                display: flex;
              }
              
              .flex-col {
                flex-direction: column;
              }
              
              .items-center {
                align-items: center;
              }
              
              .border-b {
                border-bottom: 1px solid black;
              }
              
              .inline-block {
                display: inline-block;
              }
              
              .w-full {
                width: 100%;
              }
              
              .mb-4 {
                margin-bottom: 0.4rem;
              }
              
              .mb-3 {
                margin-bottom: 0.3rem;
              }
              
              .mb-2 {
                margin-bottom: 0.2rem;
              }
              
              .mb-1 {
                margin-bottom: 0.1rem;
              }
              
              .mr-2 {
                margin-right: 0.2rem;
              }
              
              .mt-6 {
                margin-top: 0.5rem;
              }
              
              .mt-3 {
                margin-top: 0.3rem;
              }
              
              .gap-4 {
                gap: 0.4rem;
              }
              
              .gap-2 {
                gap: 0.2rem;
              }
              
              .space-y-2 > * + * {
                margin-top: 0.15rem;
              }
              
              .space-y-1 > * + * {
                margin-top: 0.08rem;
              }
              
              .min-h-\\[20px\\] {
                min-height: 16px;
              }
              
              .min-h-\\[16px\\] {
                min-height: 14px;
              }
              
              .min-w-\\[200px\\] {
                min-width: 150px;
              }
              
              .min-w-\\[120px\\] {
                min-width: 100px;
              }
              
              .h-12 { height: 35px; }
              .h-8 { height: 35px; }
              
              .text-lg { font-size: 16px; }
              .text-base { font-size: 15px; }
              .text-sm { font-size: 14px; }
              
              strong { font-weight: bold; }
            </meta>
          </head>
          <body>
            ${printContent}
          </body>
          </html>
        `);
        
        printWindow.document.close();
        
        // Aguardar o carregamento completo
        setTimeout(() => {
          printWindow.focus();
          
          // Adicionar botão de impressão na nova janela
          const printButton = printWindow.document.createElement('button');
          printButton.innerHTML = '🖨️ Imprimir';
          printButton.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          `;
          printButton.onclick = () => printWindow.print();
          printWindow.document.body.appendChild(printButton);
          
          // Adicionar script para remover cabeçalhos/rodapés
          const script = printWindow.document.createElement('script');
          script.textContent = `
            // Remover informações do navegador na impressão
            window.onbeforeprint = function() {
              document.title = '';
            };
            
            // Tentar remover URL do histórico temporariamente
            if (window.history && window.history.replaceState) {
              const originalUrl = window.location.href;
              window.history.replaceState(null, '', 'about:blank');
              
              window.onafterprint = function() {
                window.history.replaceState(null, '', originalUrl);
              };
            }
          `;
          printWindow.document.body.appendChild(script);
          
          // Mostrar instruções
          console.log('Carta aberta em nova aba. Use Ctrl+P para imprimir ou clique no botão.');
        }, 500);
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4">
      <Card className="w-full max-w-7xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>Carta de Recomendação para 1 Dia - IPDA</CardTitle>
        </CardHeader>
        
        <CardContent>
          {/* Formulário para preenchimento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-blue-50 rounded-lg print:hidden">
            <div className="space-y-2">
              <Label htmlFor="pregador">Nome do Pregador(a)</Label>
              <Input
                id="pregador"
                value={nomePregador}
                onChange={(e) => setNomePregador(e.target.value)}
                placeholder="Digite o nome completo do pregador"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="congregacao">Nome da Congregação</Label>
              <Input
                id="congregacao"
                value={congregacao}
                onChange={(e) => setCongregacao(e.target.value)}
                placeholder="Digite o nome da congregação"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ipda-destino">IPDA de Destino</Label>
              <Input
                id="ipda-destino"
                value={ipdaDestino}
                onChange={(e) => setIpdaDestino(e.target.value)}
                placeholder="Digite o nome da IPDA de destino"
              />
            </div>
          </div>

          {/* Duas vias lado a lado */}
          <div ref={printRef} className="bg-white p-4 rounded print:p-0 print:shadow-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:gap-4 print-container">
              
              {/* Via 1 */}
              <div className="border-2 border-black p-4 print:p-3 print-via">
                <div className="flex flex-col items-center mb-4">
                  <div className="flex items-center mb-2">
                    <img src="/images/logo_ipda.png" alt="Logo IPDA" className="h-12 mr-2 print:h-8" />
                  </div>
                  
                  <h3 className="text-base font-bold text-center underline print:text-sm">Carta de Recomendação para um dia</h3>
                </div>
                
                <div className="text-sm leading-relaxed space-y-2 print:text-xs print:leading-tight print:space-y-1">
                  <p>
                    Informamos que este pregador(a)
                  </p>
                  <div className="border-b border-black min-h-[20px] text-center print:min-h-[16px]">
                    {nomePregador && <span className="font-semibold">{nomePregador}</span>}
                  </div>
                  
                  <p>o qual congrega nesta congregação</p>
                  <div className="border-b border-black min-h-[20px] text-center print:min-h-[16px]">
                    {congregacao && <span className="font-semibold">{congregacao}</span>}
                  </div>
                  
                  <p>
                    sendo Presbítero (&nbsp;&nbsp;&nbsp;), Diácono (&nbsp;&nbsp;&nbsp;), Cooperador(a) (&nbsp;&nbsp;&nbsp;) ou
                    membro (&nbsp;&nbsp;&nbsp;), desde ___/___/_______, foi enviado para pregar
                    a Palavra de Deus na IPDA de{" "}
                    <span className="border-b border-black min-w-[200px] inline-block text-center print:min-w-[120px]">
                      {ipdaDestino && <span className="font-semibold">{ipdaDestino}</span>}
                    </span>
                    {" "}nesta data ___/___/_______. Por conseguinte, recomendamos
                    que o (a) receba com alegria, na comunhão expressa pelos
                    santos: "A graça do Senhor Jesus Cristo, e o amor de Deus, e
                    a comunhão do Espírito Santo seja com todos vós. Amém"
                  </p>
                  <p className="text-center font-semibold">(2Co 13.13)</p>
                  
                  <div className="flex gap-4 mt-3 print:gap-2 print:mt-2">
                    <span>Cidade: ________________________ UF ________.</span>
                  </div>
                  <p>Dia ____de__________________de_________.</p>
                  
                  <div className="mt-6 mb-4 print:mt-3 print:mb-2">
                    <div className="border-b border-black w-full mb-1">
                      &nbsp;
                    </div>
                    <p className="text-xs text-center">Dirigente</p>
                    <p className="text-xs text-center">(Nome por extenso)</p>
                  </div>
                  
                  <div className="text-xs space-y-1 print:text-xs print:space-y-0">
                    <p><strong>Obs:</strong> É proibido tirar fotocópias desta carta. Somente será aceita a original.</p>
                    <p>* Deve-se assinalar a respectiva função do pregador(a).</p>
                    <p>* O pregador(a) levará duas cartas à congregação que está destinado a pregar: uma via branca e a outra amarela.</p>
                    <p>* As duas, em seus versos, deverão ser datadas, carimbadas com o endereço da IPDA e assinadas pelo dirigente.</p>
                    <p>* O pregador(a) terá de deixar a carta (via amarela) na IPDA a qual foi enviado e trazer a branca à sua congregação e entregá-la ao seu dirigente.</p>
                    <p>* Esta Carta só vale um dia, ou seja, nesta data.</p>
                  </div>
                </div>
              </div>

              {/* Via 2 */}
              <div className="border-2 border-black p-4 print:p-3 print-via">
                <div className="flex flex-col items-center mb-4">
                  <div className="flex items-center mb-2">
                    <img src="/images/logo_ipda.png" alt="Logo IPDA" className="h-12 mr-2 print:h-8" />
                  </div>
                  
                  <h3 className="text-base font-bold text-center underline print:text-sm">Carta de Recomendação para um dia</h3>
                </div>
                
                <div className="text-sm leading-relaxed space-y-2 print:text-xs print:leading-tight print:space-y-1">
                  <p>
                    Informamos que este pregador(a)
                  </p>
                  <div className="border-b border-black min-h-[20px] text-center print:min-h-[16px]">
                    {nomePregador && <span className="font-semibold">{nomePregador}</span>}
                  </div>
                  
                  <p>o qual congrega nesta congregação</p>
                  <div className="border-b border-black min-h-[20px] text-center print:min-h-[16px]">
                    {congregacao && <span className="font-semibold">{congregacao}</span>}
                  </div>
                  
                  <p>
                    sendo Presbítero (&nbsp;&nbsp;&nbsp;), Diácono (&nbsp;&nbsp;&nbsp;), Cooperador(a) (&nbsp;&nbsp;&nbsp;) ou
                    membro (&nbsp;&nbsp;&nbsp;), desde ___/___/_______, foi enviado para pregar
                    a Palavra de Deus na IPDA de{" "}
                    <span className="border-b border-black min-w-[200px] inline-block text-center print:min-w-[120px]">
                      {ipdaDestino && <span className="font-semibold">{ipdaDestino}</span>}
                    </span>
                    {" "}nesta data ___/___/_______. Por conseguinte, recomendamos
                    que o (a) receba com alegria, na comunhão expressa pelos
                    santos: "A graça do Senhor Jesus Cristo, e o amor de Deus, e
                    a comunhão do Espírito Santo seja com todos vós. Amém"
                  </p>
                  <p className="text-center font-semibold">(2Co 13.13)</p>
                  
                  <div className="flex gap-4 mt-3 print:gap-2 print:mt-2">
                    <span>Cidade: ________________________ UF ________.</span>
                  </div>
                  <p>Dia ____de__________________de_________.</p>
                  
                  <div className="mt-6 mb-4 print:mt-3 print:mb-2">
                    <div className="border-b border-black w-full mb-1">
                      &nbsp;
                    </div>
                    <p className="text-xs text-center">Dirigente</p>
                    <p className="text-xs text-center">(Nome por extenso)</p>
                  </div>
                  
                  <div className="text-xs space-y-1 print:text-xs print:space-y-0">
                    <p><strong>Obs:</strong> É proibido tirar fotocópias desta carta. Somente será aceita a original.</p>
                    <p>* Deve-se assinalar a respectiva função do pregador(a).</p>
                    <p>* O pregador(a) levará duas cartas à congregação que está destinado a pregar: uma via branca e a outra amarela.</p>
                    <p>* As duas, em seus versos, deverão ser datadas, carimbadas com o endereço da IPDA e assinadas pelo dirigente.</p>
                    <p>* O pregador(a) terá de deixar a carta (via amarela) na IPDA a qual foi enviado e trazer a branca à sua congregação e entregá-la ao seu dirigente.</p>
                    <p>* Esta Carta só vale um dia, ou seja, nesta data.</p>
                  </div>
                </div>
              </div>
              
            </div>
            
            {/* <div className="text-center mt-4 print:mt-2 print:hidden">
              <p className="text-sm font-bold">carta de recomendação para um dia</p>
              <p className="text-xs">página 1</p>
            </div> */}
          </div>
          
          <div className="mt-6 flex justify-end print:hidden">
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              Imprimir Carta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
