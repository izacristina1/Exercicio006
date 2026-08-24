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

A ideia geral, sem nenhum termo técnico: **o fluxo pega o dia 1 do mês e vai
perguntando "esse dia serve?" até achar um dia de semana que não seja
feriado.** Achou, esse é o dia de enviar. Abaixo está o passo a passo de
como isso é montado, bem devagar.

### 2.1 — Descobrir qual é o dia 1 do mês atual

Uma ação (`Inicializar variável`) guarda a data de hoje. Outra ação pega só
o "ano e mês" dessa data e monta o dia 1 — por exemplo, se hoje é
24/08/2026, essa conta dá 01/08/2026. Isso é recalculado sozinho todo mês,
nunca é um valor fixo digitado por alguém.

### 2.2 — Buscar a lista de feriados do mês

Uma ação **"Obter itens"** vai até a lista `FeriadosNacionais` (no site
`GRP-Site Services - Power Platform`) e traz de volta as linhas dessa lista
cujo campo `Date` cai dentro do mês atual. Pense nisso como um "Ctrl+F" que
filtra a lista de feriados e te devolve só os do mês em questão.

O problema é que o que volta dessa busca não é uma lista simples de datas —
é uma lista de **linhas inteiras** da tabela de feriados, cada uma com
várias colunas (título do feriado, quem cadastrou, etc.) e a data vem num
formato cheio de informação extra, tipo `2026-04-21T00:00:00Z` (tem a hora
e o fuso junto). Para o próximo passo, a gente só quer uma listinha limpa
de datas, tipo `2026-04-21`. É para isso que serve o próximo passo.

### 2.3 — Transformar a lista de feriados numa listinha simples de datas

Aqui entra a ação **"Selecionar"** (em inglês aparece como "Select"). Ela
fica em **Operações de Dados** quando você procura por uma nova ação.

**O que essa ação faz, em palavras simples:** ela passa por cada linha da
lista de feriados, uma de cada vez, e você diz "de cada linha, eu só quero
essa informação aqui, formatada assim". No fim, ela te devolve uma lista
nova, só com o que você pediu — bem mais simples que a lista original.

**Exemplo prático**, com dados inventados só para ilustrar:

| Antes (o que veio do SharePoint) | Depois (o que a ação "Selecionar" devolve) |
|---|---|
| Linha 1: Título = "Tiradentes", Date = `2026-04-21T00:00:00Z`, (+ outras colunas) | `"2026-04-21"` |
| Linha 2: Título = "Dia do Trabalho", Date = `2026-05-01T00:00:00Z`, (+ outras colunas) | `"2026-05-01"` |

Ou seja: de uma lista "pesada" com várias colunas por feriado, sobra uma
lista simples de textos com só a data, no formato ano-mês-dia. É essa lista
simples (`varFeriados`) que o fluxo vai usar depois para perguntar
"esse dia que estou testando é feriado?".

**Como configurar na tela:**
1. Adicione a ação **"Selecionar"**.
2. No campo **"De"**, escolha (no menu de conteúdo dinâmico) o resultado da
   ação "Obter itens" do passo 2.2 — ou seja, "de onde eu vou tirar a
   informação".
3. Troque o campo de baixo para o **modo de texto** (tem um botãozinho de
   alternar formato, geralmente com ícone de raio ⚡ ao lado do campo, ou a
   opção "Alternar para modo de entrada de texto"). Isso muda o campo de
   "pares chave/valor" para um campo único de texto.
4. Nesse campo único, você escreve a "receita" de como transformar cada
   linha. A receita usada aqui é:

   ```
   formatDateTime(item()?['Date'],'yyyy-MM-dd')
   ```

   Traduzindo essa receita pedaço por pedaço:
   - `item()` = "a linha que estou olhando agora" (a ação repete essa
     receita para cada linha da lista, uma de cada vez).
   - `item()?['Date']` = "pega o valor da coluna chamada `Date` dessa
     linha".
   - `formatDateTime( ... , 'yyyy-MM-dd')` = "reescreve essa data no
     formato ano-mês-dia, sem hora e sem fuso".

5. Salve. O resultado dessa ação (chame de `varFeriados`) já é a listinha
   simples de datas do exemplo acima.

### 2.4 — Ir testando dia por dia até achar um dia útil

Agora o fluxo faz um "loop" — ou seja, repete um teste várias vezes até
achar a resposta certa. A ação chamada **"Fazer até"** ("Do until") serve
para isso: ela repete os passos de dentro dela até uma condição virar
verdadeira.

Em palavras simples, o fluxo faz assim:

