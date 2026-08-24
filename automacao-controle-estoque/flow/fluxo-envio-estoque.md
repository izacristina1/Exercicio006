# Fluxo: Envio Mensal do Controle de Estoque

Cloud Flow (Power Automate, licença Premium) a ser criado do zero no ambiente
correto (mesmo ambiente/tenant do SharePoint `NLT-ITInfrastructure` e do
workspace do Power BI). Este documento é o roteiro de construção — não existe
exportação `.zip` porque o fluxo depende de conexões específicas do tenant
(SharePoint, Excel Online Business, Power BI, Outlook, HTTP com Azure AD).

## Visão geral

1. Roda todo dia (recorrência diária).
2. Calcula o 1º dia útil do mês corrente, considerando fins de semana e a
   lista `FeriadosNacionais`.
3. Se hoje **não** for esse dia, o fluxo termina sem fazer nada.
4. Se for, consulta a tabela do Power BI, separa os dados por `Sub Region`,
   gera um arquivo Excel por região dentro da pasta do mês, cria um link de
   compartilhamento válido por 15 dias e envia um único e-mail com esse link.

## Estrutura de pastas no SharePoint

Biblioteca de documentos dedicada (sugestão: `ControleDeEstoque` no site
`NLT-ITInfrastructure`, mesmo site do arquivo modelo):

```
ControleDeEstoque/
  2026-08/
    Norte_2026-08.xlsx
    Sul_2026-08.xlsx
    Sudeste_2026-08.xlsx
    ...
  2026-09/
    ...
```

Cada execução mensal cria a pasta `AAAA-MM` e, dentro dela, um arquivo por
`Sub Region` distinta encontrada nos dados daquele mês.

## Passo a passo

### Gatilho
- **Recorrência**: a cada 1 dia, horário de execução sugerido 07:00,
  fuso horário `E. South America Standard Time` (Brasília).

### Bloco 1 — Descobrir o 1º dia útil do mês

1. `Inicializar variável` `varDataAtual` (String) =
   `convertTimeZone(utcNow(),'UTC','E. South America Standard Time','yyyy-MM-dd')`
2. `Inicializar variável` `varPrimeiroDiaMes` (String) =
   `concat(substring(variables('varDataAtual'),0,8),'01')`
3. `Inicializar variável` `varUltimoDiaMes` (String) =
   `formatDateTime(addDays(addToTime(variables('varPrimeiroDiaMes'),1,'Month'),-1),'yyyy-MM-dd')`
4. **Obter itens** (SharePoint) — Site: `GRP-Site Services - Power Platform`
   (`https://ldcom365.sharepoint.com/sites/GRP-SiteServices-PowerPlatform`),
   Lista: `FeriadosNacionais`.
   Query de filtro (`Filter Query`):
   `Date ge datetime'@{variables('varPrimeiroDiaMes')}' and Date le datetime'@{variables('varUltimoDiaMes')}'`
5. **Select** `varFeriados` = a partir da saída do passo anterior, mapear
   cada item para `formatDateTime(item()?['Date'],'yyyy-MM-dd')` (array de
   strings `AAAA-MM-DD`).
6. `Inicializar variável` `varDataCandidata` (String) =
   `variables('varPrimeiroDiaMes')`
7. `Inicializar variável` `varDiaUtilEncontrado` (Boolean) = `false`
8. **Do until** `varDiaUtilEncontrado` é igual a `true`:
   1. `Compose` `nomeDia` = `formatDateTime(variables('varDataCandidata'),'dddd')`
   2. **Condição**: `nomeDia` está em `['Saturday','Sunday']`
      **OU** `contains(variables('varFeriados'), formatDateTime(variables('varDataCandidata'),'yyyy-MM-dd'))`
      - **Sim** → `Definir variável` `varDataCandidata` =
        `formatDateTime(addDays(variables('varDataCandidata'),1),'yyyy-MM-dd')`
      - **Não** → `Definir variável` `varDiaUtilEncontrado` = `true`

   > Observação: `formatDateTime(...,'dddd')` retorna o nome do dia no idioma
   > configurado no ambiente do fluxo. Se o ambiente estiver em português,
   > compare com `['sábado','domingo']`. Confirme o idioma antes de publicar.

9. `Definir variável` `varPrimeiroDiaUtil` = `variables('varDataCandidata')`

### Bloco 2 — Executa só no dia certo

**Condição**: `variables('varDataAtual')` é igual a `variables('varPrimeiroDiaUtil')`

- **Não** → `Terminar` (Status: `Ignorado`, Mensagem: "Hoje não é o 1º dia útil do mês").
- **Sim** → segue para o Bloco 3.

### Bloco 3 — Consultar o Power BI

10. **Executar uma consulta no dataset** (conector Power BI, Premium)
    - Workspace: workspace onde o relatório está publicado.
    - Dataset: dataset que contém a tabela `ALL ASSETS - ENVIO DE CONTROLE
      DE ESTOQUE`.
    - Query: conteúdo de `../dax/consulta_estoque.dax`.
    - Saída relevante: `body('Executar_uma_consulta_no_dataset')?['results'][0]['tables'][0]['rows']`

