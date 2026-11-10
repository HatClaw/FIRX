import { formatBRL, getContratoResumoFinanceiro, type ContratoLocal } from '@/lib/contratos-store';
import { gerarCronogramaParcelas, mesesDaPeriodicidade } from '@/lib/contrato-calculo';

export const EMPRESA_CONTRATO = {
  razaoSocial: 'GROWMONEY DIGITAL LTDA',
  nomeFantasia: 'GROWMONEY DIGITAL',
  cnpj: '10.949.897/0001-58',
  naturezaJuridica: '206-2 — Sociedade Empresária Limitada',
  logradouro: 'R Sete Barras',
  numero: '257',
  complemento: 'Box 254',
  cep: '02.927-080',
  bairro: 'Nossa Senhora do O',
  municipio: 'São Paulo',
  uf: 'SP',
  email: 'RENATOARANTESDIGITAL@GMAIL.COM',
  telefone: '(62) 8594-3333',
} as const;

function getLogoUrl() {
  const origin = typeof window !== 'undefined' ? window.location.origin : import.meta.env.VITE_APP_URL || '';
  return new URL(`${import.meta.env.BASE_URL}assets/grow-logo-black.png`, origin || 'http://localhost').href;
}

const esc = (value: unknown) =>
  String(value ?? '—').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char);

const dataBR = (date?: string) => {
  if (!date) return '—';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? esc(date) : parsed.toLocaleDateString('pt-BR');
};

