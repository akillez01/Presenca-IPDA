"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

export default function CartaRecomendacaoPage() {
  const [form, setForm] = useState({
    nome: "",
    rg: "",
    cpf: "",
    endereco: "",
    cidade: "",
    estado: "",
    igrejaOrigem: "",
    pastorOrigem: "",
    igrejaDestino: "",
    pastorDestino: "",
    motivo: "",
    data: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handlePrint() {
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
              size: A4 portrait;
              margin: 0.5in;
            }
            button {
              display: none !important;
            }
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            color: black;
            background: white;
            padding: 20px;
          }
          
          .card {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 40px;
          }
          
          input {
            border: none;
            border-bottom: 1px solid black;
            background: transparent;
            outline: none;
            padding: 2px;
          }
          
          .text-center { text-align: center; }
          .text-justify { text-align: justify; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-semibold { font-weight: 600; }
          .mb-4 { margin-bottom: 1rem; }
          .mb-6 { margin-bottom: 1.5rem; }
          .mb-8 { margin-bottom: 2rem; }
          .mt-4 { margin-top: 1rem; }
          .mt-8 { margin-top: 2rem; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .flex-col { flex-direction: column; }
          .items-center { align-items: center; }
          .text-xs { font-size: 0.75rem; }
          .leading-relaxed { line-height: 1.625; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="text-center mb-6">
            <h2 class="text-xl font-bold mb-1">IGREJA PENTECOSTAL DEUS É AMOR</h2>
            <div class="font-semibold">CARTA DE RECOMENDAÇÃO</div>
          </div>
          <div class="mb-4 text-justify leading-relaxed">
            <span>Pela presente, recomendamos o(a) irmão(ã) </span>
            <input value="${form.nome}" style="width: 14rem;" readonly />
            <span>, portador(a) do RG </span>
            <input value="${form.rg}" style="width: 8rem;" readonly />
            <span> e CPF </span>
            <input value="${form.cpf}" style="width: 8rem;" readonly />
            <span>, residente à </span>
            <input value="${form.endereco}" style="width: 16rem;" readonly />
            <span>, na cidade de </span>
            <input value="${form.cidade}" style="width: 10rem;" readonly />
            <span> - </span>
            <input value="${form.estado}" style="width: 4rem;" readonly />
            <span>. </span>
          </div>
          <div class="mb-4 text-justify leading-relaxed">
            <span>O(a) mesmo(a) é membro da Igreja Pentecostal Deus é Amor, congregação </span>
            <input value="${form.igrejaOrigem}" style="width: 14rem;" readonly />
            <span>, sob a responsabilidade do pastor </span>
            <input value="${form.pastorOrigem}" style="width: 14rem;" readonly />
            <span>. Por motivos de </span>
            <input value="${form.motivo}" style="width: 14rem;" readonly />
            <span>, está sendo recomendado(a) para congregar na Igreja Pentecostal Deus é Amor, congregação </span>
            <input value="${form.igrejaDestino}" style="width: 14rem;" readonly />
            <span>, sob a responsabilidade do pastor </span>
            <input value="${form.pastorDestino}" style="width: 14rem;" readonly />
            <span>.</span>
          </div>
          <div class="mb-8 mt-8 flex justify-between">
            <div class="flex flex-col items-center">
              <span>______________________________</span>
              <span class="text-xs">Assinatura do Pastor</span>
            </div>
            <div class="flex flex-col items-center">
              <span>______________________________</span>
              <span class="text-xs">Carimbo da Igreja</span>
            </div>
          </div>
          <div class="text-right mt-4">
            <span>Data: </span>
            <input value="${form.data}" style="width: 8rem;" readonly />
          </div>
        </div>
        
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

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 flex justify-center items-start print:bg-white print:py-0 print:px-0">
      <Card className="w-full max-w-2xl mx-auto shadow-lg print:shadow-none print:border-0 print:w-[210mm] print:max-w-[210mm] print:min-h-[297mm] print:p-8 print:box-border">
        <CardHeader className="print:hidden">
          <CardTitle>Carta de Recomendação IPDA</CardTitle>
        </CardHeader>
        <CardContent className="print:p-0 print:m-0">
        <!DOCTYPE html>
        <html>
        <head>
          <title></title>
          <meta charset="utf-8">
          <meta name="robots" content="noindex">
          <style>
            @media print {
              @page {
                size: A4 portrait;
                margin: 0.5in 0.5in 0.5in 0.5in;
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
            }
            
            body {
              font-family: 'Times New Roman', serif;
              line-height: 1.6;
              color: black;
              background: white;
              padding: 20px;
            }
            
            .print\\:hidden {
              display: none !important;
            }
            
            .card {
              max-width: 210mm;
              margin: 0 auto;
              background: white;
              padding: 40px;
            }
            
            input {
              border: none;
              border-bottom: 1px solid black;
              background: transparent;
              outline: none;
              padding: 2px;
            }
            
            .text-center { text-align: center; }
            .text-justify { text-align: justify; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-6 { margin-bottom: 1.5rem; }
            .mb-8 { margin-bottom: 2rem; }
            .mt-4 { margin-top: 1rem; }
            .mt-8 { margin-top: 2rem; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .text-xs { font-size: 0.75rem; }
            .leading-relaxed { line-height: 1.625; }
          </style>
        </head>
        <body>
          <div class="card">
            <form>
              <div class="text-center mb-6">
                <h2 class="font-bold mb-1">IGREJA PENTECOSTAL DEUS É AMOR</h2>
                <div class="font-semibold">CARTA DE RECOMENDAÇÃO</div>
              </div>
              <div class="mb-4 text-justify leading-relaxed">
                <span>Pela presente, recomendamos o(a) irmão(ã) </span>
                <input value="${form.nome}" style="width: 14rem;" />
                <span>, portador(a) do RG </span>
                <input value="${form.rg}" style="width: 8rem;" />
                <span> e CPF </span>
                <input value="${form.cpf}" style="width: 8rem;" />
                <span>, residente à </span>
                <input value="${form.endereco}" style="width: 16rem;" />
                <span>, na cidade de </span>
                <input value="${form.cidade}" style="width: 10rem;" />
                <span> - </span>
                <input value="${form.estado}" style="width: 4rem;" />
                <span>. </span>
              </div>
              <div class="mb-4 text-justify leading-relaxed">
                <span>O(a) mesmo(a) é membro da Igreja Pentecostal Deus é Amor, congregação </span>
                <input value="${form.igrejaOrigem}" style="width: 14rem;" />
                <span>, sob a responsabilidade do pastor </span>
                <input value="${form.pastorOrigem}" style="width: 14rem;" />
                <span>. Por motivos de </span>
                <input value="${form.motivo}" style="width: 14rem;" />
                <span>, está sendo recomendado(a) para congregar na Igreja Pentecostal Deus é Amor, congregação </span>
                <input value="${form.igrejaDestino}" style="width: 14rem;" />
                <span>, sob a responsabilidade do pastor </span>
                <input value="${form.pastorDestino}" style="width: 14rem;" />
                <span>.</span>
              </div>
              <div class="mb-8 mt-8 flex justify-between">
                <div class="flex flex-col items-center">
                  <span>______________________________</span>
                  <span class="text-xs">Assinatura do Pastor</span>
                </div>
                <div class="flex flex-col items-center">
                  <span>______________________________</span>
                  <span class="text-xs">Carimbo da Igreja</span>
                </div>
              </div>
              <div class="text-right mt-4">
                <span>Data: </span>
                <input value="${form.data}" style="width: 8rem;" />
              </div>
            </form>
          </div>
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

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 flex justify-center items-start print:bg-white print:py-0 print:px-0">
      <Card className="w-full max-w-2xl mx-auto shadow-lg print:shadow-none print:border-0 print:w-[210mm] print:max-w-[210mm] print:min-h-[297mm] print:p-8 print:box-border">
        <CardHeader className="print:hidden">
          <CardTitle>Carta de Recomendação IPDA</CardTitle>
        </CardHeader>
        <CardContent className="print:p-0 print:m-0">
          <form className="space-y-4 print:space-y-2 print:text-black print:text-base print:leading-tight print:font-normal print:w-full print:max-w-full print:overflow-visible">
            <div className="text-center mb-6 print:mb-2">
              <h2 className="text-xl font-bold mb-1">IGREJA PENTECOSTAL DEUS É AMOR</h2>
              <div className="font-semibold">CARTA DE RECOMENDAÇÃO</div>
            </div>
            <div className="mb-4 text-justify leading-relaxed">
              <span>Pela presente, recomendamos o(a) irmão(ã) </span>
              <input name="nome" value={form.nome} onChange={handleChange} className="border-b border-black outline-none px-1 w-56 print:w-56 bg-transparent" placeholder="Nome completo" required />
              <span>, portador(a) do RG </span>
              <input name="rg" value={form.rg} onChange={handleChange} className="border-b border-black outline-none px-1 w-32 print:w-32 bg-transparent" placeholder="RG" />
              <span> e CPF </span>
              <input name="cpf" value={form.cpf} onChange={handleChange} className="border-b border-black outline-none px-1 w-32 print:w-32 bg-transparent" placeholder="CPF" />
              <span>, residente à </span>
              <input name="endereco" value={form.endereco} onChange={handleChange} className="border-b border-black outline-none px-1 w-64 print:w-64 bg-transparent" placeholder="Endereço" />
              <span>, na cidade de </span>
              <input name="cidade" value={form.cidade} onChange={handleChange} className="border-b border-black outline-none px-1 w-40 print:w-40 bg-transparent" placeholder="Cidade" />
              <span> - </span>
              <input name="estado" value={form.estado} onChange={handleChange} className="border-b border-black outline-none px-1 w-16 print:w-16 bg-transparent" placeholder="UF" />
              <span>. </span>
            </div>
            <div className="mb-4 text-justify leading-relaxed">
              <span>O(a) mesmo(a) é membro da Igreja Pentecostal Deus é Amor, congregação </span>
              <input name="igrejaOrigem" value={form.igrejaOrigem} onChange={handleChange} className="border-b border-black outline-none px-1 w-56 print:w-56 bg-transparent" placeholder="Igreja de origem" />
              <span>, sob a responsabilidade do pastor </span>
              <input name="pastorOrigem" value={form.pastorOrigem} onChange={handleChange} className="border-b border-black outline-none px-1 w-56 print:w-56 bg-transparent" placeholder="Pastor origem" />
              <span>. Por motivos de </span>
              <input name="motivo" value={form.motivo} onChange={handleChange} className="border-b border-black outline-none px-1 w-56 print:w-56 bg-transparent" placeholder="Motivo da recomendação" />
              <span>, está sendo recomendado(a) para congregar na Igreja Pentecostal Deus é Amor, congregação </span>
              <input name="igrejaDestino" value={form.igrejaDestino} onChange={handleChange} className="border-b border-black outline-none px-1 w-56 print:w-56 bg-transparent" placeholder="Igreja destino" />
              <span>, sob a responsabilidade do pastor </span>
              <input name="pastorDestino" value={form.pastorDestino} onChange={handleChange} className="border-b border-black outline-none px-1 w-56 print:w-56 bg-transparent" placeholder="Pastor destino" />
              <span>.</span>
            </div>
            <div className="mb-8 mt-8 flex justify-between">
              <div className="flex flex-col items-center">
                <span>______________________________</span>
                <span className="text-xs">Assinatura do Pastor</span>
              </div>
              <div className="flex flex-col items-center">
                <span>______________________________</span>
                <span className="text-xs">Carimbo da Igreja</span>
              </div>
            </div>
            <div className="text-right mt-4">
              <span>Data: </span>
              <input name="data" value={form.data} onChange={handleChange} className="border-b border-black outline-none px-1 w-32 print:w-32 bg-transparent" placeholder="__/__/____" />
            </div>
            <div className="flex justify-end gap-2 mt-8 print:hidden">
              <Button type="button" onClick={handlePrint} variant="outline">Imprimir / Salvar PDF</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
