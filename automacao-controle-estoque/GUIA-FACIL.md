# Guia Fácil — Envio Automático do Controle de Estoque

Esse guia explica, em linguagem simples, como montar a automação no Power
Automate. Sem termos técnicos difíceis — só o passo a passo de onde clicar e
o que preencher.

Se em algum momento você (ou quem for montar o fluxo) precisar dos nomes
exatos de campos, das fórmulas prontas para copiar e colar, ou dos detalhes
técnicos do link do Graph, isso está tudo em `flow/fluxo-envio-estoque.md` —
esse guia aqui é o "resumo fácil" do mesmo fluxo.

---

## O que essa automação faz, em uma frase

Todo mês, no primeiro dia útil, o robô olha a planilha do Power BI, separa
os itens por região, cria um arquivo Excel para cada região dentro de uma
pasta do mês no SharePoint, e manda um e-mail com o link dessa pasta —
link que expira sozinho em 15 dias.

## As 5 partes do fluxo

| Parte | O que faz | Por quê |
|---|---|---|
| 1 | Descobre se hoje é o dia de enviar | Só roda no 1º dia útil do mês |
| 2 | Busca os dados no Power BI | É de onde vêm as informações de estoque |
| 3 | Cria uma pasta do mês e um arquivo por região | Organiza o que vai ser enviado |
| 4 | Preenche cada arquivo com os dados da região dele | Usando o script pronto |
| 5 | Cria o link (válido 15 dias) e manda o e-mail | Entrega final |

---

## Antes de começar, tenha em mãos

- [ ] Acesso ao Power Automate com licença Premium (você confirmou que tem).
- [ ] O nome do Workspace e do Dataset no Power BI onde está a tabela
      `ALL ASSETS - ENVIO DE CONTROLE DE ESTOQUE`.
- [ ] Uma pasta/biblioteca no SharePoint onde os arquivos mensais vão ficar
      guardados (sugestão: uma biblioteca chamada `ControleDeEstoque` no
      site `NLT-ITInfrastructure`, o mesmo site do arquivo modelo).
- [ ] O arquivo modelo `Arquivo_Modelo_-_Controle_de_Estoque.xlsx`.
- [ ] O script `scripts/PopularArquivoEstoque.ts` já salvo no
      **Excel Online → Automatizar** (você já tem esse script pronto).
- [ ] O e-mail que vai receber o aviso todo mês:
      `GRP-powerplatformuser@ldcom365.onmicrosoft.com` (já definido, não
      precisa criar nada extra pra isso).

---

## Parte 1 — Criar o fluxo e dizer quando ele roda

1. No Power Automate, clique em **Criar** → **Fluxo de nuvem agendado**.
2. Configure para rodar **todo dia**, uma vez, de manhã (ex.: 7h). Sim,
   todo dia — é o fluxo que vai decidir, sozinho, se hoje é o dia certo de
   enviar ou não. Isso é necessário porque não existe uma opção pronta de
   "rodar só no 1º dia útil do mês".

## Parte 2 — Descobrir se hoje é o dia de enviar

Aqui o fluxo faz 3 coisas, nessa ordem:

1. **Calcula o 1º dia do mês atual** — usando a data de hoje (nunca uma
   data fixa; muda sozinho todo mês).
2. **Consulta a lista de feriados** — a lista `FeriadosNacionais` do site
   `GRP-Site Services - Power Platform` (coluna `Date`), pegando os
   feriados só do mês atual.
3. **Vai avançando dia a dia** a partir do 1º dia do mês até achar um dia
   que não seja fim de semana e não seja feriado. Esse é o "dia de enviar".

Depois disso, o fluxo compara: **a data de hoje é igual ao "dia de
enviar"?**
- Se **não for**, o fluxo simplesmente para por aqui (não faz mais nada
  hoje — amanhã ele roda de novo e testa outra vez).
- Se **for**, ele continua para a Parte 3.

> As fórmulas exatas dessa parte (um pouco mais técnicas) estão no
> `flow/fluxo-envio-estoque.md`, Bloco 1 e Bloco 2.

## Parte 3 — Buscar os dados no Power BI

1. Adicione a ação **"Executar uma consulta no dataset"** (ação do Power
   BI).
2. Escolha o Workspace e o Dataset onde está a tabela
   `ALL ASSETS - ENVIO DE CONTROLE DE ESTOQUE`.
3. Cole a consulta pronta que está em `dax/consulta_estoque.dax` — ela já
   está escrita para trazer só as colunas necessárias.
4. O resultado dessa ação é a lista completa de itens de estoque, de todas
   as regiões juntas.
5. Em seguida, o fluxo separa as regiões que aparecem nessa lista (sem
   repetir), para saber quantos arquivos vai precisar criar.

## Parte 4 — Um arquivo por região

Para cada região encontrada, o fluxo repete estes 3 passos:

1. **Copia o arquivo modelo** para dentro da pasta do mês, já com o nome
   da região (ex.: `Sul_2026-08.xlsx`).
2. **Separa, dos dados do Power BI, só as linhas daquela região.**
3. **Roda o script** `PopularArquivoEstoque.ts` nesse arquivo recém-criado,
   passando essas linhas — o script escreve tudo na planilha `Referencia`,
   tabela `Table1`, e deixa em branco as 4 colunas que são preenchidas à
   mão (`ESTA EM ESTOQUE?`, `STATUS ATUAL`, `CHAMADO`, `COMENTARIOS`).

No fim dessa parte, a pasta do mês já está com um arquivo pronto para cada
região.

## Parte 5 — Link e e-mail

1. O fluxo cria um **link de compartilhamento da pasta do mês inteira**
   (não um link por arquivo — um só, que dá acesso a todos os arquivos de
   região daquele mês).
2. Esse link é configurado para:
   - só funcionar para quem está logado na empresa (não é um link público);
   - **expirar sozinho em 15 dias**.
3. O fluxo manda **um e-mail** para `GRP-powerplatformuser@ldcom365.onmicrosoft.com`
   com esse link e avisando a data em que ele deixa de funcionar.

Pronto — esse é o ciclo completo, que se repete todo mês sozinho.

---

## Perguntas rápidas

**"E se eu rodar o fluxo manualmente num dia qualquer, para testar?"**
Sem problema. Se não for o 1º dia útil do mês, ele para na Parte 2 e não
manda nada. É seguro testar quantas vezes quiser.

**"E se eu rodar duas vezes no mesmo mês, no dia certo?"**
Também sem problema — ele substitui o arquivo daquela região em vez de
duplicar.

**"Preciso mudar alguma coisa todo mês?"**
Não. Data, pasta e feriados são recalculados sozinhos a cada execução.

**"Onde estão as fórmulas técnicas, se eu precisar delas?"**
Em `flow/fluxo-envio-estoque.md`, organizadas na mesma ordem das 5 partes
deste guia.
