// ZapLynxPay Mock Data

export const mockTransactions = [
  { id: "txn_3k8mN2p", date: "27/03/2025 14:23", customer: "João Silva", product: "Curso Marketing Digital", checkout: "Checkout Principal", grossAmount: 29700, fee: 740, netAmount: 28960, method: "credit_card", installments: 3, status: "approved", acquirer: "cielo" },
  { id: "txn_7xPmK9w", date: "27/03/2025 13:45", customer: "Maria Santos", product: "Pack Templates", checkout: "Oferta Relâmpago", grossAmount: 9700, fee: 242, netAmount: 9458, method: "pix", installments: 1, status: "approved", acquirer: "stone" },
  { id: "txn_2nLqR5t", date: "27/03/2025 12:30", customer: "Pedro Costa", product: "Mentoria Mensal", checkout: "Mentoria VIP", grossAmount: 19700, fee: 492, netAmount: 19208, method: "credit_card", installments: 1, status: "pending", acquirer: "cielo" },
  { id: "txn_9mNpQ4r", date: "27/03/2025 11:15", customer: "Ana Oliveira", product: "Curso Marketing Digital", checkout: "Checkout Principal", grossAmount: 29700, fee: 740, netAmount: 28960, method: "boleto", installments: 1, status: "declined", acquirer: "rede" },
  { id: "txn_5kRmT8s", date: "27/03/2025 10:00", customer: "Carlos Mendes", product: "Pack Templates", checkout: "Oferta Relâmpago", grossAmount: 9700, fee: 242, netAmount: 9458, method: "credit_card", installments: 2, status: "approved", acquirer: "cielo" },
  { id: "txn_1pLnM6q", date: "26/03/2025 18:45", customer: "Lucia Ferreira", product: "Curso Marketing Digital", checkout: "Checkout Principal", grossAmount: 29700, fee: 740, netAmount: 28960, method: "pix", installments: 1, status: "approved", acquirer: "stone" },
  { id: "txn_8wQnR3p", date: "26/03/2025 16:30", customer: "Roberto Lima", product: "Mentoria Mensal", checkout: "Mentoria VIP", grossAmount: 19700, fee: 492, netAmount: 19208, method: "credit_card", installments: 6, status: "refunded", acquirer: "cielo" },
  { id: "txn_4xNpK7m", date: "26/03/2025 14:20", customer: "Fernanda Souza", product: "Pack Templates", checkout: "Oferta Relâmpago", grossAmount: 9700, fee: 242, netAmount: 9458, method: "credit_card", installments: 1, status: "approved", acquirer: "stone" },
  { id: "txn_6rMqL2n", date: "26/03/2025 11:10", customer: "Gustavo Alves", product: "Curso Marketing Digital", checkout: "Checkout Principal", grossAmount: 29700, fee: 740, netAmount: 28960, method: "debit_card", installments: 1, status: "approved", acquirer: "rede" },
  { id: "txn_0sKnP9r", date: "25/03/2025 09:55", customer: "Camila Rocha", product: "Mentoria Mensal", checkout: "Mentoria VIP", grossAmount: 19700, fee: 492, netAmount: 19208, method: "pix", installments: 1, status: "approved", acquirer: "cielo" },
  { id: "txn_3tLmQ1p", date: "25/03/2025 08:30", customer: "Diego Martins", product: "Pack Templates", checkout: "Oferta Relâmpago", grossAmount: 9700, fee: 242, netAmount: 9458, method: "credit_card", installments: 3, status: "declined", acquirer: "stone" },
  { id: "txn_7uNqR4k", date: "24/03/2025 17:40", customer: "Patrícia Gomes", product: "Curso Marketing Digital", checkout: "Checkout Principal", grossAmount: 29700, fee: 740, netAmount: 28960, method: "credit_card", installments: 1, status: "approved", acquirer: "cielo" },
];

export const mockProducts = [
  { id: "prod_1", name: "Curso Marketing Digital", description: "Aprenda estratégias avançadas de marketing digital", price: 29700, type: "digital" as const, status: true, image: null, sku: "CMD-001", category: "Educação" },
  { id: "prod_2", name: "Pack Templates Canva", description: "200+ templates profissionais editáveis no Canva", price: 9700, type: "digital" as const, status: true, image: null, sku: "PTC-002", category: "Design" },
  { id: "prod_3", name: "Mentoria Mensal", description: "Acompanhamento individual mensal com especialista", price: 19700, type: "subscription" as const, status: true, image: null, sku: "MNT-003", category: "Consultoria", interval: "monthly", trialDays: 7 },
];

