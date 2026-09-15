# ADR-004 — Segredos da Lambda em variável de ambiente, não no SSM

**Status:** Aceita, com ressalva · **Data:** 2026-09-13

## Contexto

A Lambda de autenticação precisa de dois segredos: a connection string do RDS e o `JWT_SECRET` compartilhado com a aplicação.

O padrão recomendado seria guardá-los no **AWS Secrets Manager** ou **SSM Parameter Store** e lê-los no cold start.

O problema é de rede. A função roda **dentro da VPC** — é a única forma de alcançar o RDS, que fica em subnet privada. E a VPC **não tem NAT Gateway**, removido para cortar custo ([ADR-001](adr-001-k3s-em-ec2-no-lugar-do-eks.md)).

Sem NAT, uma Lambda na VPC não alcança endpoint público nenhum — inclusive o do SSM e o do Secrets Manager.

## Opções

| Opção | Custo mensal | Avaliação |
|---|---|---|
| VPC Endpoint para SSM | ~US$ 7/mês por AZ | Mais caro que todo o resto da infraestrutura somado |
| Reintroduzir NAT Gateway | ~US$ 35/mês | Inviável; foi removido justamente por isso |
| Variável de ambiente da Lambda | US$ 0 | Criptografada em repouso com KMS |

## Decisão

**Variável de ambiente da Lambda**, populada pelo Terraform a partir do `terraform_remote_state` do repositório de banco.

O `JWT_SECRET` é gerado pelo Terraform (`random_password`, 64 caracteres) e exposto como output sensível, para ser sincronizado com o `Secret` do Kubernetes.

## Consequências

**Positivas**
- Custo zero, e nenhuma chamada de rede no cold start — a função inicia mais rápido.
- Criptografadas em repouso com KMS pela própria AWS.
- O Terraform é a única fonte de verdade: a connection string vem direto do state do banco, sem cópia manual.

**Negativas**
- **Visíveis no console** para qualquer identidade com `lambda:GetFunctionConfiguration`. Um segredo no Secrets Manager teria política de acesso própria e trilha de auditoria por leitura.
- **Vão para o Terraform state**, que fica no S3 com criptografia AES256 e acesso público bloqueado — mas ainda assim é mais um lugar onde o segredo existe.
- **Rotação é manual**: exige `terraform apply` e sincronizar o novo valor no `Secret` do Kubernetes. Não há rotação automática.
- O `JWT_SECRET` precisa ser copiado manualmente para o cluster. Esquecer faz a API rejeitar todo token emitido pela Lambda — falha silenciosa e confusa.

## Ressalva

Esta decisão é aceitável **porque o ambiente é acadêmico e descartável**, com infraestrutura destruída ao fim de cada sessão.

Num ambiente de produção real, a recomendação se inverte: vale pagar o VPC Endpoint do Secrets Manager e ganhar política de acesso granular, auditoria por leitura e rotação automática.

## Evolução recomendada

1. **AWS Secrets Manager + VPC Endpoint** para os segredos da Lambda.
2. **External Secrets Operator** no cluster, sincronizando do Secrets Manager para o `Secret` do Kubernetes — elimina a cópia manual e o risco de dessincronia.
3. Migrar o token para **RS256** ([RFC-003](../rfc/rfc-003-estrategia-de-autenticacao.md)), o que elimina o segredo compartilhado e reduz o problema pela metade: só a Lambda precisaria da chave privada.
