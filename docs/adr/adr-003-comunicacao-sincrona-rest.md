# ADR-003 — Comunicação síncrona por REST

**Status:** Aceita · **Data:** 2026-09-13

## Contexto

É preciso definir o padrão de comunicação entre o cliente e a API, e entre a API e suas dependências (banco, serviço de e-mail, função de autenticação).

A alternativa natural seria comunicação assíncrona por mensageria, com eventos de domínio publicados a cada transição de status.

## Decisão

**REST síncrono sobre HTTP** para toda comunicação de entrada, com JSON, e chamada direta síncrona para as dependências.

As exceções de domínio são traduzidas para status HTTP numa única camada, o `HttpExceptionFilter` global:

| Exceção de domínio | HTTP |
|---|---|
| `NotFoundException` | 404 |
| `ConflictException` | 409 |
| `BusinessRuleException` | 422 |
| `InvalidStatusTransitionException` | 422 |

O caso de uso nunca conhece HTTP.

## Justificativa

**O domínio é naturalmente síncrono.** Abrir uma ordem, aprovar um orçamento e consultar o andamento são operações em que o usuário espera pela resposta e precisa saber imediatamente se deu certo. Tornar isso assíncrono adicionaria complexidade de correlação sem benefício para o usuário.

**Não há integração entre serviços.** O sistema é um único serviço de aplicação. Mensageria resolve acoplamento entre serviços — problema que não temos. Introduzir um broker seria criar infraestrutura para um problema inexistente, com custo real em uma `t3.small` de 2 GB.

**A única operação que poderia ser assíncrona já é tolerante a falha.** O envio de e-mail na transição de status é feito em chamada direta, mas a falha é engolida de propósito: uma indisponibilidade do Resend não desfaz a transição. Na prática, tem a propriedade que interessa de uma fila — a operação principal não depende do sucesso da notificação — sem o custo de manter um broker.

## Consequências

**Positivas**
- Um caminho de execução, um lugar para depurar. O trace distribuído mostra a requisição inteira ponta a ponta.
- Erro chega ao usuário no momento em que acontece.
- Sem broker, sem fila, sem *dead letter queue*, sem reprocessamento para operar.

**Negativas**
- **A notificação por e-mail não tem retentativa.** Se o Resend estiver fora, o cliente não recebe aquele aviso — nunca. A falha é medida ([observabilidade](../observabilidade.md)), mas não recuperada.
- **A latência do e-mail entra na resposta.** A chamada ao Resend acontece dentro do ciclo da requisição, somando algumas centenas de milissegundos à transição de status.
- Sem eventos de domínio publicados, integrar um sistema externo no futuro exigiria polling ou uma mudança de desenho.

## Quando revisitar

Se aparecer um segundo serviço que precise reagir a mudanças de ordem de serviço, ou se a entrega confiável de notificação virar requisito. O ponto de instrumentação já existe: os casos de uso de transição são exatamente onde um evento de domínio seria publicado.