export const mockCheckouts = [
  { id: "ck_1", name: "Checkout Principal", product: "Curso Marketing Digital", format: "Página Completa", conversion: 38.2, status: true, visits: 1240, initiated: 890, approved: 474 },
  { id: "ck_2", name: "Oferta Relâmpago", product: "Pack Templates Canva", format: "One Step", conversion: 52.7, status: true, visits: 856, initiated: 720, approved: 451 },
  { id: "ck_3", name: "Mentoria VIP", product: "Mentoria Mensal", format: "Multi Step", conversion: 29.4, status: true, visits: 340, initiated: 180, approved: 100 },
];

export const mockCompanies = [
  { id: "emp_1", name: "TechStore Ltda", cnpj: "12.345.678/0001-99", segment: "E-commerce", status: "active", manager: "Carlos Mendes", volumeMonth: 234500, approvalRate: 94.2, createdAt: "15/01/2025" },
  { id: "emp_2", name: "InfoProdutos SA", cnpj: "98.765.432/0001-11", segment: "Infoprodutos", status: "active", manager: "Carlos Mendes", volumeMonth: 189300, approvalRate: 91.8, createdAt: "22/01/2025" },
  { id: "emp_3", name: "Moda Express", cnpj: "11.222.333/0001-44", segment: "Moda", status: "kyc_pending", manager: "Ana Gerente", volumeMonth: 0, approvalRate: 0, createdAt: "25/03/2025" },
  { id: "emp_4", name: "FitLife Suplementos", cnpj: "55.666.777/0001-88", segment: "Saúde", status: "active", manager: "Carlos Mendes", volumeMonth: 156800, approvalRate: 92.5, createdAt: "10/02/2025" },
  { id: "emp_5", name: "EduTech Pro", cnpj: "33.444.555/0001-22", segment: "Educação", status: "active", manager: "Ana Gerente", volumeMonth: 98700, approvalRate: 89.3, createdAt: "05/02/2025" },
  { id: "emp_6", name: "Digital Services", cnpj: "77.888.999/0001-66", segment: "SaaS", status: "suspended", manager: "Carlos Mendes", volumeMonth: 45200, approvalRate: 78.1, createdAt: "18/12/2024" },
  { id: "emp_7", name: "Gourmet Delivery", cnpj: "22.333.444/0001-55", segment: "Alimentação", status: "kyc_pending", manager: null, volumeMonth: 0, approvalRate: 0, createdAt: "26/03/2025" },
  { id: "emp_8", name: "Beauty Store", cnpj: "44.555.666/0001-33", segment: "Cosméticos", status: "active", manager: "Ana Gerente", volumeMonth: 78400, approvalRate: 93.7, createdAt: "01/03/2025" },
];

export const mockAcquirers = [
  { id: "acq_1", name: "Cielo", status: "production", env: "Produção", volumeMonth: 456000, approvalRate: 94.2, logo: "🟢" },
  { id: "acq_2", name: "Stone", status: "production", env: "Produção", volumeMonth: 312000, approvalRate: 92.8, logo: "🟢" },
  { id: "acq_3", name: "Rede", status: "sandbox", env: "Sandbox", volumeMonth: 0, approvalRate: 0, logo: "🟡" },
  { id: "acq_4", name: "GetNet", status: "inactive", env: "Inativa", volumeMonth: 0, approvalRate: 0, logo: "⚪" },
  { id: "acq_5", name: "PagSeguro", status: "inactive", env: "Inativa", volumeMonth: 0, approvalRate: 0, logo: "⚪" },
  { id: "acq_6", name: "SafraPay", status: "inactive", env: "Inativa", volumeMonth: 0, approvalRate: 0, logo: "⚪" },
];