1. Começa testando o dia 1 do mês (calculado no passo 2.1).
2. Pergunta: **esse dia é sábado ou domingo? OU ele está dentro da
   listinha de feriados (`varFeriados`) que montamos no passo 2.3?**
   - Se a resposta for **sim** (é fim de semana ou é feriado): esse dia
     não serve. O fluxo soma 1 dia (testa o dia seguinte) e volta a fazer
     a mesma pergunta.
   - Se a resposta for **não** (não é fim de semana nem feriado): achou!
     Esse é o dia de enviar, e o fluxo para de repetir.

**Exemplo imaginário** para deixar bem concreto: suponha que o dia 1 de um
mês caia num sábado, e o dia 3 (que seria terça) esteja cadastrado como
feriado na lista:

| Dia testado | É fim de semana? | É feriado? | Serve? |
|---|---|---|---|
| Dia 1 (sábado) | Sim | — | Não → testa o dia 2 |
| Dia 2 (domingo) | Sim | — | Não → testa o dia 3 |
| Dia 3 (terça, feriado) | Não | Sim | Não → testa o dia 4 |
| Dia 4 (quarta) | Não | Não | **Sim → esse é o dia de enviar!** |

Isso é exatamente o que a fórmula técnica faz — só que escrita numa
linguagem que o Power Automate entende. Se quiser ver essa fórmula exata
para copiar e colar, ela está em `flow/fluxo-envio-estoque.md`, Bloco 1.

### 2.5 — Só continuar se hoje for o dia certo

Por fim, uma ação de **Condição** compara: **a data de hoje é igual ao
"dia de enviar" que acabamos de descobrir?**
- **Não** → o fluxo para por aqui mesmo (ação "Terminar"). Não manda nada
  hoje. Amanhã ele roda de novo (lembra, ele roda todo dia) e testa de
  novo com a nova data.
- **Sim** → o fluxo segue para a Parte 3, que é onde de fato busca os
  dados e manda os arquivos.

> As fórmulas exatas dessa parte (um pouco mais técnicas) estão no
> `flow/fluxo-envio-estoque.md`, Bloco 1 e Bloco 2.

## Parte 3 — Buscar os dados no Power BI

### 3.1 — Perguntar ao Power BI quais itens existem

Adicione a ação **"Executar uma consulta no dataset"** (é uma ação do
conector Power BI — procure por "Power BI" na busca de ações).

Pense nessa ação como **fazer uma pergunta pronta para a sua tabela do
Power BI**, do tipo "me devolve todos os itens, com estas colunas: tipo,
fabricante, modelo, número de série, região, local...". Essa "pergunta" é
escrita numa linguagem específica (chamada DAX), mas você **não precisa
escrever isso do zero** — já está pronta em `dax/consulta_estoque.dax`,
é só copiar e colar no campo da ação.

**Como configurar:**
1. Escolha, nos campos da ação, o **Workspace** e o **Dataset** onde a
   tabela `ALL ASSETS - ENVIO DE CONTROLE DE ESTOQUE` está publicada.
2. Cole a consulta de `dax/consulta_estoque.dax` no campo de texto da
   consulta.

O que volta dessa ação é uma tabela completa, tipo uma planilha, com uma
linha por item de estoque, de **todas as regiões misturadas**:

| Group_Type | Type | ... | Sub Region | Location |
|---|---|---|---|---|
| Notebook | Ativo | ... | Sul | Porto Alegre |
| Monitor | Ativo | ... | Sul | Curitiba |
| Notebook | Ativo | ... | Norte | Manaus |
| ... | ... | ... | ... | ... |

### 3.2 — Descobrir quais regiões apareceram, sem repetir

Precisamos saber quantas regiões diferentes existem nessa tabela, para
saber quantos arquivos criar (um por região). O problema: a coluna
`Sub Region` vem **repetida** — cada item de estoque é uma linha, e várias
linhas são da mesma região.

**Passo A** — use a ação **"Selecionar"** de novo (a mesma explicada na
Parte 2), agora pegando só a coluna `Sub Region` de cada linha. Isso já
reduz a tabela a uma lista de nomes de região, mas ainda com repetição:

```
["Sul", "Sul", "Norte", "Sul", "Sudeste", "Norte", ...]
```

**Passo B** — para tirar as repetições, use uma ação **"Inicializar
variável"** com a fórmula:

```
union(nome_da_lista_do_passo_A, nome_da_lista_do_passo_A)
```

Isso parece estranho ("juntar a lista com ela mesma"?), mas é um truque
conhecido do Power Automate: a função `union` junta duas listas **sem
deixar repetição** de algo que já existe nas duas. Como as duas listas
aqui são a mesma, tudo já existe nas duas — e o que sobra é a lista sem
repetição:

```
["Sul", "Norte", "Sudeste"]
```