11. `Compose` `varLinhasEstoque` = a saída acima (array de objetos com
    `Group_Type`, `Type`, `Manufacturer`, `Model`, `Serial Number`,
    `Inventory Number`, `Status`, `Sub Region`, `Location`).

### Bloco 4 — Regiões distintas

12. **Select** `varSubRegioes` = a partir de `outputs('Compose_varLinhasEstoque')`,
    mapear cada item para `item()?['Sub Region']`.
13. `Definir variável` `varRegioesUnicas` (Array) =
    `union(outputs('Select_varSubRegioes'), outputs('Select_varSubRegioes'))`
    (truque padrão do Power Automate para deduplicar um array de valores
    simples).

### Bloco 5 — Pasta do mês

14. `Compose` `varPastaMes` = `formatDateTime(variables('varPrimeiroDiaUtil'),'yyyy-MM')`
15. **Criar nova pasta** (SharePoint) — Site: `NLT-ITInfrastructure`,
    Biblioteca: `ControleDeEstoque`, Caminho da pasta:
    `ControleDeEstoque/@{outputs('Compose_varPastaMes')}`
    - Configurar "Executar depois" (`Configure run after`) para continuar em
      caso de falha `Já existe` (o conector retorna erro se a pasta já
      existir; isso é esperado em reexecuções).

### Bloco 6 — Um arquivo por região (Apply to each `varRegioesUnicas`)

Para cada `item()` (nome da `Sub Region`):

16. **Copiar arquivo** (SharePoint)
    - Origem: `Arquivo_Modelo_-_Controle_de_Estoque.xlsx`
      (`sourcedoc={C7743E19-9A38-4525-B60D-75F3771A87A0}`, site
      `NLT-ITInfrastructure`).
    - Destino:
      `ControleDeEstoque/@{outputs('Compose_varPastaMes')}/@{item()}_@{outputs('Compose_varPastaMes')}.xlsx`
    - Se já existir: substituir (`Overwrite`: `true`) — cobre reexecuções.

17. **Filter array** `varLinhasRegiao` — a partir de `varLinhasEstoque`,
    condição: `item()?['Sub Region']` é igual a `item()` (região do loop
    atual).

18. **Run script** (Excel Online Business)
    - Localização/Documento: arquivo criado no passo 16 (usar o `Id` do
      item retornado por "Copiar arquivo").
    - Script: `../scripts/PopularArquivoEstoque.ts`.
    - Parâmetro `dadosJson`: `string(body('Filter_array_varLinhasRegiao'))`

### Bloco 7 — Link de compartilhamento (15 dias, escopo organização)

Como o Graph exige duas chamadas para link com expiração + escopo
organização, isso é feito **uma vez**, para a pasta do mês inteira (todos os
arquivos de região ficam acessíveis por esse único link) — depois do loop.

19. **Enviar uma solicitação HTTP com o Azure AD** (conector Premium)
    - Método: `POST`
    - URI: `https://graph.microsoft.com/v1.0/drives/{drive-id}/items/{folder-item-id}/createLink`
      (obter `drive-id` e `folder-item-id` a partir da saída de "Criar nova
      pasta" / uma chamada `GET .../items/root:/ControleDeEstoque/{mes}`).
    - Corpo:
      ```json
      { "type": "edit", "scope": "organization" }
      ```
    - Saída relevante: `body('Criar_link')?['id']` (id da permission) e
      `body('Criar_link')?['link']?['webUrl']`.

20. **Enviar uma solicitação HTTP com o Azure AD** — define a expiração:
    - Método: `PATCH`
    - URI: `https://graph.microsoft.com/v1.0/drives/{drive-id}/items/{folder-item-id}/permissions/@{body('Criar_link')?['id']}`
    - Corpo:
      ```json
      { "expirationDateTime": "@{formatDateTime(addDays(utcNow(),15),'yyyy-MM-ddTHH:mm:ssZ')}" }
      ```

### Bloco 8 — E-mail único

21. **Obter itens** (SharePoint) — lista `ConfigDestinatariosEstoque`
    (ver `../README.md` → "Configuração de destinatários") para montar a
    lista de e-mails.
22. `Compose` `varDestinatarios` = `join(body('Obter_itens_destinatarios')?['value'], ';')`
    (usar a expressão adequada para extrair a coluna `Email` de cada item,
    ex.: via `Select` antes do `join`).
23. **Enviar um e-mail (V2)** (Office 365 Outlook)
    - Para: `outputs('Compose_varDestinatarios')`
    - Assunto: `Controle de Estoque - @{formatDateTime(variables('varPrimeiroDiaUtil'),'MM/yyyy')}`
    - Corpo (HTML): explica que os arquivos por região do mês estão na
      pasta, inclui `@{body('Criar_link')?['link']?['webUrl']}` e informa
      que o link expira em `@{formatDateTime(addDays(utcNow(),15),'dd/MM/yyyy')}`.

## Reexecução / idempotência

- "Criar nova pasta" e "Copiar arquivo" já toleram reexecução no mesmo mês
  (pasta existente é ignorada; arquivo é sobrescrito).
- Rodar o fluxo manualmente fora do 1º dia útil é seguro: o Bloco 2 termina
  o fluxo sem enviar nada.