export function gerarContratoHtml(contrato: ContratoLocal) {
  const logoUrl = esc(getLogoUrl());
  const prazo = contrato.prazo_meses || 12;
  const descontos = contrato.desconto_valor || 0;
  const resumoFinanceiro = getContratoResumoFinanceiro(contrato);
  const formaPagamentoLabel: Record<string, string> = {
    cartao_credito: 'Cartão de crédito', pix: 'Pix', boleto: 'Boleto', transferencia: 'Transferência', outro: 'Outro',
    entrada_parcelas: 'Entrada + parcelas', parcelas: 'Parcelas',
  };
  const formaPagamento = formaPagamentoLabel[contrato.forma_pagamento] || contrato.forma_pagamento || 'A combinar';
  const periodicidade = contrato.periodicidade || 'mensal';
  const intervaloMeses = mesesDaPeriodicidade(periodicidade);
  const cronogramaParcelas = contrato.data_primeira_parcela
    ? gerarCronogramaParcelas(contrato.data_primeira_parcela, contrato.parcelas || 1, contrato.valor_parcela, contrato.valor_ultima_parcela ?? contrato.valor_parcela, intervaloMeses)
    : [];
  const bonusConcedidos = contrato.itens.filter((item) => item.isBonus);
  const bonusMarkup = bonusConcedidos.length
    ? `<h3>Bônus concedidos sem cobrança</h3><ul>${bonusConcedidos.map((item) => `<li>${esc(item.nome)} — valor comercial ${formatBRL(item.valor_comercial_total || 0)}; cobrado ${formatBRL(0)}.</li>`).join('')}</ul>`
    : '';
  const itens = contrato.itens
    .map((item) => {
      const periodo = item.tipo === 'mensal' ? ` × ${item.prazo_meses || prazo} mês(es)` : '';
      const qtd = item.quantidade > 1 ? ` × ${item.quantidade} unidade(s)` : '';
      const unitario = item.isBonus ? item.valor_comercial_total || 0 : item.valor;
      const total = item.isBonus ? 0 : item.valor_total ?? item.valor * item.quantidade;
      return `<tr><td>${esc(item.nome)}${item.isBonus ? ' (bônus)' : ''}</td><td>${formatBRL(unitario)}${periodo}${qtd}</td><td>${item.isBonus ? formatBRL(item.valor_comercial_total || 0) : formatBRL(total)}</td><td>${formatBRL(item.isBonus ? 0 : total)}</td></tr>`;
    })
    .join('');

  const endereco = [
    contrato.cliente_endereco,
    contrato.cliente_numero_endereco ? `nº ${contrato.cliente_numero_endereco}` : '',
    contrato.cliente_bairro,
    contrato.cliente_complemento,
    contrato.cliente_cep ? `CEP ${contrato.cliente_cep}` : '',
    contrato.cliente_cidade,
    contrato.cliente_estado,
  ].filter(Boolean).join(', ');

  return `
  <article class="contract-document">
    <header class="contract-brand"><img src="${logoUrl}" alt="${esc(EMPRESA_CONTRATO.nomeFantasia)}" /><span>Contrato de serviço publicitário</span></header>
    <h1>Contrato de serviço publicitário</h1>
    <p class="contract-number">Contrato #${String(contrato.numero || 0).padStart(4, '0')}</p>
    <h2>I – CONTRATADO</h2>
    <p><strong>${esc(EMPRESA_CONTRATO.razaoSocial)}</strong>, nome fantasia ${esc(EMPRESA_CONTRATO.nomeFantasia)}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${esc(EMPRESA_CONTRATO.cnpj)}, natureza jurídica ${esc(EMPRESA_CONTRATO.naturezaJuridica)}, com sede em ${esc(EMPRESA_CONTRATO.logradouro)}, nº ${esc(EMPRESA_CONTRATO.numero)}, ${esc(EMPRESA_CONTRATO.complemento)}, CEP ${esc(EMPRESA_CONTRATO.cep)}, bairro ${esc(EMPRESA_CONTRATO.bairro)}, ${esc(EMPRESA_CONTRATO.municipio)} – ${esc(EMPRESA_CONTRATO.uf)}, e-mail ${esc(EMPRESA_CONTRATO.email)}, telefone ${esc(EMPRESA_CONTRATO.telefone)}, doravante citada como CONTRATADA.</p>
    <h2>II – CONTRATANTE</h2>
    <table><tbody>
      <tr><th>Nome fantasia / Razão social</th><td>${esc(contrato.cliente_nome)}</td><th>CNPJ/CPF</th><td>${esc(contrato.cliente_documento)}</td></tr>
      <tr><th>Endereço</th><td colspan="3">${esc(endereco)}</td></tr>
      <tr><th>E-mail</th><td>${esc(contrato.cliente_email)}</td><th>Telefone</th><td>${esc(contrato.cliente_telefone)}</td></tr>
    </tbody></table>
    <h2>III – ESPECIFICAÇÃO DO SERVIÇO #${String(contrato.numero || 0).padStart(4, '0')}</h2>
    <table><tbody>
      <tr><th>Consultor</th><td>${esc(contrato.vendedor || 'Renato Arantes')}</td><th>Cliente</th><td>${esc(contrato.cliente_nome)}</td></tr>
      <tr><th>Serviços</th><td colspan="3">${contrato.itens.filter((i) => !i.isBonus).map((i) => esc(i.nome)).join(', ') || '—'}</td></tr>
      <tr><th>Valor do contrato</th><td>${formatBRL(contrato.valor)}</td><th>Meio de pagamento</th><td>${esc(formaPagamento)}</td></tr>
      <tr><th>Prazo contratual</th><td>${prazo} (${prazo === 12 ? 'doze' : prazo}) meses</td><th>Modalidade</th><td>${esc(contrato.modalidade || 'Pagamento único')}</td></tr>
      <tr><th>Início da vigência</th><td>${dataBR(contrato.data_inicio)}</td><th>Término da vigência</th><td>${dataBR(contrato.data_termino)}</td></tr>
      <tr><th>Vendedor responsável</th><td>${esc(contrato.vendedor || 'Renato Arantes')}</td><th>Unidades atendidas</th><td>${contrato.unidades}</td></tr>
    </tbody></table>
    <h2>DETALHAMENTO DOS SERVIÇOS CONTRATADOS</h2>
    <table><thead><tr><th>Serviço</th><th>Base comercial</th><th>Valor comercial</th><th>Valor cobrado</th></tr></thead><tbody>${itens}</tbody></table>
    <p>As partes têm entre si justo e acordado celebrar o presente “CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PUBLICIDADE DIGITAL”, que seguirá as cláusulas e condições abaixo estabelecidas.</p>
    <h2>CLÁUSULA PRIMEIRA – DAS DECLARAÇÕES E OBJETO</h2>
    <p><b>1.1</b> A contratada é uma credenciada que trabalha com tráfego orgânico e/ou tráfego pago.</p>
    <p><b>1.2</b> Constitui objeto do presente contrato a prestação dos seguintes serviços, pela contratada, em favor da contratante:</p>
    <p><b>1.2.1</b> Os serviços descritos no item anterior, que são serviços de “meio”, têm como finalidade aprimorar as informações e a imagem da contratante junto ao Google, com vistas a melhorar sua visibilidade perante os usuários dos serviços oferecidos pelo Google.</p>
    <p><b>1.2.2</b> A contratante deverá apresentar para a contratada seu endereço completo, seus meios de contato, seus ramos de atuação profissional e/ou comercial e todas as informações que sejam possíveis de serem inseridas junto ao Google.</p>
    <p><b>1.2.3</b> Em razão do serviço prestado pela contratada, todas as pessoas que, dentro de um raio de 15 (quinze) quilômetros do estabelecimento comercial da contratante, realizarem pesquisas junto ao Google utilizando as palavras chaves de busca/engajamento indicadas encontrarão os dados e as informações da contratante.</p>
    <p><b>1.3</b> A título de cortesia, a contratada dará suporte profissional de atualização para a contratante durante o período de 12 (doze) meses, a contar da assinatura e do efetivo pagamento deste contrato. Para acionar o suporte, a contratante deverá entrar em contato através do telefone/WhatsApp ${esc(EMPRESA_CONTRATO.telefone)} e/ou do e-mail ${esc(EMPRESA_CONTRATO.email)}.</p>
    <p><b>1.4</b> Fica certo e acordado entre as partes, ainda, que a contratada poderá, a seu exclusivo critério, contratar terceiros para a prestação dos serviços contratados, sendo que neste ato a contratante concede poderes à contratada para que esta conclua, por sua conta e ordem, todos os contratos necessários para a execução do objeto do presente instrumento.</p>
    <h2>CLÁUSULA SEGUNDA – DAS OBRIGAÇÕES DAS PARTES</h2>
    <p><b>2.1</b> As partes obrigam-se, na execução do presente contrato, a:</p>
    <ul>
      <li>Adimplir integral e tempestivamente todas as obrigações descritas neste contrato;</li>
      <li>Informar a outra parte sobre qualquer ocorrência que possa vir a afetar ou que possa, de alguma forma, interferir no bom andamento dos serviços contratados;</li>
      <li>A contratante é responsável por todas as informações apresentadas à contratada;</li>
      <li>A contratada, após assinatura deste contrato, terá o prazo de até 30 (trinta) dias para a realização dos serviços contratados;</li>
      <li>Eventuais alterações cadastrais devem ser informadas e requeridas pelo contratante à contratada, que terá o prazo de até 10 dias para executá-los;</li>
      <li>Caso haja reforma significativa que descaracterize o ambiente externo e/ou interno e/ou caso haja alteração de endereço e/ou qualquer outra informação da contratante, esta deverá comunicar à contratada e requerer que sejam feitas as respectivas alterações. A contratada, por sua vez, terá o prazo de até 30 (trinta) dias para realizar tais serviços.</li>
    </ul>
    <p><b>2.2</b> A CONTRATANTE deverá fornecer à CONTRATADA, via e-mail ou WhatsApp, os seguintes dados e informações listados abaixo, para que a CONTRATADA possa prestar os serviços contratados:</p>
    <ul><li>Materiais e diretrizes da sua identidade visual;</li><li>Fornecer ou aceitar convite de acesso ao “Perfil da Empresa no Google”, já existente, no Google;</li><li>Demais dados solicitados e acessos que sejam necessários para a execução dos serviços;</li><li>Fornecer endereço completo, seus meios de contato, seus ramos de atuação profissional e/ou comercial e todas as informações que sejam possíveis serem inseridas junto ao Google, sendo a CONTRATANTE responsável por todas as informações apresentadas à CONTRATADA.</li></ul>
    <p><b>2.3</b> Fica a CONTRATANTE ciente de que é CONDIÇÃO para a execução de todos os serviços descritos na Cláusula Primeira do presente instrumento, o fornecimento dos dados listados no item 2.2.</p>
    <h2>CLÁUSULA TERCEIRA – DO PRAZO CONTRATUAL</h2>
    <p><b>3.1</b> O presente contrato entra em vigor em ${dataBR(contrato.data_inicio)}, com término em ${dataBR(contrato.data_termino)}, com prazo de vigência de ${prazo} meses, e se encerrará quando do adimplemento das obrigações aqui descritas, podendo ser prorrogado, de maneira expressa, por meio de termo aditivo celebrado pelas partes.</p>
    <h2>CLÁUSULA QUARTA – DO PAGAMENTO</h2>
    <p><b>4.1</b> A contratante pagará à contratada a importância descrita no item “III - ESPECIFICAÇÃO DO SERVIÇO:”, de acordo com o meio de pagamento ali previsto.</p>
    <p><b>4.2</b> O valor total do presente contrato é de ${formatBRL(contrato.valor)}, a ser pago por meio de ${esc(formaPagamento)}. ${contrato.parcelas > 1 ? `Pagamento em ${contrato.parcelas} parcelas, no valor de ${formatBRL(contrato.valor_parcela)}${contrato.valor_ultima_parcela !== contrato.valor_parcela ? `, com última parcela de ${formatBRL(contrato.valor_ultima_parcela || 0)}` : ''}.` : ''} ${contrato.entrada_valor > 0 ? `Entrada de ${formatBRL(contrato.entrada_valor)}.` : ''}</p>
    <h2>CLÁUSULA QUINTA – DA RESCISÃO, CANCELAMENTO E DEVOLUÇÃO DE VALORES</h2>
    <p><b>5.1</b> O presente contrato corresponde à contratação dos serviços pelo prazo e condições comerciais expressamente estabelecidos no campo de especificação e no resumo da contratação, sendo o valor contratado referente ao período contratual integral.</p>
    <p><b>5.2</b> Quando houver concessão de desconto comercial em razão da contratação por prazo determinado, referido desconto estará condicionado à manutenção da contratação durante o período contratado, conforme as condições estabelecidas neste instrumento.</p>
    <p><b>5.3</b> Em caso de desistência ou solicitação de encerramento antecipado por iniciativa da CONTRATANTE, sem que haja inadimplemento contratual imputável à CONTRATADA, permanecerão devidos os valores correspondentes aos serviços já executados, etapas já realizadas, despesas comprovadamente assumidas para execução do contrato e demais obrigações já constituídas até a data do encerramento.</p>
    <p><b>5.4</b> O simples pedido de cancelamento, desistência ou insatisfação da CONTRATANTE com os resultados comerciais obtidos não gera, por si só, direito à restituição dos valores correspondentes aos serviços efetivamente prestados.</p>
    <p><b>5.5</b> Os serviços objeto deste contrato constituem obrigação de meio, não havendo garantia de quantidade mínima de vendas, faturamento, leads, mensagens, ligações, clientes, retorno sobre investimento ou qualquer resultado comercial específico. A ausência de determinado resultado comercial, por si só, não caracteriza falha na prestação dos serviços nem gera automaticamente direito à devolução dos valores pagos.</p>
    <p><b>5.6</b> Após o início da execução dos serviços, os valores correspondentes às atividades efetivamente realizadas pela CONTRATADA não serão objeto de restituição, inclusive quando a CONTRATANTE decidir interromper a contratação por iniciativa própria.</p>
    <p><b>5.7</b> Caso o pagamento tenha sido realizado antecipadamente por período determinado, eventual encerramento antecipado não transforma automaticamente a contratação em mensalidade avulsa nem gera direito automático à restituição integral ou proporcional dos valores pagos, devendo eventual apuração considerar os serviços já executados, obrigações já constituídas, despesas comprovadamente realizadas e as condições comerciais pactuadas neste contrato.</p>
    <p><b>5.8</b> Não haverá restituição de valores quando a execução dos serviços tiver sido prejudicada ou impossibilitada por ausência, atraso ou fornecimento inadequado de informações, acessos, materiais, aprovações ou demais providências de responsabilidade da CONTRATANTE, sem prejuízo dos valores já constituídos em razão dos serviços executados.</p>
    <p><b>5.9</b> O investimento destinado às plataformas de publicidade, incluindo Google Ads e Meta Ads, não integra a remuneração da CONTRATADA e é de responsabilidade da CONTRATANTE, conforme estabelecido neste contrato. Eventuais cobranças, créditos, débitos, bloqueios, estornos ou políticas de reembolso das respectivas plataformas serão tratados diretamente entre a CONTRATANTE e a plataforma responsável.</p>
    <p><b>5.10</b> As disposições desta cláusula não afastam direitos que eventualmente sejam assegurados à CONTRATANTE por normas legais de aplicação obrigatória, nem impedem a apuração de eventual falha comprovada na prestação dos serviços pela CONTRATADA.</p>
    <p><b>5.11</b> A eventual concessão, pela CONTRATADA, de qualquer restituição, abatimento ou condição excepcional em determinado caso não constituirá precedente, novação ou alteração das condições comerciais estabelecidas neste contrato para os demais casos.</p>
    <h2>CLÁUSULA SEXTA – LEI GERAL DE PROTEÇÃO DE DADOS</h2>
    <p><b>6.1</b> As partes comprometem-se a manter dados sensíveis tratados na Lei 13.709/18 a que tiver acesso em decorrência do cumprimento do objeto deste contrato, dando o justo tratamento aos referidos dados no que tange à coleta, registro, armazenamento e divulgação.</p>
    <p><b>6.2</b> As partes comprometem-se a cumprir, e fazer com que seus funcionários cumpram, integralmente a Lei 13.709/18 no que for cabível ao objeto do presente contrato, obtendo o consentimento do titular da informação para análise e coleta de dados sensíveis e informando à contratada acerca de quaisquer incidentes relativo à perda, acesso indevido, invasão de hackers, detecção de malwares ou quaisquer outros eventos que possam comprometer a privacidade de dados dos usuários do software.</p>
    <p><b>6.3</b> As partes poderão exigir umas das outras, a qualquer tempo, que a outra demonstre estar cumprindo os termos da Lei Geral de Proteção de Dados e obtendo os consentimentos dos titulares das informações, podendo rescindir imediatamente o presente contrato caso a parte contrária não comprove estar cumprindo os termos da Legislação em vigor.</p>
    <h2>CLÁUSULA SÉTIMA – DAS DISPOSIÇÕES GERAIS</h2>
    <p><b>7.1</b> As obrigações e/ou direitos decorrentes deste contrato não poderão ser cedidos ou transferidos por qualquer das partes, nem dados como garantia de obrigações sem a prévia e expressa anuência, por escrito, da outra parte.</p>
    <p><b>7.2</b> Fica expressamente estipulado que não se estabelece por força do presente contrato qualquer espécie de vínculo empregatício, associação e/ou parceria entre as partes.</p>
    <p><b>7.3</b> O presente contrato é celebrado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e sucessores a qualquer título.</p>
    <p><b>7.4</b> Fica desde já eleito o foro da comarca de ${esc(EMPRESA_CONTRATO.municipio)} - ${esc(EMPRESA_CONTRATO.uf)} para dirimir quaisquer litígios, contendas e/ou discussões oriundas deste contrato, com renúncia expressa a qualquer outro foro, por mais privilegiado que seja.</p>
    <p>E por estarem justas e contratadas, assine digitalmente o presente contrato.</p>
    <p><strong>Contratada: ${esc(EMPRESA_CONTRATO.razaoSocial)} — ${esc(EMPRESA_CONTRATO.cnpj)}</strong></p>
    <h2>RESUMO DA CONTRATAÇÃO</h2>
    <table><tbody>
      <tr><th>Prazo</th><td>${prazo} meses</td></tr>
      <tr><th>Valor de tabela sem bônus ou descontos</th><td>${formatBRL(resumoFinanceiro.valorSemBeneficios)}</td></tr>
      <tr><th>Desconto comercial (${(contrato.desconto_percentual || 0).toFixed(1)}%)</th><td>- ${formatBRL(descontos)}</td></tr>
      <tr><th>Bônus concedidos sem cobrança</th><td>- ${formatBRL(contrato.bonus_total)}</td></tr>
      <tr><th>Economia total do cliente</th><td>${formatBRL(resumoFinanceiro.economia)} (${resumoFinanceiro.economiaPercentual.toFixed(1)}%)</td></tr>
      <tr><th>Valor final do contrato (${prazo} meses)</th><td><strong>${formatBRL(contrato.valor)}</strong></td></tr>
    </tbody></table>
    <h3>Forma e calendário de pagamento</h3>
    <p><strong>Forma:</strong> ${esc(formaPagamento)} · <strong>Periodicidade:</strong> ${esc(periodicidade)} · <strong>Cobranças:</strong> ${contrato.parcelas || 1} de ${formatBRL(contrato.valor_parcela || contrato.valor)}${contrato.valor_ultima_parcela !== contrato.valor_parcela ? ` (última de ${formatBRL(contrato.valor_ultima_parcela || 0)})` : ''}${contrato.entrada_valor > 0 ? ` · Entrada de ${formatBRL(contrato.entrada_valor)}` : ''}</p>
    ${cronogramaParcelas.length ? `<table><thead><tr><th>Parcela</th><th>Data de pagamento</th><th>Valor</th></tr></thead><tbody>${cronogramaParcelas.map((parcela) => `<tr><td>${parcela.numero}ª</td><td>${dataBR(parcela.data)}</td><td>${formatBRL(parcela.valor)}</td></tr>`).join('')}</tbody></table>` : '<p>As datas de vencimento das parcelas serão combinadas entre as partes.</p>'}
    ${bonusMarkup}
    <p>O valor total do contrato é o valor da prestação de serviços durante todo o período de ${prazo} meses.</p>
    <p>O investimento em mídia das plataformas Google Ads e Meta Ads não está incluído nos valores acima e é pago separadamente pela CONTRATANTE.</p>
    <h2>LOCAL E MODALIDADE DA CONTRATAÇÃO</h2>
    <p>A CONTRATANTE declara que a negociação, apresentação dos serviços, condições comerciais, valores, prazo contratual e demais condições deste instrumento foram apresentados e formalizados presencialmente no estabelecimento comercial da CONTRATADA, situado em ${esc(EMPRESA_CONTRATO.logradouro)}, nº ${esc(EMPRESA_CONTRATO.numero)}, ${esc(EMPRESA_CONTRATO.complemento)}, ${esc(EMPRESA_CONTRATO.municipio)} - ${esc(EMPRESA_CONTRATO.uf)}, tendo a CONTRATANTE tido oportunidade de conhecer previamente o conteúdo deste contrato, esclarecer eventuais dúvidas e manifestar livremente sua concordância com a contratação.</p>
    <div class="signatures">
      <div class="signature-party"><div class="signature-line"></div><strong>ASSINATURA DO CLIENTE</strong><span>${esc(contrato.cliente_nome)}</span><span>CPF/CNPJ: ${esc(contrato.cliente_documento)}</span><small>Assinatura manual ou eletrônica</small></div>
      <div class="signature-party"><div class="signature-line"></div><strong>ASSINATURA DA EMPRESA</strong><span>${esc(EMPRESA_CONTRATO.razaoSocial)}</span><span>CNPJ ${esc(EMPRESA_CONTRATO.cnpj)}</span><small>Representante da CONTRATADA</small></div>
    </div>
  </article>
  <style>
    .contract-document{max-width:860px;margin:0 auto;color:#1f2937;font-family:Arial,sans-serif;font-size:11pt;line-height:1.55}
    .contract-brand{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #ff6a00;padding-bottom:12px;margin-bottom:20px;color:#c2410c}
    .contract-brand img{display:block;width:180px;height:auto;max-height:56px;object-fit:contain}
    .contract-document h1{font-size:20pt;text-align:center;margin:12px 0 2px}
    .contract-document h2{font-size:12pt;margin:20px 0 8px;padding-bottom:4px;border-bottom:1px solid #cbd5e1;color:#0f172a}
    .contract-document p{margin:8px 0;text-align:justify}
    .contract-document table{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:10pt;break-inside:avoid}
    .contract-document th,.contract-document td{border:1px solid #cbd5e1;padding:6px;text-align:left;vertical-align:top}
    .contract-document th{background:#f1f5f9}
    .contract-document ul{padding-left:22px}.contract-document li{margin:5px 0}
    .contract-document .signatures{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin:56px 0 24px;text-align:center;break-inside:avoid}
    .contract-document .signature-party{display:flex;min-height:125px;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;font-size:10pt}
    .contract-document .signature-line{width:100%;border-top:1px solid #1f2937;margin-bottom:8px}
    .contract-document .signature-party small{font-size:8.5pt;color:#64748b}
    .contract-number{text-align:center!important;color:#475569}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin:42px 8px 10px}
    .signatures div{border-top:1px solid #475569;padding-top:8px;text-align:center}
    @media print{.contract-document{max-width:none}.contract-document h2{break-after:avoid} .contract-document p,.contract-document li{orphans:3;widows:3}}
    @media(max-width:600px){.contract-document .signatures{grid-template-columns:1fr;gap:24px}}
  </style>`;
}