Essa lista final (3 regiões, no exemplo) é o que decide quantos arquivos
serão criados na Parte 4.

## Parte 4 — Um arquivo por região

Aqui usamos uma ação chamada **"Aplicar a cada"** ("Apply to each"). Ela
funciona como um "para cada item desta lista, repita os passos abaixo" —
nesse caso, a lista é a lista de regiões sem repetição da Parte 3.2. Se
deram 3 regiões, esses passos rodam 3 vezes, uma para cada.

Dentro do "Aplicar a cada", para a região da vez, acontece isto:

### 4.1 — Copiar o arquivo modelo

Ação **"Copiar arquivo"** (SharePoint). É basicamente um Ctrl+C / Ctrl+V
automático: pega o `Arquivo_Modelo_-_Controle_de_Estoque.xlsx` e salva uma
cópia dentro da pasta do mês, já com o nome da região no arquivo — por
exemplo, para a região "Sul" em agosto de 2026, o arquivo vira
`Sul_2026-08.xlsx`.

### 4.2 — Separar só os itens dessa região

Ação **"Filtrar matriz"** ("Filter array"). Pega a tabela inteira de itens
(todas as regiões, da Parte 3.1) e devolve só as linhas onde
`Sub Region` é igual à região da vez. Por exemplo, se a tabela tem 50
itens no total e 12 deles são da região "Sul", o resultado dessa ação —
quando a região da vez for "Sul" — é uma listinha com só esses 12 itens.

### 4.3 — Ajustar os nomes dos campos para o script entender

O script que preenche o arquivo (`PopularArquivoEstoque.ts`) espera que
cada item chegue com nomes de campo **sem espaço**, tipo `SerialNumber` em
vez de `Serial Number`. Mas os dados que vieram do Power BI usam nomes
**com espaço**, tipo `Serial Number`. Então, antes de chamar o script, usamos
mais uma ação **"Selecionar"** só para "traduzir" os nomes:

| Campo como vem do Power BI | Campo que o script espera |
|---|---|
| `Serial Number` | `SerialNumber` |
| `Inventory Number` | `InventoryNumber` |
| `Sub Region` | `SubRegion` |
| (não existe) | `EstaEmEstoque` → deixamos como `""` (vazio) |
| (não existe) | `StatusAtual` → `""` (vazio) |
| (não existe) | `Chamado` → `""` (vazio) |
| (não existe) | `Comentarios` → `""` (vazio) |

As colunas `EstaEmEstoque`, `StatusAtual`, `Chamado` e `Comentarios` são
justamente as 4 que ficam em branco de propósito, para quem recebe o
arquivo preencher à mão depois.

### 4.4 — Rodar o script que escreve no arquivo

Ação **"Executar script"** ("Run script", do conector Excel Online
Business). Pense nela como apertar um botão que diz: **"Excel, abre esse
arquivo que acabei de copiar e roda esse programinha aqui dentro, usando
esses dados que preparei."** O programinha é o `PopularArquivoEstoque.ts`
que você já tem pronto — ele escreve cada item na planilha `Referencia`,
tabela `Table1`.

No fim da Parte 4, a pasta do mês já está com um arquivo Excel pronto para
cada região, todos já preenchidos.

## Parte 5 — Link e e-mail

### 5.1 — Criar o link de acesso, válido por 15 dias

O SharePoint tem um botão comum de "Compartilhar" que gera um link, mas
ele **não tem a opção de "esse link expira em 15 dias"** pronta na tela.
Por isso, essa parte é feita com duas ações mais técnicas, chamadas
**"Enviar uma solicitação HTTP com o Azure AD"** — pense nelas como "duas
perguntas diretas para os bastidores do Microsoft 365":

1. A primeira pergunta pede: **"crie um link de acesso para esta pasta,
   que só funcione para gente da empresa (ninguém de fora)."**
2. A segunda pergunta pede: **"nesse link que você acabou de criar, define
   que ele para de funcionar em 15 dias."**

Você não precisa entender a "sintaxe" dessas duas chamadas para acompanhar
a ideia — só saber que são elas que garantem as duas regras que você
pediu: link só para dentro da empresa, e válido por 15 dias. As chamadas
exatas, prontas para copiar, estão em `flow/fluxo-envio-estoque.md`,
Bloco 7.

### 5.2 — Mandar o e-mail

Ação **"Enviar um e-mail (V2)"** (Outlook). A parte mais simples de todas:
- Para: `GRP-powerplatformuser@ldcom365.onmicrosoft.com`
- Assunto: algo como "Controle de Estoque - 08/2026"
- Corpo: um texto avisando que os arquivos do mês estão prontos, com o
  link criado no passo 5.1, e a data em que esse link vai parar de
  funcionar (hoje + 15 dias).

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
