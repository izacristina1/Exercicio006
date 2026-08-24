# Automação — Envio Mensal do Controle de Estoque

Desenho de implementação para o Power Automate (licença Premium) que envia,
no 1º dia útil de cada mês, um arquivo Excel de controle de estoque por
região, com um link de compartilhamento válido por 15 dias.

**Começe por aqui:** [`GUIA-FACIL.md`](./GUIA-FACIL.md) — o passo a passo em
linguagem simples, sem jargão técnico. Os outros arquivos deste pacote
(`flow/`, `dax/`, `scripts/`) são a referência técnica com os nomes de
campos e fórmulas exatas, para quando for de fato montar o fluxo.

## Objetivo

- Fonte dos dados: tabela **`ALL ASSETS - ENVIO DE CONTROLE DE ESTOQUE`**
  em um dataset do Power BI.
- Um arquivo Excel é gerado por `Sub Region`, a partir do arquivo modelo
  [`Arquivo_Modelo_-_Controle_de_Estoque.xlsx`](https://ldcom365.sharepoint.com/:x:/r/sites/NLT-ITInfrastructure/_layouts/15/Doc.aspx?sourcedoc=%7BC7743E19-9A38-4525-B60D-75F3771A87A0%7D&file=Arquivo_Modelo_-_Controle_de_Estoque.xlsx&action=default&mobileredirect=true).
- Os arquivos de cada mês ficam em uma pasta `AAAA-MM`, separados por
  região.
- É enviado **um único e-mail** por ciclo, para o grupo
  `GRP-powerplatformuser@ldcom365.onmicrosoft.com`, com o link (escopo
  organização, válido 15 dias) para a pasta do mês.
- O envio ocorre no 1º dia útil do mês, calculado **dinamicamente a cada
  execução** (nenhuma data fixa no fluxo — usa `startOfMonth()` sobre a data
  do dia, ver `flow/fluxo-envio-estoque.md` → Bloco 1): se cair em fim de
  semana ou em feriado nacional, avança para o próximo dia útil. A lista de
  feriados é a lista SharePoint **`FeriadosNacionais`** (coluna `Date`) no
  site [`GRP-Site Services - Power Platform`](https://ldcom365.sharepoint.com/sites/GRP-SiteServices-PowerPlatform).

## Mapeamento de colunas

O arquivo modelo tem a tabela:

| Coluna | Origem |
|---|---|
| Group_Type | Power BI |
| Type | Power BI |
| Manufacturer | Power BI |
| Model | Power BI |
| Serial Number | Power BI |
| Inventory Number | Power BI |
| Status | Power BI |
| ESTA EM ESTOQUE? | **Preenchimento manual** (feito por quem recebe o arquivo) |
| STATUS ATUAL | **Preenchimento manual** |
| CHAMADO | **Preenchimento manual** |
| COMENTARIOS | **Preenchimento manual** |
| Sub Region | Power BI |
| Location | Power BI |
| Region | Power BI |
| UserName | Power BI |

As 4 colunas manuais são sempre enviadas em branco — o script que popula o
arquivo (`scripts/PopularArquivoEstoque.ts`) nunca escreve nelas.

> `Region` e `UserName` foram incluídas porque o script de preenchimento
> (já em uso) espera esses dois campos por linha, além das colunas do
> arquivo modelo original. Confirme se esses nomes de coluna existem
> exatamente assim na tabela `ALL ASSETS - ENVIO DE CONTROLE DE ESTOQUE`.

## Estrutura deste pacote

```
automacao-controle-estoque/
  README.md                        # este arquivo
  dax/consulta_estoque.dax         # query usada na ação "Run a query against a dataset"
  scripts/PopularArquivoEstoque.ts # Office Script rodado via ação "Run script"
  flow/fluxo-envio-estoque.md      # passo a passo completo do Cloud Flow
```

## Como implantar

1. Confirme os identificadores reais (não estão fixados aqui por
   dependerem do tenant):
   - Workspace e Dataset do Power BI onde a tabela `ALL ASSETS - ENVIO DE
     CONTROLE DE ESTOQUE` já está publicada.
   - Biblioteca de documentos onde as pastas mensais serão criadas
     (sugestão: `ControleDeEstoque` no site `NLT-ITInfrastructure`).
   - A planilha `Referencia` / tabela `Table1` já existem no arquivo
     modelo e são usadas como estão pelo script — não precisam de ajuste.
2. Destinatário do e-mail mensal já definido, sem lista de configuração:
   `GRP-powerplatformuser@ldcom365.onmicrosoft.com`.
3. Siga `flow/fluxo-envio-estoque.md` passo a passo para montar o Cloud
   Flow no Power Automate, usando as conexões: SharePoint, Power BI
   (Premium), Excel Online (Business), HTTP com Azure AD (Premium) e
   Office 365 Outlook.
4. O script `scripts/PopularArquivoEstoque.ts` já está pronto e em uso —
   confirme que ele está salvo em **Excel Online → Automatizar** em local
   acessível pela conta usada na conexão do fluxo, para aparecer como
   opção na ação "Run script".
5. Rode o fluxo manualmente uma vez fora do horário de produção para
   validar: cálculo do 1º dia útil, criação da pasta, geração dos arquivos
   por região e o e-mail final.

## Por que essas escolhas

- **Escopo do link = organização (não anônimo)**: dados de estoque/patrimônio
  são internos; um link anônimo poderia vazar para fora da empresa.
- **Expiração via Microsoft Graph (`createLink` + `PATCH permissions`)**:
  o conector padrão de "Criar link de compartilhamento" do SharePoint não
  permite definir `expirationDateTime`; por isso o fluxo usa duas chamadas
  HTTP com Azure AD (ação Premium) contra o Graph, que suporta expiração.
- **Um link por pasta do mês, não por arquivo**: reflete a decisão de
  mandar "um único e-mail com a pasta do mês" — todos os arquivos de região
  daquele mês compartilham o mesmo link e a mesma janela de 15 dias.
- **`startOfMonth()` em vez de manipulação de string**: o 1º dia do mês é
  recalculado a cada execução a partir da data atual — não há nenhum dia
  fixo escrito no fluxo.
