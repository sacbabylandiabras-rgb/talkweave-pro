-- Reverter saque travado em 'processing' (function timeout antes de chamar adquirente)
UPDATE public.gateway_withdrawals
SET status = 'pending',
    admin_notes = 'Revertido automaticamente: process-withdrawal travou após marcar status como processing, sem que a transferência fosse efetivada na adquirente. Saque liberado para reprocessamento.',
    updated_at = now()
WHERE id = '9fdbc8a1-b911-4e59-afbb-90897400027d'
  AND status = 'processing';
