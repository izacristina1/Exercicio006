# Automação — Envio Mensal do Controle de Estoque

Desenho de implementação para o Power Automate (licença Premium) que envia,
no 1º dia útil de cada mês, um arquivo Excel de controle de estoque por
região, com um link de compartilhamento válido por 15 dias.

## Objetivo

- Fonte dos dados: tabela **`ALL ASSETS - ENVIO DE CONTROLE DE ESTOQUE`**
  em um dataset do Power BI.
- Um arquivo Excel é gerado por `Sub Region`, a partir do arquivo modelo
  [`Arquivo_Modelo_-_Controle_de_Estoque.xlsx`](https://ldcom365.sharepoint.com/:x:/r/sites/NLT-ITInfrastructure/_layouts/15/Doc.aspx?sourcedoc=%7BC7743E19-9A38-4525-B60D-75F3771A87A0%7D&file=Arquivo_Modelo_-_Controle_de_Estoque.xlsx&action=default&mobileredirect=true).
- Os arquivos de cada mês ficam em uma pasta `AAAA-MM`, separados por
  região.
- É enviado **um único e-mail** por ciclo, com o link (escopo organização,
  válido 15 dias) para a pasta do mês.
- O envio ocorre no 1º dia útil do mês: se cair em fim de semana ou em
  feriado nacional, avança para o próximo dia útil. A lista de feriados é a
  lista SharePoint **`FeriadosNacionais`** (coluna `Date`) no site
  [`GRP-Site Services - Power Platform`](https://ldcom365.sharepoint.com/sites/GRP-SiteServices-PowerPlatform).

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

As 4 colunas manuais são sempre enviadas em branco — o script que popula o
arquivo (`scripts/PopularArquivoEstoque.ts`) nunca escreve nelas.

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
     CONTROLE DE ESTOQUE` está publicada.
   - Nome da planilha e da tabela dentro do arquivo modelo (o script usa
     `Estoque` / `Controle_Estoque` como placeholders — ajuste em
     `scripts/PopularArquivoEstoque.ts` se os nomes reais forem outros).
   - Biblioteca de documentos onde as pastas mensais serão criadas
     (sugestão: `ControleDeEstoque` no site `NLT-ITInfrastructure`).
2. Crie a lista de configuração de destinatários no SharePoint:
   **`ConfigDestinatariosEstoque`**, com pelo menos a coluna `Email`
   (uma linha por destinatário do e-mail mensal). Isso evita mexer no fluxo
   sempre que a lista de pessoas mudar.
3. Siga `flow/fluxo-envio-estoque.md` passo a passo para montar o Cloud
   Flow no Power Automate, usando as conexões: SharePoint, Power BI
   (Premium), Excel Online (Business), HTTP com Azure AD (Premium) e
   Office 365 Outlook.
4. Cole o conteúdo de `scripts/PopularArquivoEstoque.ts` como um novo script
   em **Excel Online → Automatizar → Novo Script** (em qualquer pasta do
   OneDrive/SharePoint acessível pela conta usada na conexão do fluxo) para
   que ele apareça como opção na ação "Run script".
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
- **Lista `ConfigDestinatariosEstoque` em vez de e-mails fixos no fluxo**:
  permite adicionar/remover destinatários sem editar o fluxo.
