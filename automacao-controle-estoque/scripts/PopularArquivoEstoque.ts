// Office Script executado pela ação "Run script" (conector Excel Online Business)
// dentro do fluxo do Power Automate, uma vez para cada arquivo de região recém-copiado
// a partir do Arquivo_Modelo_-_Controle_de_Estoque.xlsx.
//
// Planilha: "Referencia" — Tabela: "Table1"
//
// Parâmetro "linhas": array de objetos já no formato abaixo. No Power Automate,
// monte esse array com uma ação "Select" a partir do retorno da consulta ao
// Power BI (ver ../dax/consulta_estoque.dax) mapeando cada campo do dataset
// para as chaves da interface LinhaEstoque — deixando EstaEmEstoque, StatusAtual,
// Chamado e Comentarios como string vazia (preenchimento manual por quem recebe
// o arquivo).

interface LinhaEstoque {
  Group_Type: string;
  Type: string;
  Manufacturer: string;
  Model: string;
  SerialNumber: string;
  InventoryNumber: string;
  Status: string;
  EstaEmEstoque: string;
  StatusAtual: string;
  Chamado: string;
  Comentarios: string;
  SubRegion: string;
  Location: string;
  Region: string;
  UserName: string;
}

function main(workbook: ExcelScript.Workbook, linhas: LinhaEstoque[]) {
  let tabela = workbook.getWorksheet("Referencia").getTable("Table1");
  for (let linha of linhas) {
    tabela.addRow(-1, [
      linha.Group_Type, linha.Type, linha.Manufacturer, linha.Model,
      linha.SerialNumber, linha.InventoryNumber, linha.Status, linha.EstaEmEstoque,
      linha.StatusAtual, linha.Chamado, linha.Comentarios, linha.SubRegion,
      linha.Location, linha.Region, linha.UserName
    ]);
  }
}