export const mockManagerClients = [
  { id: "mc_1", company: "TechStore Ltda", cnpj: "12.345.678/0001-99", segment: "E-commerce", status: "active", volumeMonth: 234500, commissionGenerated: 2345, linkedAt: "15/01/2025" },
  { id: "mc_2", company: "InfoProdutos SA", cnpj: "98.765.432/0001-11", segment: "Infoprodutos", status: "active", volumeMonth: 189300, commissionGenerated: 1893, linkedAt: "22/01/2025" },
  { id: "mc_3", company: "FitLife Suplementos", cnpj: "55.666.777/0001-88", segment: "Saúde", status: "active", volumeMonth: 156800, commissionGenerated: 1568, linkedAt: "10/02/2025" },
  { id: "mc_4", company: "Digital Services", cnpj: "77.888.999/0001-66", segment: "SaaS", status: "suspended", volumeMonth: 45200, commissionGenerated: 452, linkedAt: "18/12/2024" },
  { id: "mc_5", company: "Loja Virtual Plus", cnpj: "88.999.000/0001-77", segment: "E-commerce", status: "active", volumeMonth: 67800, commissionGenerated: 678, linkedAt: "01/03/2025" },
  { id: "mc_6", company: "Curso Express", cnpj: "99.000.111/0001-88", segment: "Educação", status: "active", volumeMonth: 34500, commissionGenerated: 345, linkedAt: "15/03/2025" },
  { id: "mc_7", company: "Pet Shop Online", cnpj: "00.111.222/0001-99", segment: "Pet", status: "kyc_pending", volumeMonth: 0, commissionGenerated: 0, linkedAt: "20/03/2025" },
  { id: "mc_8", company: "Tech Academy", cnpj: "11.222.333/0001-00", segment: "Educação", status: "active", volumeMonth: 89400, commissionGenerated: 894, linkedAt: "05/02/2025" },
];

export const mockChartData = Array.from({ length: 30 }, (_, i) => ({
  date: `${String(i + 1).padStart(2, '0')}/03`,
  volume: Math.floor(Math.random() * 15000) + 5000,
  transactions: Math.floor(Math.random() * 50) + 10,
}));

export const mockCommissions = [
  { month: "Mar/2025", volumePortfolio: 817500, commissionPercent: 1.0, grossValue: 8175, taxWithheld: 1226, netValue: 6949, status: "pending", paymentDate: null },
  { month: "Fev/2025", volumePortfolio: 756200, commissionPercent: 1.0, grossValue: 7562, taxWithheld: 1134, netValue: 6428, status: "paid", paymentDate: "05/03/2025" },
  { month: "Jan/2025", volumePortfolio: 689400, commissionPercent: 1.0, grossValue: 6894, taxWithheld: 1034, netValue: 5860, status: "paid", paymentDate: "05/02/2025" },
  { month: "Dez/2024", volumePortfolio: 923100, commissionPercent: 1.0, grossValue: 9231, taxWithheld: 1385, netValue: 7846, status: "paid", paymentDate: "06/01/2025" },
];

export const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
};

export const formatCurrencyReais = (reais: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reais);
};

export const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    approved: { label: "Aprovado", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    pending: { label: "Pendente", color: "text-amber-400", bg: "bg-amber-500/10" },
    declined: { label: "Recusado", color: "text-red-400", bg: "bg-red-500/10" },
    refunded: { label: "Estornado", color: "text-blue-400", bg: "bg-blue-500/10" },
    active: { label: "Ativo", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    suspended: { label: "Suspenso", color: "text-gray-400", bg: "bg-gray-500/10" },
    kyc_pending: { label: "Análise KYC", color: "text-blue-400", bg: "bg-blue-500/10" },
    production: { label: "Produção", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    sandbox: { label: "Sandbox", color: "text-amber-400", bg: "bg-amber-500/10" },
    inactive: { label: "Inativa", color: "text-gray-400", bg: "bg-gray-500/10" },
    paid: { label: "Pago", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    failed: { label: "Falhou", color: "text-red-400", bg: "bg-red-500/10" },
  };
  return map[status] || { label: status, color: "text-gray-400", bg: "bg-gray-500/10" };
};

export const getMethodLabel = (method: string) => {
  const map: Record<string, string> = {
    credit_card: "Cartão Crédito",
    debit_card: "Cartão Débito",
    pix: "PIX",
    boleto: "Boleto",
  };
  return map[method] || method;
};
