// Office Script executado pela ação "Run script" (conector Excel Online Business)
// dentro do fluxo do Power Automate, uma vez para cada arquivo de região recém-copiado
// a partir do Arquivo_Modelo_-_Controle_de_Estoque.xlsx.
//
// Parâmetro "dadosJson": string JSON com o array de linhas daquela região,
// já filtrado no Power Automate (Filter array) a partir do retorno da consulta
// ao Power BI (ver ../dax/consulta_estoque.dax).
//
// Ajuste NOME_PLANILHA / NOME_TABELA para os nomes reais usados no arquivo modelo.

interface LinhaEstoque {
  Group_Type: string;
  Type: string;
  Manufacturer: string;
  Model: string;
  "Serial Number": string;
  "Inventory Number": string;
  Status: string;
  "Sub Region": string;
  Location: string;
}

const NOME_PLANILHA = "Estoque";
const NOME_TABELA = "Controle_Estoque";

function main(workbook: ExcelScript.Workbook, dadosJson: string) {
  const dados: LinhaEstoque[] = JSON.parse(dadosJson);

  const planilha = workbook.getWorksheet(NOME_PLANILHA);
  const tabela = planilha.getTable(NOME_TABELA);

  // Remove qualquer linha de exemplo/anterior, mantendo cabeçalho e formatação.
  const corpo = tabela.getRangeBetweenHeaderAndTotal();
  if (corpo.getRowCount() > 0) {
    corpo.delete(ExcelScript.DeleteShiftDirection.up);
  }

  // Ordem das colunas conforme o arquivo modelo:
  // Group_Type | Type | Manufacturer | Model | Serial Number | Inventory Number |
  // Status | ESTA EM ESTOQUE? | STATUS ATUAL | CHAMADO | COMENTARIOS | Sub Region | Location
  //
  // As 4 colunas centrais (ESTA EM ESTOQUE?, STATUS ATUAL, CHAMADO, COMENTARIOS)
  // ficam em branco: são preenchidas manualmente por quem recebe o arquivo.
  const linhas: string[][] = dados.map((item) => [
    item.Group_Type ?? "",
    item.Type ?? "",
    item.Manufacturer ?? "",
    item.Model ?? "",
    item["Serial Number"] ?? "",
    item["Inventory Number"] ?? "",
    item.Status ?? "",
    "",
    "",
    "",
    "",
    item["Sub Region"] ?? "",
    item.Location ?? "",
  ]);

  if (linhas.length > 0) {
    tabela.addRows(-1, linhas);
  }
}
