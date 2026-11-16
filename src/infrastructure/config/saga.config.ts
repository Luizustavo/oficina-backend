/**
 * Único lugar que lê os prazos da saga. Em segundos. Os padrões são de
 * produção (dias); para a demonstração, valores curtos como 120.
 */
export const sagaConfig = () => ({
  saga: {
    approvalTimeoutMs:
      Number(process.env.SAGA_APPROVAL_TIMEOUT_SECONDS || 3 * 24 * 3600) * 1000,
    paymentTimeoutMs:
      Number(process.env.SAGA_PAYMENT_TIMEOUT_SECONDS || 24 * 3600) * 1000,
  },
});
