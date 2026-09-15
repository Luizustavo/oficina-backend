# ADR-006 — Duplicar a validação de CPF entre repositórios

**Status:** Aceita · **Data:** 2026-09-13

## Contexto

O algoritmo de validação de CPF (dígitos verificadores) precisa existir em dois lugares:

- `oficina-backend` — `domain/validators/value-objects/cpf.value-object.ts`, usado no cadastro de cliente;
- `oficina-lambda-auth` — `src/cpf.ts`, usado na autenticação.

São repositórios separados, com pipelines e deploys independentes. Não há como compartilhar código por import direto.

## Opções

**Pacote npm compartilhado.** Publicar um `@oficina/shared` num registro privado (GitHub Packages ou CodeArtifact).

Custa: um quinto repositório, uma pipeline de publicação, versionamento semântico, autenticação de registro nos outros dois pipelines, e um ciclo de release a cada mudança. Para trinta linhas.

**Git submodule ou subtree.** Sem registro para manter, mas submodule é notoriamente frágil em CI e cria atrito em todo clone.

**Duplicar.** Copiar o algoritmo, com comentário apontando a origem.

## Decisão

**Duplicar**, com comentário no topo de `src/cpf.ts` declarando de onde veio e por quê.

O fator decisivo é que **este algoritmo não muda**. A regra dos dígitos verificadores do CPF é definida pela Receita Federal e é estável há décadas. O risco normal da duplicação — as cópias divergirem com o tempo — praticamente não existe aqui.

A comparação fica desequilibrada: de um lado, trinta linhas de código imutável copiadas; do outro, um repositório, um registro, uma pipeline e um ciclo de release permanentes.

## Consequências

**Positivas**
- Zero infraestrutura adicional.
- A Lambda não tem dependência de registro privado, o que mantém o bundle pequeno e o `npm ci` do pipeline simples.
- Cada repositório continua deployável de forma independente, que é o objetivo da separação exigida pela fase.

**Negativas**
- **Duas cópias para manter em sincronia.** Se a regra mudasse, seria preciso lembrar dos dois lugares — e nada no sistema força isso.
- Nenhum teste automatizado verifica que as duas implementações concordam.
- Abre precedente: a próxima coisa compartilhada tende a ser duplicada também, por analogia, mesmo quando não for tão estável.

## Mitigação

- Comentário no topo de `src/cpf.ts` nomeando o arquivo de origem no outro repositório.
- Ambas as cópias têm teste unitário próprio, com os mesmos casos de borda: CPF válido com e sem pontuação, dígito verificador errado, todos os dígitos iguais, e entrada malformada.

## Quando revisitar

Se surgir uma **terceira** cópia, ou se algo com regra de negócio instável precisar ser compartilhado. Aí o pacote passa a se pagar. Com dois consumidores e um algoritmo imutável, não se paga.
